/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { poissonGammaModel } from './poissonGammaEngine';
import { poissonModel } from './poissonEngine';
import { ModelInput } from './types';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

/**
 * Esegue i test di validazione da A a E per il motore Poisson-Gamma Bayesiano
 */
export function runPoissonGammaValidation(): TestResult[] {
  const results: TestResult[] = [];

  // --- TEST A: Corner case lambda = 0 ---
  try {
    const inputA: ModelInput = {
      homeTeam: 'Team Zero',
      awayTeam: 'Team Away',
      homeScoredAvg: 0,
      homeConcededAvg: 0,
      awayScoredAvg: 0,
      awayConcededAvg: 0,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 0
    };

    const resA = poissonGammaModel.calculate(inputA);
    const isDegenerateHome = resA.exactScores[0].score === '0-0' && resA.scoreMatrix[0][0] > 99.9;
    const hasNaNOrInf = [
      resA.probHomeWin, resA.probDraw, resA.probAwayWin,
      resA.over15, resA.over25, resA.under25, resA.goal, resA.noGoal
    ].some(val => isNaN(val) || !isFinite(val));

    results.push({
      name: 'Test A: Corner Case lambda = 0',
      passed: isDegenerateHome && !hasNaNOrInf,
      message: isDegenerateHome && !hasNaNOrInf
        ? 'Success: Zero goals model produces degenerate 0-0 distribution without NaN/Infinity.'
        : 'Failure: Zero goals did not produce correct 0-0 distribution or produced NaN/Infinity.'
    });
  } catch (err: any) {
    results.push({
      name: 'Test A: Corner Case lambda = 0',
      passed: false,
      message: `Exception thrown: ${err.message}`
    });
  }

  // --- TEST B: Data volume impact on variance and uncertainty ---
  try {
    const inputLowVolume: ModelInput = {
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.2,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 3, // Low matches played
      homeAdvantage: 0
    };

    const inputHighVolume: ModelInput = {
      ...inputLowVolume,
      matchesPlayed: 30 // High matches played
    };

    const resLow = poissonGammaModel.calculate(inputLowVolume);
    const resHigh = poissonGammaModel.calculate(inputHighVolume);

    const varLowHome = resLow.parameterUncertainty?.homeLambdaVariance ?? 0;
    const varHighHome = resHigh.parameterUncertainty?.homeLambdaVariance ?? 0;
    const epistemicLow = resLow.parameterUncertainty?.epistemicIndex ?? 0;
    const epistemicHigh = resHigh.parameterUncertainty?.epistemicIndex ?? 0;

    const conditionVariance = varHighHome < varLowHome;
    const conditionEpistemic = epistemicHigh < epistemicLow;

    results.push({
      name: 'Test B: Data Volume Impact on Parameter Variance and Epistemic Index',
      passed: conditionVariance && conditionEpistemic,
      message: conditionVariance && conditionEpistemic
        ? `Success: Parameter variance decreased from ${varLowHome.toFixed(4)} to ${varHighHome.toFixed(4)} and epistemic uncertainty decreased from ${epistemicLow.toFixed(2)}% to ${epistemicHigh.toFixed(2)}% as games played went from 3 to 30.`
        : `Failure: Variance low volume (${varLowHome.toFixed(4)}) vs high volume (${varHighHome.toFixed(4)}) or Epistemic low (${epistemicLow}) vs high (${epistemicHigh}) did not scale correctly.`
    });
  } catch (err: any) {
    results.push({
      name: 'Test B: Data Volume Impact',
      passed: false,
      message: `Exception thrown: ${err.message}`
    });
  }

  // --- TEST C: Dispersion comparison vs standard Poisson ---
  try {
    const inputC: ModelInput = {
      homeTeam: 'Milan',
      awayTeam: 'Napoli',
      homeScoredAvg: 1.85,
      homeConcededAvg: 1.10,
      awayScoredAvg: 1.50,
      awayConcededAvg: 1.20,
      leagueHomeScoredAvg: 1.40,
      leagueAwayScoredAvg: 1.10,
      matchesPlayed: 3, // very low matches played -> maximum dispersion
      homeAdvantage: 0
    };

    const resPoisson = poissonModel.calculate(inputC);
    const resBayesian = poissonGammaModel.calculate(inputC);

    const maxProbPoisson = resPoisson.exactScores[0].probability;
    const maxProbBayesian = resBayesian.exactScores[0].probability;

    const conditionDispersion = maxProbBayesian < maxProbPoisson;

    results.push({
      name: 'Test C: Probability Dispersion (Poisson vs. Poisson-Gamma)',
      passed: conditionDispersion,
      message: conditionDispersion
        ? `Success: Bayesian peak probability (${maxProbBayesian.toFixed(2)}%) is more dispersed (lower) than Poisson peak (${maxProbPoisson.toFixed(2)}%) due to parameter uncertainty with low games (3).`
        : `Failure: Bayesian peak (${maxProbBayesian.toFixed(2)}%) was not more dispersed than Poisson peak (${maxProbPoisson.toFixed(2)}%).`
    });
  } catch (err: any) {
    results.push({
      name: 'Test C: Dispersion Comparison',
      passed: false,
      message: `Exception thrown: ${err.message}`
    });
  }

  // --- TEST D: Grid probability mass sum ---
  try {
    const inputD: ModelInput = {
      homeTeam: 'Inter',
      awayTeam: 'Juventus',
      homeScoredAvg: 2.15,
      homeConcededAvg: 0.85,
      awayScoredAvg: 1.65,
      awayConcededAvg: 0.95,
      leagueHomeScoredAvg: 1.45,
      leagueAwayScoredAvg: 1.15,
      matchesPlayed: 15,
      homeAdvantage: 0
    };

    const resD = poissonGammaModel.calculate(inputD);

    const sum1X2 = resD.probHomeWin + resD.probDraw + resD.probAwayWin;
    const isSum1X2Correct = Math.abs(sum1X2 - 100) < 1e-9;

    const mass = resD.calculationDiagnostics?.gridProbabilityMass ?? 0;
    const residual = resD.calculationDiagnostics?.residualProbabilityMass ?? 0;
    const isTotalMassOne = Math.abs(mass + residual - 1) < 1e-9;

    results.push({
      name: 'Test D: Grid Probability Mass and Exact 100% Normalized Sum',
      passed: isSum1X2Correct && isTotalMassOne,
      message: isSum1X2Correct && isTotalMassOne
        ? `Success: 1X2 sums to exactly ${sum1X2.toFixed(4)}% and Total Grid Mass + Residual = ${(mass + residual).toFixed(4)}.`
        : `Failure: 1X2 Sum is ${sum1X2.toFixed(4)}% or Mass + Residual is ${(mass + residual).toFixed(4)}.`
    });
  } catch (err: any) {
    results.push({
      name: 'Test D: Probability Mass Sum',
      passed: false,
      message: `Exception thrown: ${err.message}`
    });
  }

  // --- TEST E: NaN and Infinity checks ---
  try {
    const inputHigh: ModelInput = {
      homeTeam: 'Super Home',
      awayTeam: 'Super Away',
      homeScoredAvg: 10.0,
      homeConcededAvg: 10.0,
      awayScoredAvg: 10.0,
      awayConcededAvg: 10.0,
      leagueHomeScoredAvg: 5.0,
      leagueAwayScoredAvg: 5.0,
      matchesPlayed: 1,
      homeAdvantage: 100
    };

    const resHigh = poissonGammaModel.calculate(inputHigh);

    const hasNaNOrInfHigh = [
      resHigh.probHomeWin, resHigh.probDraw, resHigh.probAwayWin,
      resHigh.over15, resHigh.over25, resHigh.under25, resHigh.goal, resHigh.noGoal
    ].some(val => isNaN(val) || !isFinite(val));

    results.push({
      name: 'Test E: NaN and Infinity Safety with Extreme Inputs',
      passed: !hasNaNOrInfHigh,
      message: !hasNaNOrInfHigh
        ? 'Success: Model operates safely and yields valid numerical outputs under extreme inputs without NaN or Infinity.'
        : 'Failure: Extreme inputs caused NaN or Infinity values.'
    });
  } catch (err: any) {
    results.push({
      name: 'Test E: NaN and Infinity checks',
      passed: false,
      message: `Exception thrown: ${err.message}`
    });
  }

  return results;
}
