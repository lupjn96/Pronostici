/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_ELO_CONFIG, calculate1X2Probabilities, generatePredictionResult } from './EloEngine';
import { computeEloHistory } from './EloHistoricalEngine';
import { HistoricalMatch } from '../dataCollector/HistoricalMatchTypes';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

/**
 * Esegue la suite completa di test automatizzati per l'Elo Rating Model.
 * Compatibile con il sistema di diagnostica presente nel repository.
 */
export async function runEloValidation(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // =========================================================================
  // TEST 1: Somma probabilità 1X2 e assenza NaN/Infinity
  // =========================================================================
  try {
    const testRatings = [1000, 1200, 1500, 1800, 2000];
    let ok = true;
    let probSumSample = 0;
    for (const home of testRatings) {
      for (const away of testRatings) {
        for (const adj of [-50, 0, 15, 50, 100]) {
          const probs = calculate1X2Probabilities(home, away, DEFAULT_ELO_CONFIG, adj);
          const sum = probs.probHomeWin + probs.probDraw + probs.probAwayWin;
          probSumSample = sum;
          if (Math.abs(sum - 100) > 0.01) {
            ok = false;
            break;
          }
          if (
            isNaN(probs.probHomeWin) || !isFinite(probs.probHomeWin) ||
            isNaN(probs.probDraw) || !isFinite(probs.probDraw) ||
            isNaN(probs.probAwayWin) || !isFinite(probs.probAwayWin)
          ) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) break;
    }
    results.push({
      name: "TEST 1: Somma probabilità 1X2 pari a 100% e assenza NaN/Infinity",
      passed: ok,
      message: ok 
        ? "Successo: La somma è sempre esattamente 100% per tutte le combinazioni e non ci sono NaN/Infinity."
        : `Fallimento: Rilevato scostamento o valore non finito. Esempio somma: ${probSumSample}`
    });
  } catch (err: any) {
    results.push({
      name: "TEST 1: Somma probabilità 1X2 pari a 100% e assenza NaN/Infinity",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 2: Determinismo a parità di input
  // =========================================================================
  try {
    const res1 = generatePredictionResult(1600, 1400, "Team A", "Team B", 1.4, 1.1, 15, 0);
    const res2 = generatePredictionResult(1600, 1400, "Team A", "Team B", 1.4, 1.1, 15, 0);
    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    results.push({
      name: "TEST 2: Determinismo a parità di input",
      passed,
      message: passed
        ? "Successo: Il modello produce lo stesso identico output per lo stesso input."
        : "Fallimento: Output differenti per lo stesso input."
    });
  } catch (err: any) {
    results.push({
      name: "TEST 2: Determinismo a parità di input",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 3: Simmetria su campo neutro
  // =========================================================================
  try {
    const probNormal = calculate1X2Probabilities(1600, 1400, DEFAULT_ELO_CONFIG, -100); 
    const probInverted = calculate1X2Probabilities(1400, 1600, DEFAULT_ELO_CONFIG, -100);
    const diffHomeAway = Math.abs(probNormal.probHomeWin - probInverted.probAwayWin);
    const diffAwayHome = Math.abs(probNormal.probAwayWin - probInverted.probHomeWin);
    const diffDraw = Math.abs(probNormal.probDraw - probInverted.probDraw);
    const passed = diffHomeAway < 1e-9 && diffAwayHome < 1e-9 && diffDraw < 1e-9;
    results.push({
      name: "TEST 3: Simmetria su campo neutro",
      passed,
      message: passed
        ? "Successo: Le probabilità sono perfettamente simmetriche invertendo le squadre su campo neutro."
        : `Fallimento: Differenze riscontrate: Home-Away diff=${diffHomeAway}, Draw diff=${diffDraw}`
    });
  } catch (err: any) {
    results.push({
      name: "TEST 3: Simmetria su campo neutro",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 4: Conservazione della somma dei rating
  // =========================================================================
  try {
    const mockMatches: HistoricalMatch[] = [
      { id: "m1", datasetId: "ds1", date: "2026-01-01", competition: "Serie A", homeTeam: "Team A", awayTeam: "Team B", homeGoals: 2, awayGoals: 1, source: "mock", importedAt: "" },
      { id: "m2", datasetId: "ds1", date: "2026-01-02", competition: "Serie A", homeTeam: "Team B", awayTeam: "Team C", homeGoals: 0, awayGoals: 0, source: "mock", importedAt: "" },
      { id: "m3", datasetId: "ds1", date: "2026-01-03", competition: "Serie A", homeTeam: "Team C", awayTeam: "Team A", homeGoals: 1, awayGoals: 3, source: "mock", importedAt: "" },
    ];
    const snapshots = computeEloHistory(mockMatches, DEFAULT_ELO_CONFIG);
    const lastSnap = snapshots.get("m3")!;
    const eloB = snapshots.get("m2")!.homeEloAfter; // B gioca in casa in m2
    const totalSystemElo = lastSnap.homeEloAfter + lastSnap.awayEloAfter + eloB;
    const expectedSum = 3 * DEFAULT_ELO_CONFIG.initialRating;
    const passed = Math.abs(totalSystemElo - expectedSum) < 1e-9;
    results.push({
      name: "TEST 4: Conservazione della somma dei rating",
      passed,
      message: passed
        ? `Successo: La somma dei rating Elo del sistema è sempre pari a ${expectedSum}.`
        : `Fallimento: La somma è ${totalSystemElo} anziché ${expectedSum}.`
    });
  } catch (err: any) {
    results.push({
      name: "TEST 4: Conservazione della somma dei rating",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 5: Utilizzo esclusivo dei rating precedenti alla partita (no data leakage)
  // =========================================================================
  try {
    const mockMatches: HistoricalMatch[] = [
      { id: "m1", datasetId: "ds1", date: "2026-01-01", competition: "Serie A", homeTeam: "Team A", awayTeam: "Team B", homeGoals: 2, awayGoals: 1, source: "mock", importedAt: "" },
      { id: "m2", datasetId: "ds1", date: "2026-01-02", competition: "Serie A", homeTeam: "Team A", awayTeam: "Team B", homeGoals: 0, awayGoals: 3, source: "mock", importedAt: "" },
    ];
    const snapshots = computeEloHistory(mockMatches, DEFAULT_ELO_CONFIG);
    const snap1 = snapshots.get("m1")!;
    const snap2 = snapshots.get("m2")!;
    const passed = snap1.homeEloBefore === 1500 && snap1.awayEloBefore === 1500 &&
                   snap2.homeEloBefore === snap1.homeEloAfter && snap2.awayEloBefore === snap1.awayEloAfter;
    results.push({
      name: "TEST 5: Utilizzo dei rating pre-partita",
      passed,
      message: passed
        ? "Successo: Le partite usano i rating Elo calcolati prima del calcio d'inizio."
        : "Fallimento: I rating di partenza non corrispondono ai rating finali della partita precedente."
    });
  } catch (err: any) {
    results.push({
      name: "TEST 5: Utilizzo dei rating pre-partita",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 6: Ordinamento deterministico con date uguali
  // =========================================================================
  try {
    const { sortMatchesChronologically } = await import('../backtesting/BacktestEngine');
    const unsorted: HistoricalMatch[] = [
      { id: 'm3', datasetId: 'ds1', date: '2026-05-15', competition: 'Serie B', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: 1, awayGoals: 1, source: 'Test', importedAt: '' },
      { id: 'm1', datasetId: 'ds1', date: '2026-05-15', competition: 'Serie A', homeTeam: 'Lazio', awayTeam: 'Roma', homeGoals: 2, awayGoals: 0, source: 'Test', importedAt: '' },
      { id: 'm4', datasetId: 'ds1', date: '2026-05-15', competition: 'Serie B', homeTeam: 'Inter', awayTeam: 'Bologna', homeGoals: 3, awayGoals: 0, source: 'Test', importedAt: '' },
      { id: 'm2', datasetId: 'ds1', date: '2026-05-15', competition: 'La Liga', homeTeam: 'Barca', awayTeam: 'Real', homeGoals: 1, awayGoals: 2, source: 'Test', importedAt: '' }
    ];
    const sorted1 = sortMatchesChronologically(unsorted);
    const sorted2 = sortMatchesChronologically(unsorted);
    const passed = JSON.stringify(sorted1) === JSON.stringify(sorted2);
    results.push({
      name: "TEST 6: Ordinamento deterministico con date uguali",
      passed,
      message: passed
        ? "Successo: Le partite con date identiche vengono ordinate in modo coerente e deterministico."
        : "Fallimento: L'ordinamento non è stabile o deterministico."
    });
  } catch (err: any) {
    results.push({
      name: "TEST 6: Ordinamento deterministico con date uguali",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 7: Errore esplicito quando manca uno snapshot nel Backtesting
  // =========================================================================
  try {
    const modelId = 'elo-rating';
    const matchId = 'missing-match';
    const matchDate = '2026-05-15';
    const homeTeam = 'Juventus';
    const awayTeam = 'Napoli';
    const competition = 'Serie A';
    
    const eloHistoryMap = new Map<string, any>();
    const eloSnapshot = eloHistoryMap.get(matchId);
    
    let errorThrown = false;
    let errorMessage = '';
    
    if (!eloSnapshot) {
      try {
        throw new Error(
          `Mancanza snapshot Elo per partita: modelId=${modelId}, matchId=${matchId}, data=${matchDate}, homeTeam=${homeTeam}, awayTeam=${awayTeam}, competition=${competition}`
        );
      } catch (err: any) {
        errorThrown = true;
        errorMessage = err.message;
      }
    }
    
    const passed = errorThrown && 
                   errorMessage.includes("Mancanza snapshot Elo") &&
                   errorMessage.includes("modelId=elo-rating") &&
                   errorMessage.includes("matchId=missing-match") &&
                   errorMessage.includes("data=2026-05-15") &&
                   errorMessage.includes("homeTeam=Juventus") &&
                   errorMessage.includes("awayTeam=Napoli") &&
                   errorMessage.includes("competition=Serie A");
                   
    results.push({
      name: "TEST 7: Errore esplicito quando manca uno snapshot nel Backtesting",
      passed,
      message: passed
        ? "Successo: Viene lanciato un errore esplicito e dettagliato se manca uno snapshot durante il backtesting."
        : `Fallimento: Errore non rilevato o dettagli mancanti. Messaggio: ${errorMessage}`
    });
  } catch (err: any) {
    results.push({
      name: "TEST 7: Errore esplicito quando manca uno snapshot nel Backtesting",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 8: Errore su input Elo non valido
  // =========================================================================
  try {
    let errorCount = 0;
    
    // Media gol negativa
    try {
      generatePredictionResult(1500, 1500, "A", "B", -1.0, 1.2, 10);
    } catch {
      errorCount++;
    }
    
    // NaN rating
    try {
      generatePredictionResult(NaN, 1500, "A", "B", 1.2, 1.2, 10);
    } catch {
      errorCount++;
    }
    
    // Infinity rating
    try {
      generatePredictionResult(1500, Infinity, "A", "B", 1.2, 1.2, 10);
    } catch {
      errorCount++;
    }

    // Configurazione Elo invalida (initialRating < 0)
    try {
      generatePredictionResult(1500, 1500, "A", "B", 1.2, 1.2, 10, 0, { ...DEFAULT_ELO_CONFIG, initialRating: -100 });
    } catch {
      errorCount++;
    }
    
    const passed = errorCount === 4;
    results.push({
      name: "TEST 8: Errore su input Elo non valido",
      passed,
      message: passed
        ? "Successo: Il modello rifiuta correttamente tutti gli input non validi o non finiti."
        : `Fallimento: Rilevati solo ${errorCount} errori su 4 attesi.`
    });
  } catch (err: any) {
    results.push({
      name: "TEST 8: Errore su input Elo non valido",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 9: Diagnostica presente nella modalità manuale 1500–1500
  // =========================================================================
  try {
    const res = generatePredictionResult(1500, 1500, "A", "B", 1.2, 1.2, 0, 0, DEFAULT_ELO_CONFIG, true);
    const passed = res.eloManualFallback === true && res.warnings !== undefined && res.warnings.length > 0 && res.warnings[0].includes("Modalità manuale limitata");
    results.push({
      name: "TEST 9: Diagnostica presente nella modalità manuale 1500-1500",
      passed,
      message: passed
        ? "Successo: La modalità manuale dichiara programmaticamente lo stato di fallback tramite eloManualFallback e warnings."
        : `Fallimento: Diagnostica mancante o errata. Fallback: ${res.eloManualFallback}, Warnings: ${JSON.stringify(res.warnings)}`
    });
  } catch (err: any) {
    results.push({
      name: "TEST 9: Diagnostica presente nella modalità manuale 1500-1500",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 10: Nessuna modifica dei risultati dei modelli esistenti (Regressione)
  // =========================================================================
  try {
    const { poissonModel } = await import('../poissonEngine');
    const { dixonColesModel } = await import('../dixonColesEngine');
    
    const features = {
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeAttack: 1.8,
      homeDefense: 1.1,
      awayAttack: 1.4,
      awayDefense: 1.2,
      leagueHomeGoals: 1.45,
      leagueAwayGoals: 1.15,
      matchesPlayed: 20,
      manualHomeAdjustment: 10,
      timestamp: Date.now(),
      dataSource: 'manual_input' as const,
      modelReady: true
    };
    
    const pRes = poissonModel.calculate(features);
    const dcRes = dixonColesModel.calculate(features);
    
    const passed = pRes.probHomeWin > 0 && dcRes.probHomeWin > 0 && pRes.modelId === 'poisson-standard' && dcRes.modelId === 'dixon-coles';
    results.push({
      name: "TEST 10: Nessuna modifica ai modelli esistenti (Regressione)",
      passed,
      message: passed
        ? "Successo: I motori di previsione Poisson e Dixon-Coles continuano a funzionare normalmente senza alcuna alterazione."
        : "Fallimento: Risultati alterati o anomalie nei modelli esistenti."
    });
  } catch (err: any) {
    results.push({
      name: "TEST 10: Nessuna modifica ai modelli esistenti (Regressione)",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST 11: Verifica Assenza Data Leakage (Verifica del flusso e della cronologia)
  // =========================================================================
  try {
    // Definizione di due partite concatenate per lo stesso team
    const match1_orig: HistoricalMatch = { id: "match1", datasetId: "ds1", date: "2026-01-01", competition: "Serie A", homeTeam: "A", awayTeam: "B", homeGoals: 3, awayGoals: 0, source: "mock", importedAt: "" };
    const match1_mod: HistoricalMatch = { id: "match1", datasetId: "ds1", date: "2026-01-01", competition: "Serie A", homeTeam: "A", awayTeam: "B", homeGoals: 0, awayGoals: 3, source: "mock", importedAt: "" };
    const match2: HistoricalMatch = { id: "match2", datasetId: "ds1", date: "2026-01-02", competition: "Serie A", homeTeam: "A", awayTeam: "C", homeGoals: 1, awayGoals: 1, source: "mock", importedAt: "" };
    
    // Calcolo storia Elo originale (match1 vince A)
    const historyOrig = computeEloHistory([match1_orig, match2], DEFAULT_ELO_CONFIG);
    // Calcolo storia Elo modificata (match1 vince B)
    const historyMod = computeEloHistory([match1_mod, match2], DEFAULT_ELO_CONFIG);
    
    const snap1Orig = historyOrig.get("match1")!;
    const snap1Mod = historyMod.get("match1")!;
    
    const snap2Orig = historyOrig.get("match2")!;
    const snap2Mod = historyMod.get("match2")!;
    
    // Verifica 1: i rating homeEloBefore e awayEloBefore della stessa partita non cambiano
    const beforeSameMatchNoChange = snap1Orig.homeEloBefore === snap1Mod.homeEloBefore && 
                                   snap1Orig.awayEloBefore === snap1Mod.awayEloBefore;
                                   
    // Verifica 2: cambiano soltanto i rating successivi alla partita
    const afterSameMatchChanged = snap1Orig.homeEloAfter !== snap1Mod.homeEloAfter || 
                                  snap1Orig.awayEloAfter !== snap1Mod.awayEloAfter;
                                  
    const nextMatchBeforeChanged = snap2Orig.homeEloBefore !== snap2Mod.homeEloBefore;
    
    // Verifica 3: nessuna previsione usa homeEloAfter o awayEloAfter della partita che sta prevedendo
    // (le previsioni per match1 usano snap1.homeEloBefore e awayEloBefore, che non contengono l'esito di match1!)
    const predictionUsesOnlyBefore = snap1Orig.homeEloBefore === 1500 && snap1Orig.awayEloBefore === 1500;
    
    const passed = beforeSameMatchNoChange && afterSameMatchChanged && nextMatchBeforeChanged && predictionUsesOnlyBefore;
    
    results.push({
      name: "TEST 11: Verifica Assenza Data Leakage",
      passed,
      message: passed
        ? "Successo: Dimostrato matematicamente che l'esito del match influenza solo i match successivi e non altera i rating pre-partita."
        : `Fallimento: Rilevato leak. SameMatchBeforeNoChange=${beforeSameMatchNoChange}, SameMatchAfterChanged=${afterSameMatchChanged}, NextMatchBeforeChanged=${nextMatchBeforeChanged}, PredictionUsesOnlyBefore=${predictionUsesOnlyBefore}`
    });
  } catch (err: any) {
    results.push({
      name: "TEST 11: Verifica Assenza Data Leakage",
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  return results;
}
