/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchOutcome, SavedPrediction, ActualMatchResult, PredictionResult, PredictionEvaluation } from '../types';
import { getOutcome, getPredictedOutcome, evaluatePrediction } from './PerformanceEngine';
import { aggregateModelPerformance } from './PerformanceAggregator';
import { migrateSavedPrediction } from '../poissonEngine'; // or wherever migrateSavedPrediction is

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runPerformanceValidation(): TestResult[] {
  const results: TestResult[] = [];

  // ==========================================
  // TEST A — Outcome
  // ==========================================
  try {
    const r1 = getOutcome(2, 1);
    const r2 = getOutcome(1, 1);
    const r3 = getOutcome(0, 3);

    const passed = r1 === 'HOME' && r2 === 'DRAW' && r3 === 'AWAY';
    results.push({
      name: 'TEST A: Calcolo corretto dell\'esito del match',
      passed,
      message: passed
        ? `Successo: 2-1 -> ${r1}, 1-1 -> ${r2}, 0-3 -> ${r3}`
        : `Fallimento: 2-1 -> ${r1}, 1-1 -> ${r2}, 0-3 -> ${r3}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST A: Calcolo corretto dell\'esito del match',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // Helper template for mock prediction result
  const createMockResult = (probHome: number, probDraw: number, probAway: number, topScore = '1-0'): PredictionResult => {
    return {
      homeExpectedGoals: 1.5,
      awayExpectedGoals: 0.8,
      probHomeWin: probHome,
      probDraw: probDraw,
      probAwayWin: probAway,
      over15: 50,
      over25: 30,
      over35: 10,
      under25: 70,
      goal: 45,
      noGoal: 55,
      scoreMatrix: [],
      exactScores: [
        { score: topScore, homeGoals: Number(topScore.split('-')[0]), awayGoals: Number(topScore.split('-')[1]), probability: 15 },
        { score: '0-0', homeGoals: 0, awayGoals: 0, probability: 12 }
      ],
      modelId: 'mock-model',
      modelName: 'Mock Model',
      modelVersion: '1.0.0',
      calculationDiagnostics: { gridProbabilityMass: 1, residualProbabilityMass: 0, calculationLimit: 6 },
      uncertainty: { entropy: 0.5, uncertaintyIndex: 50, dataQuality: 80, solidityIndex: 70, classification: 'Incertezza Moderata' }
    };
  };

  // Helper template for saved prediction
  const createSavedPrediction = (id: string, result: PredictionResult): SavedPrediction => {
    return {
      id,
      dateTime: new Date().toISOString(),
      input: {
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        homeScoredAvg: 1.5,
        homeConcededAvg: 1.0,
        awayScoredAvg: 1.0,
        awayConcededAvg: 1.5,
        leagueHomeScoredAvg: 1.2,
        leagueAwayScoredAvg: 1.2,
        matchesPlayed: 10,
        homeAdvantage: 0
      },
      result
    };
  };

  // ==========================================
  // TEST B — Pronostico corretto
  // ==========================================
  try {
    const res = createMockResult(60, 25, 15, '2-0');
    const pred = createSavedPrediction('pred-b', res);
    const actual: ActualMatchResult = {
      homeGoals: 2,
      awayGoals: 0,
      outcome: 'HOME',
      recordedAt: new Date().toISOString()
    };

    const evaluation = evaluatePrediction(pred, actual);
    const passed = evaluation.predictedOutcome === 'HOME' &&
                   evaluation.actualOutcome === 'HOME' &&
                   evaluation.correct1X2 === true &&
                   Math.abs(evaluation.probabilityAssignedToActualOutcome - 0.6) < 1e-9;

    results.push({
      name: 'TEST B: Valutazione pronostico corretto (HOME)',
      passed,
      message: passed
        ? `Successo: Previsto ${evaluation.predictedOutcome}, Effettivo ${evaluation.actualOutcome}, Corretto ${evaluation.correct1X2}, Probabilità assegnata ${evaluation.probabilityAssignedToActualOutcome}`
        : `Fallimento: prev=${evaluation.predictedOutcome}, eff=${evaluation.actualOutcome}, corr=${evaluation.correct1X2}, prob=${evaluation.probabilityAssignedToActualOutcome}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST B: Valutazione pronostico corretto (HOME)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // ==========================================
  // TEST C — Pronostico errato
  // ==========================================
  try {
    const res = createMockResult(70, 20, 10, '2-0');
    const pred = createSavedPrediction('pred-c', res);
    const actual: ActualMatchResult = {
      homeGoals: 0,
      awayGoals: 1,
      outcome: 'AWAY',
      recordedAt: new Date().toISOString()
    };

    const evaluation = evaluatePrediction(pred, actual);
    
    // Brier Score atteso: (0.7 - 0)^2 + (0.2 - 0)^2 + (0.1 - 1)^2 = 0.49 + 0.04 + 0.81 = 1.34
    const expectedBrier = 1.34;
    const diffBrier = Math.abs(evaluation.brierScore - expectedBrier);

    // Log Loss atteso: -ln(0.10) ~= 2.302585
    const expectedLogLoss = -Math.log(0.10);
    const diffLogLoss = Math.abs(evaluation.logLoss - expectedLogLoss);

    const passed = evaluation.correct1X2 === false && diffBrier < 0.001 && diffLogLoss < 0.001;

    results.push({
      name: 'TEST C: Valutazione pronostico errato (AWAY)',
      passed,
      message: passed
        ? `Successo: Corretto1X2=${evaluation.correct1X2}, Brier=${evaluation.brierScore.toFixed(4)} (atteso ${expectedBrier}), LogLoss=${evaluation.logLoss.toFixed(4)} (atteso ${expectedLogLoss.toFixed(4)})`
        : `Fallimento: corr=${evaluation.correct1X2}, Brier=${evaluation.brierScore} (atteso ${expectedBrier}), LogLoss=${evaluation.logLoss} (atteso ${expectedLogLoss})`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST C: Valutazione pronostico errato (AWAY)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // ==========================================
  // TEST D — Brier perfetto
  // ==========================================
  try {
    const res = createMockResult(100, 0, 0);
    const pred = createSavedPrediction('pred-d', res);
    const actual: ActualMatchResult = {
      homeGoals: 1,
      awayGoals: 0,
      outcome: 'HOME',
      recordedAt: new Date().toISOString()
    };

    const evaluation = evaluatePrediction(pred, actual);
    const passed = Math.abs(evaluation.brierScore) < 1e-12;

    results.push({
      name: 'TEST D: Brier score perfetto (0.0)',
      passed,
      message: passed
        ? `Successo: Brier score = ${evaluation.brierScore}`
        : `Fallimento: Brier score = ${evaluation.brierScore} anziché 0`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST D: Brier score perfetto (0.0)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // ==========================================
  // TEST E — Log Loss sicurezza numerica
  // ==========================================
  try {
    const res = createMockResult(0, 100, 0); // probHomeWin = 0
    const pred = createSavedPrediction('pred-e', res);
    const actual: ActualMatchResult = {
      homeGoals: 2,
      awayGoals: 1,
      outcome: 'HOME',
      recordedAt: new Date().toISOString()
    };

    const evaluation = evaluatePrediction(pred, actual);
    const passed = isFinite(evaluation.logLoss) && !isNaN(evaluation.logLoss) && evaluation.logLoss > 0;

    results.push({
      name: 'TEST E: Sicurezza numerica Log Loss (probabilità 0%)',
      passed,
      message: passed
        ? `Successo: Log Loss con probabilità 0% è finito, non NaN, e vale: ${evaluation.logLoss.toFixed(4)}`
        : `Fallimento: Log Loss non finito o errato. Valore: ${evaluation.logLoss}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST E: Sicurezza numerica Log Loss (probabilità 0%)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // ==========================================
  // TEST F — Risultato esatto
  // ==========================================
  try {
    const res = createMockResult(50, 30, 20, '1-0');
    const pred = createSavedPrediction('pred-f', res);

    const actualCorretto: ActualMatchResult = {
      homeGoals: 1,
      awayGoals: 0,
      outcome: 'HOME',
      recordedAt: new Date().toISOString()
    };

    const actualErrato: ActualMatchResult = {
      homeGoals: 2,
      awayGoals: 0,
      outcome: 'HOME',
      recordedAt: new Date().toISOString()
    };

    const evCorr = evaluatePrediction(pred, actualCorretto);
    const evErr = evaluatePrediction(pred, actualErrato);

    const passed = evCorr.correctExactScore === true && evErr.correctExactScore === false;

    results.push({
      name: 'TEST F: Valutazione esattezza risultato esatto (primo in lista)',
      passed,
      message: passed
        ? `Successo: Risultato corretto 1-0 -> ${evCorr.correctExactScore}, Risultato errato 2-0 -> ${evErr.correctExactScore}`
        : `Fallimento: corr=${evCorr.correctExactScore}, err=${evErr.correctExactScore}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST F: Valutazione esattezza risultato esatto (primo in lista)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // ==========================================
  // TEST G — Aggregazione
  // ==========================================
  try {
    // Creiamo due modelli con due predizioni valutate ciascuno
    const m1_r1 = createMockResult(60, 20, 20);
    const m1_r2 = createMockResult(40, 40, 20);
    m1_r1.modelId = 'model-1';
    m1_r1.modelName = 'Model One';
    m1_r2.modelId = 'model-1';
    m1_r2.modelName = 'Model One';

    const m2_r1 = createMockResult(20, 20, 60);
    const m2_r2 = createMockResult(30, 30, 40);
    m2_r1.modelId = 'model-2';
    m2_r1.modelName = 'Model Two';
    m2_r2.modelId = 'model-2';
    m2_r2.modelName = 'Model Two';

    const p1 = createSavedPrediction('p1', m1_r1);
    const p2 = createSavedPrediction('p2', m1_r2);
    const p3 = createSavedPrediction('p3', m2_r1);
    const p4 = createSavedPrediction('p4', m2_r2);

    const act1: ActualMatchResult = { homeGoals: 2, awayGoals: 1, outcome: 'HOME', recordedAt: new Date().toISOString() }; // HOME
    const act2: ActualMatchResult = { homeGoals: 1, awayGoals: 1, outcome: 'DRAW', recordedAt: new Date().toISOString() }; // DRAW
    const act3: ActualMatchResult = { homeGoals: 0, awayGoals: 2, outcome: 'AWAY', recordedAt: new Date().toISOString() }; // AWAY
    const act4: ActualMatchResult = { homeGoals: 1, awayGoals: 0, outcome: 'HOME', recordedAt: new Date().toISOString() }; // HOME

    p1.actualResult = act1;
    p1.evaluation = evaluatePrediction(p1, act1); // p1 predicted outcome HOME, actual HOME. Correct.

    p2.actualResult = act2;
    p2.evaluation = evaluatePrediction(p2, act2); // p2 predicted outcome DRAW (40 === max), actual DRAW. Correct.

    p3.actualResult = act3;
    p3.evaluation = evaluatePrediction(p3, act3); // p3 predicted outcome AWAY (60 === max), actual AWAY. Correct.

    p4.actualResult = act4;
    p4.evaluation = evaluatePrediction(p4, act4); // p4 predicted outcome AWAY (40 === max), actual HOME. Incorrect.

    const allPredictions = [p1, p2, p3, p4];
    const summaries = aggregateModelPerformance(allPredictions);

    const s1 = summaries.find(s => s.modelId === 'model-1');
    const s2 = summaries.find(s => s.modelId === 'model-2');

    const passed = summaries.length === 2 &&
                   s1 !== undefined && s2 !== undefined &&
                   s1.evaluatedPredictions === 2 &&
                   s1.correct1X2Count === 2 &&
                   s1.accuracy1X2 === 100 &&
                   s2.evaluatedPredictions === 2 &&
                   s2.correct1X2Count === 1 &&
                   s2.accuracy1X2 === 50 &&
                   !isNaN(s1.averageBrierScore) && !isNaN(s2.averageLogLoss);

    results.push({
      name: 'TEST G: Aggregazione performance per modello e versione',
      passed,
      message: passed
        ? `Successo: Aggregazione completata. Modello 1 (N=2, Acc=100%), Modello 2 (N=2, Acc=50%)`
        : `Fallimento: summaries.len=${summaries.length}, s1.Acc=${s1?.accuracy1X2}, s2.Acc=${s2?.accuracy1X2}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST G: Aggregazione performance per modello e versione',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // ==========================================
  // TEST H — Migrazione
  // ==========================================
  try {
    // Un vecchio record senza alcun risultato
    const oldRaw: any = {
      id: 'old-1',
      dateTime: new Date().toISOString(),
      input: { homeTeam: 'Milan', awayTeam: 'Inter', matchesPlayed: 15 },
      result: { modelId: 'poisson-standard', probHomeWin: 50, probDraw: 30, probAwayWin: 20, homeExpectedGoals: 1.5, awayExpectedGoals: 1.0, exactScores: [{ score: '1-0', homeGoals: 1, awayGoals: 0, probability: 15 }] }
    };

    // Un record con actualResult ma senza evaluation
    const actualResultMock: ActualMatchResult = {
      homeGoals: 1,
      awayGoals: 0,
      outcome: 'HOME',
      recordedAt: new Date().toISOString()
    };
    const partRaw: any = {
      id: 'part-1',
      dateTime: new Date().toISOString(),
      input: { homeTeam: 'Milan', awayTeam: 'Inter', matchesPlayed: 15 },
      result: { modelId: 'poisson-standard', probHomeWin: 50, probDraw: 30, probAwayWin: 20, homeExpectedGoals: 1.5, awayExpectedGoals: 1.0, exactScores: [{ score: '1-0', homeGoals: 1, awayGoals: 0, probability: 15 }] },
      actualResult: actualResultMock
    };

    // Un record già valutato con evaluation completa
    const evalMock: PredictionEvaluation = {
      modelId: 'poisson-standard',
      modelName: 'Poisson Standard',
      modelVersion: '1.1.0',
      predictedOutcome: 'HOME',
      actualOutcome: 'HOME',
      correct1X2: true,
      correctExactScore: true,
      brierScore: 0.1,
      logLoss: 0.2,
      probabilityAssignedToActualOutcome: 50,
      predictedHomeGoals: 1.5,
      predictedAwayGoals: 1.0,
      actualHomeGoals: 1,
      actualAwayGoals: 0,
      absoluteHomeGoalsError: 0.5,
      absoluteAwayGoalsError: 1.0,
      totalGoalsAbsoluteError: 0.5,
      evaluatedAt: new Date().toISOString()
    };
    const fullRaw: any = {
      id: 'full-1',
      dateTime: new Date().toISOString(),
      input: { homeTeam: 'Milan', awayTeam: 'Inter', matchesPlayed: 15 },
      result: { modelId: 'poisson-standard', probHomeWin: 50, probDraw: 30, probAwayWin: 20, homeExpectedGoals: 1.5, awayExpectedGoals: 1.0, exactScores: [{ score: '1-0', homeGoals: 1, awayGoals: 0, probability: 15 }] },
      actualResult: actualResultMock,
      evaluation: evalMock
    };

    const migratedOld = migrateSavedPrediction(oldRaw);
    const migratedPart = migrateSavedPrediction(partRaw);
    const migratedFull = migrateSavedPrediction(fullRaw);

    const passed = migratedOld.actualResult === undefined &&
                   migratedOld.evaluation === undefined &&
                   migratedPart.actualResult !== undefined &&
                   migratedPart.evaluation !== undefined && // Dovrebbe essere ricalcolata in modo sicuro
                   migratedPart.evaluation?.correct1X2 === true &&
                   migratedPart.evaluation?.correctExactScore === true &&
                   migratedFull.actualResult !== undefined &&
                   migratedFull.evaluation !== undefined &&
                   Math.abs((migratedFull.evaluation?.brierScore || 0) - 0.38) < 1e-9;

    results.push({
      name: 'TEST H: Migrazione record e ricalcolo di valutazioni mancanti',
      passed,
      message: passed
        ? `Successo: Migrazione completata correttamente per vecchi record, parziali e completi.`
        : `Fallimento: migratedOld.actualResult=${migratedOld.actualResult}, migratedPart.evaluation=${migratedPart.evaluation}, migratedFull.evaluation.Brier=${migratedFull.evaluation?.brierScore}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST H: Migrazione record e ricalcolo di valutazioni mancanti',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // ==========================================
  // TEST I — Rigorous validations for invalid records and migration
  // ==========================================
  try {
    // 1. evaluation con NaN deve essere ignorata;
    // 2. evaluation con Infinity deve essere ignorata;
    // 3. evaluation con Brier 2.1 deve essere ignorata;
    // 4. evaluation con probabilityAssignedToActualOutcome 1.1 deve essere ignorata;
    // 5. evaluatedPredictions deve contare soltanto record validi;
    const baseMock = createMockResult(50, 30, 20);
    const validPred = createSavedPrediction('valid-1', baseMock);
    validPred.evaluation = {
      modelId: 'mock-model',
      modelName: 'Mock Model',
      modelVersion: '1.0.0',
      predictedOutcome: 'HOME',
      actualOutcome: 'HOME',
      correct1X2: true,
      correctExactScore: true,
      brierScore: 0.1,
      logLoss: 0.2,
      probabilityAssignedToActualOutcome: 0.5,
      predictedHomeGoals: 1,
      predictedAwayGoals: 0,
      actualHomeGoals: 1,
      actualAwayGoals: 0,
      absoluteHomeGoalsError: 0,
      absoluteAwayGoalsError: 0,
      totalGoalsAbsoluteError: 0,
      evaluatedAt: new Date().toISOString()
    };

    const nanPred = createSavedPrediction('nan-1', baseMock);
    nanPred.evaluation = { ...validPred.evaluation, brierScore: NaN };

    const infPred = createSavedPrediction('inf-1', baseMock);
    infPred.evaluation = { ...validPred.evaluation, logLoss: Infinity };

    const brierOutPred = createSavedPrediction('brier-out-1', baseMock);
    brierOutPred.evaluation = { ...validPred.evaluation, brierScore: 2.1 };

    const probOutPred = createSavedPrediction('prob-out-1', baseMock);
    probOutPred.evaluation = { ...validPred.evaluation, probabilityAssignedToActualOutcome: 1.1 };

    const aggregated = aggregateModelPerformance([validPred, nanPred, infPred, brierOutPred, probOutPred]);
    const mockModelSummary = aggregated.find(s => s.modelId === 'mock-model');
    const correctCount = mockModelSummary ? mockModelSummary.evaluatedPredictions === 1 : false;

    // 6. risultato reale con gol 2.5 deve essere rifiutato;
    const decimalGoalsRaw: any = {
      id: 'decimal-1',
      dateTime: new Date().toISOString(),
      input: validPred.input,
      result: baseMock,
      actualResult: {
        homeGoals: 2.5,
        awayGoals: 0,
        outcome: 'HOME',
        recordedAt: new Date().toISOString()
      }
    };
    const migratedDecimal = migrateSavedPrediction(decimalGoalsRaw);
    const rejectedDecimal = migratedDecimal.actualResult === undefined;

    // 7. risultato 2-0 con outcome importato AWAY deve essere migrato come HOME.
    const wrongOutcomeRaw: any = {
      id: 'wrong-outcome-1',
      dateTime: new Date().toISOString(),
      input: validPred.input,
      result: baseMock,
      actualResult: {
        homeGoals: 2,
        awayGoals: 0,
        outcome: 'AWAY',
        recordedAt: new Date().toISOString()
      }
    };
    const migratedWrongOutcome = migrateSavedPrediction(wrongOutcomeRaw);
    const correctedOutcome = migratedWrongOutcome.actualResult?.outcome === 'HOME';

    const passed = correctCount && rejectedDecimal && correctedOutcome;

    results.push({
      name: 'TEST I: Validità record, rifiuto decimali e forzatura outcome corretto',
      passed,
      message: passed
        ? `Successo: Record invalidi ignorati (${aggregated[0]?.evaluatedPredictions || 0} validi su 5), 2.5 gol rifiutato, outcome 2-0 AWAY corretto in HOME.`
        : `Fallimento: correctCount=${correctCount} (num_evaluated=${mockModelSummary?.evaluatedPredictions}), rejectedDecimal=${rejectedDecimal}, correctedOutcome=${correctedOutcome}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST I: Validità record, rifiuto decimali e forzatura outcome corretto',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  return results;
}
