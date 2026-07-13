import { poissonModel } from './poissonEngine';
import { ModelInput } from './types';
import { FootballDataEngine } from './data/FootballDataEngine';

function calculatePoisson(input: ModelInput) {
  const engine = new FootballDataEngine();
  engine.loadManualInput(input);
  return poissonModel.calculate(engine.getFeatures()!);
}

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

    const res = calculatePoisson(inputZero);
    const hasNaN = [
      res.homeExpectedGoals, res.awayExpectedGoals,
      res.probHomeWin, res.probDraw, res.probAwayWin,
      res.over15, res.over25, res.over35, res.under25,
      res.goal, res.noGoal
    ].some(v => isNaN(v) || !isFinite(v));

    const checkTol = (val: number, expected: number): boolean => {
      return Math.abs(val - expected) < 1e-4;
    };

    const passedAllConditions = !hasNaN &&
      checkTol(res.homeExpectedGoals, 0) &&
      checkTol(res.awayExpectedGoals, 0) &&
      checkTol(res.probHomeWin, 0) &&
      checkTol(res.probDraw, 100) &&
      checkTol(res.probAwayWin, 0) &&
      res.scoreMatrix && Array.isArray(res.scoreMatrix) && res.scoreMatrix[0] && checkTol(res.scoreMatrix[0][0], 100) &&
      checkTol(res.goal, 0) &&
      checkTol(res.noGoal, 100) &&
      checkTol(res.over15, 0) &&
      checkTol(res.over25, 0) &&
      checkTol(res.under25, 100);

    if (passedAllConditions) {
      results.push({
        name: 'Parametri Zero (lambda = 0)',
        passed: true,
        message: 'Gestito correttamente. Tutti i valori attesi (xG = 0, Pareggio = 100%, Under25 = 100%, NoGoal = 100%) rispettano rigorosamente le tolleranze matematiche.'
      });
    } else {
      results.push({
        name: 'Parametri Zero (lambda = 0)',
        passed: false,
        message: `Mancato rispetto dei vincoli analitici con lambda = 0: xG=${res.homeExpectedGoals}/${res.awayExpectedGoals}, 1-X-2=${res.probHomeWin}/${res.probDraw}/${res.probAwayWin}, scoreMatrix[0][0]=${res.scoreMatrix?.[0]?.[0]}, Goal/NoGoal=${res.goal}/${res.noGoal}, Under/Over25=${res.under25}/${res.over25}.`
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

    const res = calculatePoisson(inputEqual);
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

    const res = calculatePoisson(inputExtreme);
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
      const res = calculatePoisson(inp);
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
      const res = calculatePoisson(inp);
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
      const res = calculatePoisson(inp);
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

  // Test 7: Validità dei Diagnostici di Calcolo
  try {
    const inputsToTest = createSampleInputs();
    let allPassed = true;
    let worstError = 0;

    for (const inp of inputsToTest) {
      const res = calculatePoisson(inp);
      const diag = res.calculationDiagnostics;
      
      const massInBounds = diag.gridProbabilityMass >= 0 && diag.gridProbabilityMass <= 1;
      const resInBounds = diag.residualProbabilityMass >= 0 && diag.residualProbabilityMass <= 1;
      const sum = diag.gridProbabilityMass + diag.residualProbabilityMass;
      const diff = Math.abs(sum - 1);
      
      if (diff > worstError) worstError = diff;
      
      const isSumCorrect = diff < 1e-9;
      
      if (!massInBounds || !resInBounds || !isSumCorrect) {
        allPassed = false;
      }
    }

    if (allPassed) {
      results.push({
        name: 'Diagnostici del Calcolo (Massa Probabilistica)',
        passed: true,
        message: `Verificato con successo: la massa della griglia e la massa residua sono comprese tra 0 e 1, e la loro somma è esattamente 1 (Errore massimo di macchina: ${worstError.toExponential(4)}).`
      });
    } else {
      results.push({
        name: 'Diagnostici del Calcolo (Massa Probabilistica)',
        passed: false,
        message: `Mancato rispetto dei vincoli sui diagnostici. Errore massimo riscontrato sulla somma: ${worstError.toExponential(4)}.`
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Diagnostici del Calcolo (Massa Probabilistica)',
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
