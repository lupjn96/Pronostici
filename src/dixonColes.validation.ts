/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchFeatures } from './data/types';
import { poissonModel } from './poissonEngine';
import { dixonColesModel } from './dixonColesEngine';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export function runDixonColesValidation(): TestResult[] {
  const results: TestResult[] = [];

  const features: MatchFeatures = {
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
    dataSource: 'manual_input',
    modelReady: true
  };

  const pRes = poissonModel.calculate(features);
  const dcRes = dixonColesModel.calculate(features);

  // TEST A: 1-X-2 = 100
  try {
    const sum1X2 = dcRes.probHomeWin + dcRes.probDraw + dcRes.probAwayWin;
    const passed = Math.abs(sum1X2 - 100) < 0.01;
    results.push({
      name: 'TEST A: Somma probabilità 1-X-2 pari a 100%',
      passed,
      message: passed 
        ? `Successo: La somma è esattamente ${sum1X2.toFixed(4)}%`
        : `Fallimento: La somma è ${sum1X2}%`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST A: Somma probabilità 1-X-2 pari a 100%',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // TEST B: Goal + NoGoal = 100
  try {
    const sumGoalNoGoal = dcRes.goal + dcRes.noGoal;
    const passed = Math.abs(sumGoalNoGoal - 100) < 0.01;
    results.push({
      name: 'TEST B: Somma probabilità Goal + NoGoal pari a 100%',
      passed,
      message: passed
        ? `Successo: La somma è esattamente ${sumGoalNoGoal.toFixed(4)}%`
        : `Fallimento: La somma è ${sumGoalNoGoal}%`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST B: Somma probabilità Goal + NoGoal pari a 100%',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // TEST C: Over25 + Under25 = 100
  try {
    const sumOverUnder = dcRes.over25 + dcRes.under25;
    const passed = Math.abs(sumOverUnder - 100) < 0.01;
    results.push({
      name: 'TEST C: Somma probabilità Over 2.5 + Under 2.5 pari a 100%',
      passed,
      message: passed
        ? `Successo: La somma è esattamente ${sumOverUnder.toFixed(4)}%`
        : `Fallimento: La somma è ${sumOverUnder}%`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST C: Somma probabilità Over 2.5 + Under 2.5 pari a 100%',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // TEST D: Massa coperta + residua = 1
  try {
    const totalMass = dcRes.calculationDiagnostics.gridProbabilityMass + dcRes.calculationDiagnostics.residualProbabilityMass;
    const passed = Math.abs(totalMass - 1.0) < 0.0001;
    results.push({
      name: 'TEST D: Massa probabilistica coperta + residua pari a 1.0',
      passed,
      message: passed
        ? `Successo: La somma delle masse è esattamente ${totalMass.toFixed(6)}`
        : `Fallimento: La somma è ${totalMass}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST D: Massa probabilistica coperta + residua pari a 1.0',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // TEST E: Confronto Poisson e Dixon-Coles (Risultati bassi)
  try {
    const diff00 = Math.abs(pRes.scoreMatrix[0][0] - dcRes.scoreMatrix[0][0]);
    const diff10 = Math.abs(pRes.scoreMatrix[1][0] - dcRes.scoreMatrix[1][0]);
    const diff01 = Math.abs(pRes.scoreMatrix[0][1] - dcRes.scoreMatrix[0][1]);
    const diff11 = Math.abs(pRes.scoreMatrix[1][1] - dcRes.scoreMatrix[1][1]);

    const passed = diff00 > 0.001 && diff10 > 0.001 && diff01 > 0.001 && diff11 > 0.001;
    results.push({
      name: 'TEST E: Differenze nei punteggi bassi (0-0, 1-0, 0-1, 1-1)',
      passed,
      message: passed
        ? `Successo: Rilevate differenze significative dovute alla correzione tau().\n` +
          `  - Cella 0-0: Poisson=${pRes.scoreMatrix[0][0].toFixed(3)}%, Dixon-Coles=${dcRes.scoreMatrix[0][0].toFixed(3)}% (Diff=${diff00.toFixed(3)}%)\n` +
          `  - Cella 1-0: Poisson=${pRes.scoreMatrix[1][0].toFixed(3)}%, Dixon-Coles=${dcRes.scoreMatrix[1][0].toFixed(3)}% (Diff=${diff10.toFixed(3)}%)\n` +
          `  - Cella 0-1: Poisson=${pRes.scoreMatrix[0][1].toFixed(3)}%, Dixon-Coles=${dcRes.scoreMatrix[0][1].toFixed(3)}% (Diff=${diff01.toFixed(3)}%)\n` +
          `  - Cella 1-1: Poisson=${pRes.scoreMatrix[1][1].toFixed(3)}%, Dixon-Coles=${dcRes.scoreMatrix[1][1].toFixed(3)}% (Diff=${diff11.toFixed(3)}%)`
        : `Fallimento: Nessuna differenza rilevata nei risultati a basso punteggio.`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST E: Differenze nei punteggi bassi (0-0, 1-0, 0-1, 1-1)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // TEST F: Confronto Poisson e Dixon-Coles (Risultati alti)
  try {
    const diff32 = Math.abs(pRes.scoreMatrix[3][2] - dcRes.scoreMatrix[3][2]);
    const diff43 = Math.abs(pRes.scoreMatrix[4][3] - dcRes.scoreMatrix[4][3]);
    const diff24 = Math.abs(pRes.scoreMatrix[2][4] - dcRes.scoreMatrix[2][4]);

    // Poiché la massa totale cambia leggermente a causa della correzione dei bassi risultati,
    // ci può essere una minima deviazione dovuta alla normalizzazione, ma dev'essere estremamente ridotta.
    const passed = diff32 < 0.1 && diff43 < 0.1 && diff24 < 0.1;
    results.push({
      name: 'TEST F: Differenza trascurabile nei risultati alti (3-2, 4-3, 2-4)',
      passed,
      message: passed
        ? `Successo: Le differenze sono trascurabili (dovute solo alla normalizzazione della massa totale).\n` +
          `  - Cella 3-2: Poisson=${pRes.scoreMatrix[3][2].toFixed(4)}%, Dixon-Coles=${dcRes.scoreMatrix[3][2].toFixed(4)}% (Diff=${diff32.toFixed(4)}%)\n` +
          `  - Cella 4-3: Poisson=${pRes.scoreMatrix[4][3].toFixed(4)}%, Dixon-Coles=${dcRes.scoreMatrix[4][3].toFixed(4)}% (Diff=${diff43.toFixed(4)}%)\n` +
          `  - Cella 2-4: Poisson=${pRes.scoreMatrix[2][4].toFixed(4)}%, Dixon-Coles=${dcRes.scoreMatrix[2][4].toFixed(4)}% (Diff=${diff24.toFixed(4)}%)`
        : `Fallimento: Rilevate differenze elevate nei risultati alti.`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST F: Differenza trascurabile nei risultati alti (3-2, 4-3, 2-4)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  return results;
}
