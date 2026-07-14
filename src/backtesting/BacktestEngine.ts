import { HistoricalMatch } from '../dataCollector/HistoricalMatchTypes';
import { calculateTeamStatistics, buildModelInputFromHistoricalData } from '../dataCollector/HistoricalFeatureCalculator';
import { getMatchesByCompetition } from '../dataCollector/HistoricalMatchRepository';
import { getOutcome, evaluatePrediction } from '../performance/PerformanceEngine';
import { FootballDataEngine } from '../data/FootballDataEngine';
import { getModelById } from '../modelRegistry';
import { SavedPrediction, ActualMatchResult } from '../types';
import { BacktestOptions, BacktestRun, BacktestMatchResult } from './BacktestTypes';
import { saveBacktestRun, saveBacktestResults, getBacktestResultsPage, getBacktestRunById } from './BacktestRepository';

/**
 * Ordina in modo deterministico e cronologico le partite storiche.
 * Regola: data crescente, poi competizione, poi squadra in casa, poi squadra in trasferta, poi ID.
 */
export function sortMatchesChronologically(matches: HistoricalMatch[]): HistoricalMatch[] {
  return [...matches].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    const compComp = a.competition.localeCompare(b.competition);
    if (compComp !== 0) return compComp;
    const homeComp = a.homeTeam.localeCompare(b.homeTeam);
    if (homeComp !== 0) return homeComp;
    const awayComp = a.awayTeam.localeCompare(b.awayTeam);
    if (awayComp !== 0) return awayComp;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Valida le opzioni del backtest.
 */
export function validateBacktestOptions(options: BacktestOptions): string[] {
  const errors: string[] = [];
  if (!options.competition || options.competition.trim() === '') {
    errors.push('La competizione è obbligatoria.');
  }
  if (!options.modelIds || options.modelIds.length === 0) {
    errors.push('Selezionare almeno un modello.');
  }
  if (typeof options.minimumMatches !== 'number' || isNaN(options.minimumMatches) || options.minimumMatches < 1) {
    errors.push('Il numero minimo di partite deve essere un intero maggiore o uguale a 1.');
  }
  if (typeof options.batchSize !== 'number' || isNaN(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    errors.push('La dimensione del batch deve essere compresa tra 1 e 500.');
  }
  if (options.timeDecayEnabled) {
    if (typeof options.timeDecayRate !== 'number' || isNaN(options.timeDecayRate) || !isFinite(options.timeDecayRate) || options.timeDecayRate <= 0) {
      errors.push('Il tasso di decadimento temporale (Time Decay Rate) deve essere un numero finito maggiore di 0.');
    }
  }
  if (options.startDate && options.endDate) {
    if (options.startDate > options.endDate) {
      errors.push('La data iniziale deve essere minore o uguale alla data finale.');
    }
  }
  return errors;
}

/**
 * Funzione di controllo del loop per la gestione del Pausa e del Cancel.
 */
export async function checkPauseAndCancel(
  isPaused: () => boolean,
  isCancelled: () => boolean
): Promise<boolean> {
  if (isCancelled()) return true;
  while (isPaused()) {
    if (isCancelled()) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return isCancelled();
}

/**
 * Recupera la versione del modello in modo deterministico senza dipendere da proprietà dinamiche non digitate.
 */
export function getModelVersion(modelId: string): string {
  switch (modelId) {
    case 'poisson-standard':
      return '1.1.0';
    case 'poisson-gamma':
      return '0.1.0';
    case 'dixon-coles':
      return '1.0.0';
    default:
      return '1.0.0';
  }
}

export interface ProgressUpdate {
  processedMatches: number;
  totalCandidateMatches: number;
  evaluatedPredictions: number;
  skippedMatches: number;
  progressPercent: number;
  currentDate?: string;
  currentMatch?: string;
}

/**
 * Motore di Backtesting Cronologico Multi-Modello.
 */
export async function runBacktest(
  runId: string,
  callbacks: {
    isPaused: () => boolean;
    isCancelled: () => boolean;
    onProgress: (prog: ProgressUpdate) => void;
    onBatchCompleted?: (results: BacktestMatchResult[], updatedRun: BacktestRun) => Promise<void>;
  }
): Promise<BacktestRun> {
  const { isPaused, isCancelled, onProgress, onBatchCompleted } = callbacks;

  // Recupera il run metadata
  const run = await getBacktestRunById(runId);
  if (!run) {
    throw new Error(`Run di backtest con ID ${runId} non trovato.`);
  }

  // Aggiorna lo stato in 'running'
  run.status = 'running';
  run.error = undefined;
  await saveBacktestRun(run);

  try {
    const options = run.options;

    // Carica tutte le partite della competizione richiesta
    const allCompMatches = await getMatchesByCompetition(options.competition);

    // Filtra per il periodo richiesto (startDate ed endDate incluse)
    let candidates = allCompMatches.filter(m => {
      if (options.startDate && m.date < options.startDate) return false;
      if (options.endDate && m.date > options.endDate) return false;
      return true;
    });

    // Ordina in modo strettamente cronologico e deterministico
    candidates = sortMatchesChronologically(candidates);

    // Limite di sicurezza per il primo rilascio
    if (candidates.length > 10000) {
      candidates = candidates.slice(0, 10000);
    }

    run.totalCandidateMatches = candidates.length;
    await saveBacktestRun(run);

    // Recupera la lista dei risultati già salvati per evitare duplicazioni (Ripresa di un run interrotto)
    const existingResults = await getBacktestResultsPage(runId, 1, 1000000);
    const existingIds = new Set(existingResults.map(r => r.id));

    let processedMatchesCount = run.processedMatches;
    let evaluatedPredictionsCount = run.evaluatedPredictions;
    let skippedMatchesCount = run.skippedMatches;

    // Ripartiamo dal match index successivo a quello memorizzato
    const startIndex = run.lastProcessedMatchIndex >= 0 ? run.lastProcessedMatchIndex + 1 : 0;
    
    let batchResults: BacktestMatchResult[] = [];

    for (let i = startIndex; i < candidates.length; i++) {
      // 1. Controlla pausa e annullamento prima di elaborare la partita corrente
      const cancelled = await checkPauseAndCancel(isPaused, isCancelled);
      if (cancelled) {
        if (batchResults.length > 0) {
          try {
            await saveBacktestResults(batchResults);
          } catch (dbErr) {
            console.error('Errore nel salvataggio dei risultati parziali durante cancellazione:', dbErr);
          }
        }
        run.processedMatches = processedMatchesCount;
        run.evaluatedPredictions = evaluatedPredictionsCount;
        run.skippedMatches = skippedMatchesCount;
        if (i > startIndex) {
          run.lastProcessedMatchIndex = i - 1;
          run.lastProcessedDate = candidates[i - 1].date;
        }
        run.status = 'cancelled';
        await saveBacktestRun(run);
        return run;
      }

      const currentMatch = candidates[i];

      // Protezione data leakage: passa soltanto le partite con data STRETTAMENTE precedente
      const historicalBefore = allCompMatches.filter(m => m.date < currentMatch.date);

      // Calcola le statistiche per recuperare dataCoverageScore e conteggi
      const stats = calculateTeamStatistics(
        historicalBefore,
        currentMatch.homeTeam,
        currentMatch.awayTeam,
        currentMatch.competition,
        currentMatch.date,
        {
          lastMatches: options.lastMatches,
          timeDecayEnabled: options.timeDecayEnabled,
          timeDecayRate: options.timeDecayRate
        }
      );

      // Calcola l'input del modello
      const modelInputResult = buildModelInputFromHistoricalData(
        historicalBefore,
        currentMatch.homeTeam,
        currentMatch.awayTeam,
        currentMatch.competition,
        currentMatch.date,
        {
          minimumMatches: options.minimumMatches,
          lastMatches: options.lastMatches,
          timeDecayEnabled: options.timeDecayEnabled,
          timeDecayRate: options.timeDecayRate
        }
      );

      const activeModels = options.modelIds
        .map(id => getModelById(id))
        .filter(m => m && m.status === 'active');

      for (const model of activeModels) {
        const modelVersion = getModelVersion(model.id);
        const resultId = `${runId}_${currentMatch.id}_${model.id}_${modelVersion}`;
        
        // Evita risultati duplicati
        if (existingIds.has(resultId)) {
          continue;
        }

        if (!modelInputResult.isReady) {
          // Dati insufficienti
          skippedMatchesCount++;
          if (options.includeInsufficientDataMatches) {
            const skippedResult: BacktestMatchResult = {
              id: resultId,
              runId,
              historicalMatchId: currentMatch.id,
              date: currentMatch.date,
              competition: currentMatch.competition,
              homeTeam: currentMatch.homeTeam,
              awayTeam: currentMatch.awayTeam,
              modelId: model.id,
              modelName: model.name,
              modelVersion: modelVersion,
              actualHomeGoals: currentMatch.homeGoals,
              actualAwayGoals: currentMatch.awayGoals,
              actualOutcome: getOutcome(currentMatch.homeGoals, currentMatch.awayGoals),
              predictedOutcome: 'DRAW',
              probHomeWin: 0,
              probDraw: 0,
              probAwayWin: 0,
              homeExpectedGoals: 0,
              awayExpectedGoals: 0,
              correct1X2: false,
              correctExactScore: false,
              brierScore: 0,
              logLoss: 0,
              probabilityAssignedToActualOutcome: 0,
              absoluteHomeGoalsError: 0,
              absoluteAwayGoalsError: 0,
              totalGoalsAbsoluteError: 0,
              dataCoverageScore: stats.dataCoverageScore,
              homeHistoricalMatches: stats.homeTeamHomeMatches,
              awayHistoricalMatches: stats.awayTeamAwayMatches,
              skipped: true,
              skipReason: modelInputResult.errors.join(' | ')
            };
            batchResults.push(skippedResult);
          }
        } else {
          try {
            // Flusso obbligatorio: HistoricalMatch -> ModelInput -> FootballDataEngine -> MatchFeatures -> modello
            const engine = new FootballDataEngine();
            engine.loadManualInput(modelInputResult.modelInput);
            
            const validation = engine.validate();
            if (!validation.isValid) {
              skippedMatchesCount++;
              if (options.includeInsufficientDataMatches) {
                const skippedResult: BacktestMatchResult = {
                  id: resultId,
                  runId,
                  historicalMatchId: currentMatch.id,
                  date: currentMatch.date,
                  competition: currentMatch.competition,
                  homeTeam: currentMatch.homeTeam,
                  awayTeam: currentMatch.awayTeam,
                  modelId: model.id,
                  modelName: model.name,
                  modelVersion: modelVersion,
                  actualHomeGoals: currentMatch.homeGoals,
                  actualAwayGoals: currentMatch.awayGoals,
                  actualOutcome: getOutcome(currentMatch.homeGoals, currentMatch.awayGoals),
                  predictedOutcome: 'DRAW',
                  probHomeWin: 0,
                  probDraw: 0,
                  probAwayWin: 0,
                  homeExpectedGoals: 0,
                  awayExpectedGoals: 0,
                  correct1X2: false,
                  correctExactScore: false,
                  brierScore: 0,
                  logLoss: 0,
                  probabilityAssignedToActualOutcome: 0,
                  absoluteHomeGoalsError: 0,
                  absoluteAwayGoalsError: 0,
                  totalGoalsAbsoluteError: 0,
                  dataCoverageScore: stats.dataCoverageScore,
                  homeHistoricalMatches: stats.homeTeamHomeMatches,
                  awayHistoricalMatches: stats.awayTeamAwayMatches,
                  skipped: true,
                  skipReason: `Dati non validi nel Football Data Engine: ${Object.values(validation.errors).join('; ')}`
                };
                batchResults.push(skippedResult);
              }
            } else {
              const features = engine.getFeatures();
              if (!features) {
                throw new Error('Impossibile estrarre le features dal Football Data Engine.');
              }

              // Invocazione modello
              const resultPrediction = model.calculate(features);

              // Valutazione mediante PerformanceEngine
              const savedPrediction: SavedPrediction = {
                id: resultId,
                dateTime: currentMatch.date,
                input: modelInputResult.modelInput!,
                result: resultPrediction
              };

              const actualResult: ActualMatchResult = {
                homeGoals: currentMatch.homeGoals,
                awayGoals: currentMatch.awayGoals,
                outcome: getOutcome(currentMatch.homeGoals, currentMatch.awayGoals),
                recordedAt: new Date().toISOString()
              };

              const evalResult = evaluatePrediction(savedPrediction, actualResult);

              const matchResult: BacktestMatchResult = {
                id: resultId,
                runId,
                historicalMatchId: currentMatch.id,
                date: currentMatch.date,
                competition: currentMatch.competition,
                homeTeam: currentMatch.homeTeam,
                awayTeam: currentMatch.awayTeam,
                modelId: model.id,
                modelName: model.name,
                modelVersion: modelVersion,
                actualHomeGoals: currentMatch.homeGoals,
                actualAwayGoals: currentMatch.awayGoals,
                actualOutcome: evalResult.actualOutcome,
                predictedOutcome: evalResult.predictedOutcome,
                probHomeWin: resultPrediction.probHomeWin,
                probDraw: resultPrediction.probDraw,
                probAwayWin: resultPrediction.probAwayWin,
                homeExpectedGoals: resultPrediction.homeExpectedGoals,
                awayExpectedGoals: resultPrediction.awayExpectedGoals,
                correct1X2: evalResult.correct1X2,
                correctExactScore: evalResult.correctExactScore,
                brierScore: evalResult.brierScore,
                logLoss: evalResult.logLoss,
                probabilityAssignedToActualOutcome: evalResult.probabilityAssignedToActualOutcome,
                absoluteHomeGoalsError: evalResult.absoluteHomeGoalsError,
                absoluteAwayGoalsError: evalResult.absoluteAwayGoalsError,
                totalGoalsAbsoluteError: evalResult.totalGoalsAbsoluteError,
                topExactScore: resultPrediction.exactScores && resultPrediction.exactScores.length > 0
                  ? resultPrediction.exactScores[0].score
                  : undefined,
                dataCoverageScore: stats.dataCoverageScore,
                homeHistoricalMatches: stats.homeTeamHomeMatches,
                awayHistoricalMatches: stats.awayTeamAwayMatches,
                skipped: false
              };

              batchResults.push(matchResult);
              evaluatedPredictionsCount++;
            }
          } catch (modelErr: any) {
            // Errore isolato di un singolo modello: non interrompere tutto il backtest
            skippedMatchesCount++;
            if (options.includeInsufficientDataMatches) {
              const skippedResult: BacktestMatchResult = {
                id: resultId,
                runId,
                historicalMatchId: currentMatch.id,
                date: currentMatch.date,
                competition: currentMatch.competition,
                homeTeam: currentMatch.homeTeam,
                awayTeam: currentMatch.awayTeam,
                modelId: model.id,
                modelName: model.name,
                modelVersion: modelVersion,
                actualHomeGoals: currentMatch.homeGoals,
                actualAwayGoals: currentMatch.awayGoals,
                actualOutcome: getOutcome(currentMatch.homeGoals, currentMatch.awayGoals),
                predictedOutcome: 'DRAW',
                probHomeWin: 0,
                probDraw: 0,
                probAwayWin: 0,
                homeExpectedGoals: 0,
                awayExpectedGoals: 0,
                correct1X2: false,
                correctExactScore: false,
                brierScore: 0,
                logLoss: 0,
                probabilityAssignedToActualOutcome: 0,
                absoluteHomeGoalsError: 0,
                absoluteAwayGoalsError: 0,
                totalGoalsAbsoluteError: 0,
                dataCoverageScore: stats.dataCoverageScore,
                homeHistoricalMatches: stats.homeTeamHomeMatches,
                awayHistoricalMatches: stats.awayTeamAwayMatches,
                skipped: true,
                skipReason: `Errore calcolo modello: ${modelErr.message || modelErr}`
              };
              batchResults.push(skippedResult);
            }
          }
        }
      }

      processedMatchesCount++;

      // Elabora massimo batchSize partite per blocco
      const isLastMatch = i === candidates.length - 1;
      const isBatchEnd = (processedMatchesCount % options.batchSize === 0) || isLastMatch;

      if (isBatchEnd) {
        let savedResults: BacktestMatchResult[] = [];
        if (batchResults.length > 0) {
          try {
            await saveBacktestResults(batchResults);
            savedResults = [...batchResults];
            batchResults = [];
          } catch (dbErr: any) {
            // Se IndexedDB fallisce, imposta status failed, conserva errore e non lasciare running
            run.status = 'failed';
            run.error = `Errore di scrittura in IndexedDB: ${dbErr.message || dbErr}`;
            await saveBacktestRun(run);
            throw dbErr;
          }
        }

        // Salvare il checkpoint anche se batchResults è vuoto
        run.processedMatches = processedMatchesCount;
        run.evaluatedPredictions = evaluatedPredictionsCount;
        run.skippedMatches = skippedMatchesCount;
        run.lastProcessedMatchIndex = i;
        run.lastProcessedDate = currentMatch.date;

        if (isLastMatch) {
          run.status = 'completed';
          run.completedAt = new Date().toISOString();
        }

        await saveBacktestRun(run);

        // Passare a onBatchCompleted i risultati realmente salvati
        if (onBatchCompleted) {
          await onBatchCompleted(savedResults, run);
        }
      }

      // Notifica progresso reale
      const progressPercent = candidates.length > 0 ? Math.min(100, Math.round((processedMatchesCount / candidates.length) * 100)) : 100;
      onProgress({
        processedMatches: processedMatchesCount,
        totalCandidateMatches: candidates.length,
        evaluatedPredictions: evaluatedPredictionsCount,
        skippedMatches: skippedMatchesCount,
        progressPercent,
        currentDate: currentMatch.date,
        currentMatch: `${currentMatch.homeTeam} vs ${currentMatch.awayTeam}`
      });

      // Rilascia il thread principale per l'interfaccia utente (non bloccante)
      if (isBatchEnd) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (processedMatchesCount === candidates.length) {
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      await saveBacktestRun(run);
    }

    return run;
  } catch (err: any) {
    run.status = 'failed';
    run.error = err.message || String(err);
    await saveBacktestRun(run);
    throw err;
  }
}
