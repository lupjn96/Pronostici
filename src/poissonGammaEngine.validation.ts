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
    const tol = 0.0001;
    const checkTol = (val: number, expected: number) => Math.abs(val - expected) < tol;

    const condHomeXG = checkTol(resA.homeExpectedGoals, 0);
    const condAwayXG = checkTol(resA.awayExpectedGoals, 0);
    const condHomeWin = checkTol(resA.probHomeWin, 0);
    const condDraw = checkTol(resA.probDraw, 100);
    const condAwayWin = checkTol(resA.probAwayWin, 0);
    const condMatrix00 = checkTol(resA.scoreMatrix[0][0], 100);
    const condGoal = checkTol(resA.goal, 0);
    const condNoGoal = checkTol(resA.noGoal, 100);
    const condOver15 = checkTol(resA.over15, 0);
    const condOver25 = checkTol(resA.over25, 0);
    const condUnder25 = checkTol(resA.under25, 100);

    const testAPassed = condHomeXG && condAwayXG && condHomeWin && condDraw && condAwayWin &&
                        condMatrix00 && condGoal && condNoGoal && condOver15 && condOver25 && condUnder25;

    results.push({
      name: 'Test A: Corner Case lambda = 0',
      passed: testAPassed,
      message: testAPassed
        ? 'Success: Zero goals model produces degenerate 0-0 distribution and matches exact requirements with tolerance 0.0001.'
        : `Failure: Zero goals values mismatch requirements. Details - homeXG: ${resA.homeExpectedGoals}, awayXG: ${resA.awayExpectedGoals}, homeWin: ${resA.probHomeWin}, draw: ${resA.probDraw}, awayWin: ${resA.probAwayWin}, matrix00: ${resA.scoreMatrix[0][0]}, goal: ${resA.goal}, noGoal: ${resA.noGoal}, over15: ${resA.over15}, over25: ${resA.over25}, under25: ${resA.under25}`
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
    const isSum1X2Correct = Math.abs(sum1X2 - 100) < 0.0001;

    const sumOverUnder = resD.over25 + resD.under25;
    const isSumOverUnderCorrect = Math.abs(sumOverUnder - 100) < 0.0001;

    const sumGoalNoGoal = resD.goal + resD.noGoal;
    const isSumGoalNoGoalCorrect = Math.abs(sumGoalNoGoal - 100) < 0.0001;

    const mass = resD.calculationDiagnostics?.gridProbabilityMass ?? 0;
    const residual = resD.calculationDiagnostics?.residualProbabilityMass ?? 0;
    const isTotalMassOne = Math.abs(mass + residual - 1) < 0.0001;

    const testDPassed = isSum1X2Correct && isSumOverUnderCorrect && isSumGoalNoGoalCorrect && isTotalMassOne;

    results.push({
      name: 'Test D: Grid Probability Mass and Exact 100% Normalized Sum',
      passed: testDPassed,
      message: testDPassed
        ? `Success: 1X2 sums to ${sum1X2.toFixed(4)}%, Over/Under sums to ${sumOverUnder.toFixed(4)}%, Goal/NoGoal sums to ${sumGoalNoGoal.toFixed(4)}%, and Total Grid Mass + Residual = ${(mass + residual).toFixed(4)}.`
        : `Failure: Mismatch found. 1X2 Sum: ${sum1X2.toFixed(4)}% (expected 100), Over/Under Sum: ${sumOverUnder.toFixed(4)}% (expected 100), Goal/NoGoal Sum: ${sumGoalNoGoal.toFixed(4)}% (expected 100), Mass+Residual: ${(mass + residual).toFixed(4)} (expected 1).`
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

    const isValidPct = (val: number | undefined): boolean => {
      if (val === undefined) return false;
      return !isNaN(val) && isFinite(val) && val >= 0 && val <= 100;
    };

    const isValidMass = (val: number | undefined): boolean => {
      if (val === undefined) return false;
      return !isNaN(val) && isFinite(val) && val >= 0 && val <= 1;
    };

    const check1 = isValidPct(resHigh.probHomeWin);
    const check2 = isValidPct(resHigh.probDraw);
    const check3 = isValidPct(resHigh.probAwayWin);
    const check4 = isValidPct(resHigh.over15);
    const check5 = isValidPct(resHigh.over25);
    const check6 = isValidPct(resHigh.over35);
    const check7 = isValidPct(resHigh.under25);
    const check8 = isValidPct(resHigh.goal);
    const check9 = isValidPct(resHigh.noGoal);
    const check10 = isValidPct(resHigh.uncertainty.uncertaintyIndex);
    const check11 = isValidPct(resHigh.uncertainty.solidityIndex);
    const check12 = isValidPct(resHigh.parameterUncertainty?.epistemicIndex);
    const check13 = isValidPct(resHigh.totalUncertaintyIndex);

    const checkMass1 = isValidMass(resHigh.calculationDiagnostics?.gridProbabilityMass);
    const checkMass2 = isValidMass(resHigh.calculationDiagnostics?.residualProbabilityMass);

    const testEPassed = check1 && check2 && check3 && check4 && check5 && check6 && check7 && check8 && check9 &&
                        check10 && check11 && check12 && check13 && checkMass1 && checkMass2;

    results.push({
      name: 'Test E: NaN and Infinity Safety with Extreme Inputs',
      passed: testEPassed,
      message: testEPassed
        ? 'Success: Model operates safely and yields valid numerical outputs under extreme inputs without NaN or Infinity, and all requested metrics are within range [0, 100] or [0, 1].'
        : `Failure: Extreme inputs caused validation failure or values out of bounds. Details - probHomeWin: ${resHigh.probHomeWin}, probDraw: ${resHigh.probDraw}, probAwayWin: ${resHigh.probAwayWin}, over15: ${resHigh.over15}, over25: ${resHigh.over25}, over35: ${resHigh.over35}, under25: ${resHigh.under25}, goal: ${resHigh.goal}, noGoal: ${resHigh.noGoal}, uncertaintyIndex: ${resHigh.uncertainty.uncertaintyIndex}, solidityIndex: ${resHigh.uncertainty.solidityIndex}, epistemicIndex: ${resHigh.parameterUncertainty?.epistemicIndex}, totalUncertaintyIndex: ${resHigh.totalUncertaintyIndex}, gridMass: ${resHigh.calculationDiagnostics?.gridProbabilityMass}, residualMass: ${resHigh.calculationDiagnostics?.residualProbabilityMass}`
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
