/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_ELO_CONFIG, calculate1X2Probabilities, generatePredictionResult } from './EloEngine';
import { computeEloHistory } from './EloHistoricalEngine';
import { HistoricalMatch } from '../dataCollector/HistoricalMatchTypes';

export interface ValidationReport {
  success: boolean;
  errors: string[];
  passedChecks: string[];
}

/**
 * Esegue una suite di test matematici e logici completi sull'Engine Elo.
 */
export function runEloValidationTests(): ValidationReport {
  const errors: string[] = [];
  const passedChecks: string[] = [];

  try {
    // 1. Controllo Somma Probabilità 1X2 = 100% e assenza di NaN/Infinity
    const testRatings = [1000, 1200, 1500, 1800, 2000];
    for (const home of testRatings) {
      for (const away of testRatings) {
        for (const adj of [-50, 0, 15, 50, 100]) {
          const probs = calculate1X2Probabilities(home, away, DEFAULT_ELO_CONFIG, adj);
          
          const sum = probs.probHomeWin + probs.probDraw + probs.probAwayWin;
          const diff = Math.abs(sum - 100);

          if (diff > 1e-9) {
            errors.push(`Errore somma 1X2 per Home: ${home}, Away: ${away}, Adj: ${adj}. Somma = ${sum}`);
          }

          if (
            isNaN(probs.probHomeWin) || !isFinite(probs.probHomeWin) ||
            isNaN(probs.probDraw) || !isFinite(probs.probDraw) ||
            isNaN(probs.probAwayWin) || !isFinite(probs.probAwayWin)
          ) {
            errors.push(`Trovato NaN o Infinity per Home: ${home}, Away: ${away}, Adj: ${adj}`);
          }
        }
      }
    }
    if (errors.length === 0) {
      passedChecks.push("Somma probabilità 1-X-2 è sempre esattamente 100% senza NaN o Infinity.");
    }

    // 2. Controllo Determinismo (stesso input produce sempre stesso output)
    const res1 = generatePredictionResult(1600, 1400, "Team A", "Team B", 1.4, 1.1, 15, 0);
    const res2 = generatePredictionResult(1600, 1400, "Team A", "Team B", 1.4, 1.1, 15, 0);
    if (JSON.stringify(res1) !== JSON.stringify(res2)) {
      errors.push("Il modello Elo non è deterministico: lo stesso input ha prodotto output diversi.");
    } else {
      passedChecks.push("Stesso input produce lo stesso identico output (Modello Deterministico).");
    }

    // 3. Controllo Simmetria sul campo neutro (manualHomeAdjustment = -100% per rimuovere Home Advantage)
    const probNormal = calculate1X2Probabilities(1600, 1400, DEFAULT_ELO_CONFIG, -100); // Home e Away invertiti ma senza vantaggio casa
    const probInverted = calculate1X2Probabilities(1400, 1600, DEFAULT_ELO_CONFIG, -100);
    
    const diffHomeAway = Math.abs(probNormal.probHomeWin - probInverted.probAwayWin);
    const diffAwayHome = Math.abs(probNormal.probAwayWin - probInverted.probHomeWin);
    const diffDraw = Math.abs(probNormal.probDraw - probInverted.probDraw);

    if (diffHomeAway > 1e-9 || diffAwayHome > 1e-9 || diffDraw > 1e-9) {
      errors.push("Simmetria violata in campo neutro.");
    } else {
      passedChecks.push("La simmetria delle probabilità su campo neutro è rispettata.");
    }

    // 4. Controllo cronologia e conservazione della somma totale Elo
    const mockMatches: HistoricalMatch[] = [
      { id: "m1", datasetId: "ds1", date: "2026-01-01", competition: "Serie A", homeTeam: "A", awayTeam: "B", homeGoals: 2, awayGoals: 1, source: "mock", importedAt: "" },
      { id: "m2", datasetId: "ds1", date: "2026-01-02", competition: "Serie A", homeTeam: "B", awayTeam: "C", homeGoals: 0, awayGoals: 0, source: "mock", importedAt: "" },
      { id: "m3", datasetId: "ds1", date: "2026-01-03", competition: "Serie A", homeTeam: "C", awayTeam: "A", homeGoals: 1, awayGoals: 3, source: "mock", importedAt: "" },
    ];

    const snapshots = computeEloHistory(mockMatches, DEFAULT_ELO_CONFIG);
    if (snapshots.size !== mockMatches.length) {
      errors.push(`Attesi ${mockMatches.length} snapshots, ma trovati ${snapshots.size}`);
    } else {
      // Verifica la conservazione della somma dei rating (la somma deve rimanere 3 * initialRating = 4500)
      const lastSnap = snapshots.get("m3")!;
      const totalSum = lastSnap.homeEloAfter + lastSnap.awayEloAfter; // In m3 si sfidano C e A. Dobbiamo recuperare anche l'ultimo di B.
      const eloB = snapshots.get("m2")!.homeEloAfter; // B gioca in casa in m2
      const totalSystemElo = lastSnap.homeEloAfter + lastSnap.awayEloAfter + eloB;
      
      const expectedSum = 3 * DEFAULT_ELO_CONFIG.initialRating;
      if (Math.abs(totalSystemElo - expectedSum) > 1e-9) {
        errors.push(`Somma Elo del sistema non conservata. Attesa: ${expectedSum}, Trovata: ${totalSystemElo}`);
      } else {
        passedChecks.push("La somma totale dei rating dei team si conserva (Nessuna creazione/distruzione di rating arbitraria).");
      }
    }

  } catch (err: any) {
    errors.push(`Eccezione imprevista durante la validazione Elo: ${err.message || err}`);
  }

  return {
    success: errors.length === 0,
    errors,
    passedChecks,
  };
}
