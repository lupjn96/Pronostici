import { poissonModel } from './poissonEngine';
import { ModelInput } from './types';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export function runDiagnostics(): TestResult[] {
  const results: TestResult[] = [];

  // Helper per tolleranza macchina < 1e-9
  const isCloseTo100 = (val: number): boolean => {
    return Math.abs(val - 100) < 1e-9;
  };

  // Test 1: Parametri Zero (lambda = 0)
  try {
    const inputZero: ModelInput = {
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      homeScoredAvg: 0,
      homeConcededAvg: 0,
      awayScoredAvg: 0,
      awayConcededAvg: 0,
      leagueHomeScoredAvg: 1.5,
      leagueAwayScoredAvg: 1.5,
      matchesPlayed: 15,
      homeAdvantage: 0
    };

    const res = poissonModel.calculate(inputZero);
    const hasNaN = [
      res.homeExpectedGoals, res.awayExpectedGoals,
      res.probHomeWin, res.probDraw, res.probAwayWin,
      res.over15, res.over25, res.over35, res.under25,
      res.goal, res.noGoal
    ].some(v => isNaN(v) || !isFinite(v));

    if (!hasNaN && isCloseTo100(res.probHomeWin + res.probDraw + res.probAwayWin)) {
      results.push({
        name: 'Parametri Zero (lambda = 0)',
        passed: true,
        message: 'Gestito correttamente. Gol attesi stabili a 0, nessuna presenza di NaN o Infinity.'
      });
    } else {
      results.push({
        name: 'Parametri Zero (lambda = 0)',
        passed: false,
        message: `Presenza di NaN/Infinity o somma 1-X-2 non valida (${res.probHomeWin + res.probDraw + res.probAwayWin}%).`
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Parametri Zero (lambda = 0)',
      passed: false,
      message: `Errore durante l'esecuzione: ${err.message}`
    });
  }

  // Test 2: Parametri Uguali (Simmetria)
  try {
    const inputEqual: ModelInput = {
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.5,
      awayScoredAvg: 1.5,
      awayConcededAvg: 1.5,
      leagueHomeScoredAvg: 1.5,
      leagueAwayScoredAvg: 1.5,
      matchesPlayed: 15,
      homeAdvantage: 0 // Vantaggio casa nullo per garantire perfetta simmetria
    };

    const res = poissonModel.calculate(inputEqual);
    const xGEqual = Math.abs(res.homeExpectedGoals - res.awayExpectedGoals) < 1e-9;
    const probsEqual = Math.abs(res.probHomeWin - res.probAwayWin) < 1e-9;

    if (xGEqual && probsEqual) {
      results.push({
        name: 'Parametri Uguali (Simmetria)',
        passed: true,
        message: `Perfetta simmetria. Gol attesi identici (${res.homeExpectedGoals.toFixed(4)}) e probabilità 1 e 2 identiche (${res.probHomeWin.toFixed(2)}%).`
      });
    } else {
      results.push({
        name: 'Parametri Uguali (Simmetria)',
        passed: false,
        message: `Mancata simmetria. xG Casa/Ospite: ${res.homeExpectedGoals}/${res.awayExpectedGoals}. Probabilità 1/2: ${res.probHomeWin}/${res.probAwayWin}.`
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Parametri Uguali (Simmetria)',
      passed: false,
      message: `Errore durante l'esecuzione: ${err.message}`
    });
  }

  // Test 3: Parametri Estremi (lambda alta)
  try {
    const inputExtreme: ModelInput = {
      homeTeam: 'Attackers',
      awayTeam: 'Defenders',
      homeScoredAvg: 8.5,
      homeConcededAvg: 0.5,
      awayScoredAvg: 0.5,
      awayConcededAvg: 8.5,
      leagueHomeScoredAvg: 1.0,
      leagueAwayScoredAvg: 1.0,
      matchesPlayed: 15,
      homeAdvantage: 0
    };

    const res = poissonModel.calculate(inputExtreme);
    const isSane = [
      res.homeExpectedGoals, res.awayExpectedGoals,
      res.probHomeWin, res.probDraw, res.probAwayWin
    ].every(v => !isNaN(v) && isFinite(v));

    if (isSane) {
      results.push({
        name: 'Parametri Estremi (xG elevati)',
        passed: true,
        message: `Calcoli stabili. xG Casa: ${res.homeExpectedGoals.toFixed(2)}, xG Ospite: ${res.awayExpectedGoals.toFixed(2)}.`
      });
    } else {
      results.push({
        name: 'Parametri Estremi (xG elevati)',
        passed: false,
        message: 'Presenza di valori indefiniti, non finiti o NaN.'
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Parametri Estremi (xG elevati)',
      passed: false,
      message: `Errore durante l'esecuzione: ${err.message}`
    });
  }

  // Test 4: Somma delle probabilità 1-X-2 pari al 100%
  try {
    const inputsToTest = createSampleInputs();
    let allPassed = true;
    let worstError = 0;

    for (const inp of inputsToTest) {
      const res = poissonModel.calculate(inp);
      const sum = res.probHomeWin + res.probDraw + res.probAwayWin;
      const diff = Math.abs(sum - 100);
      if (diff > worstError) worstError = diff;
      if (!isCloseTo100(sum)) {
        allPassed = false;
      }
    }

    if (allPassed) {
      results.push({
        name: 'Coerenza Somma 1-X-2 = 100%',
        passed: true,
        message: `Tutti i campioni sommano esattamente al 100,000000% (Errore massimo di macchina: ${worstError.toExponential(4)}).`
      });
    } else {
      results.push({
        name: 'Coerenza Somma 1-X-2 = 100%',
        passed: false,
        message: `Alcuni test hanno fallito. Errore massimo riscontrato: ${worstError.toExponential(4)}.`
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Coerenza Somma 1-X-2 = 100%',
      passed: false,
      message: `Errore durante l'esecuzione: ${err.message}`
    });
  }

  // Test 5: Somma Over 2.5 + Under 2.5 = 100%
  try {
    const inputsToTest = createSampleInputs();
    let allPassed = true;
    let worstError = 0;

    for (const inp of inputsToTest) {
      const res = poissonModel.calculate(inp);
      const sum = res.over25 + res.under25;
      const diff = Math.abs(sum - 100);
      if (diff > worstError) worstError = diff;
      if (!isCloseTo100(sum)) {
        allPassed = false;
      }
    }

    if (allPassed) {
      results.push({
        name: 'Coerenza Over 2.5 + Under 2.5 = 100%',
        passed: true,
        message: `Perfetta complementarietà del mercato Over/Under 2.5 (Errore massimo di macchina: ${worstError.toExponential(4)}).`
      });
    } else {
      results.push({
        name: 'Coerenza Over 2.5 + Under 2.5 = 100%',
        passed: false,
        message: `Mancata somma al 100%. Errore massimo riscontrato: ${worstError.toExponential(4)}.`
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Coerenza Over 2.5 + Under 2.5 = 100%',
      passed: false,
      message: `Errore durante l'esecuzione: ${err.message}`
    });
  }

  // Test 6: Somma Goal + No Goal = 100%
  try {
    const inputsToTest = createSampleInputs();
    let allPassed = true;
    let worstError = 0;

    for (const inp of inputsToTest) {
      const res = poissonModel.calculate(inp);
      const sum = res.goal + res.noGoal;
      const diff = Math.abs(sum - 100);
      if (diff > worstError) worstError = diff;
      if (!isCloseTo100(sum)) {
        allPassed = false;
      }
    }

    if (allPassed) {
      results.push({
        name: 'Coerenza Goal + No Goal = 100%',
        passed: true,
        message: `Perfetta complementarietà del mercato Goal/No Goal (Errore massimo di macchina: ${worstError.toExponential(4)}).`
      });
    } else {
      results.push({
        name: 'Coerenza Goal + No Goal = 100%',
        passed: false,
        message: `Mancata somma al 100%. Errore massimo riscontrato: ${worstError.toExponential(4)}.`
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Coerenza Goal + No Goal = 100%',
      passed: false,
      message: `Errore durante l'esecuzione: ${err.message}`
    });
  }

  // Stampa log in console per lo sviluppo
  console.log('=== POISSON ENGINE v1.1 DIAGNOSTICS ===');
  results.forEach(r => {
    console.log(`[${r.passed ? 'PASSED' : 'FAILED'}] ${r.name}: ${r.message}`);
  });
  console.log('=======================================');

  return results;
}

function createSampleInputs(): ModelInput[] {
  return [
    {
      homeTeam: 'A', awayTeam: 'B',
      homeScoredAvg: 1.2, homeConcededAvg: 0.9,
      awayScoredAvg: 1.4, awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.3, leagueAwayScoredAvg: 1.2,
      matchesPlayed: 10, homeAdvantage: 0
    },
    {
      homeTeam: 'C', awayTeam: 'D',
      homeScoredAvg: 2.8, homeConcededAvg: 1.9,
      awayScoredAvg: 0.4, awayConcededAvg: 2.5,
      leagueHomeScoredAvg: 1.5, leagueAwayScoredAvg: 1.1,
      matchesPlayed: 25, homeAdvantage: 15
    },
    {
      homeTeam: 'E', awayTeam: 'F',
      homeScoredAvg: 0.5, homeConcededAvg: 0.5,
      awayScoredAvg: 0.5, awayConcededAvg: 0.5,
      leagueHomeScoredAvg: 1.3, leagueAwayScoredAvg: 1.3,
      matchesPlayed: 4, homeAdvantage: -10
    }
  ];
}
