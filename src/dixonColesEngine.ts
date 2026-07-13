/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput, PredictionResult, ExactScoreProb, PredictionModel } from './types';
import { calculateExpectedGoals } from './engines/sharedExpectedGoals';
import { MatchFeatures } from './data/types';

// 1. Funzione fattoriale
export function factorial(n: number): number {
  if (n < 0) return 0;
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

// 2. Probabilità di Poisson
export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0) {
    return k === 0 ? 1 : 0;
  }
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// 3. Funzione di correzione Dixon-Coles tau()
export function tau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) {
    return 1 - lambda * mu * rho;
  }
  if (x === 1 && y === 0) {
    return 1 + lambda * rho;
  }
  if (x === 0 && y === 1) {
    return 1 + mu * rho;
  }
  if (x === 1 && y === 1) {
    return 1 - rho;
  }
  return 1;
}

// Costanti predefinite
export const DIXON_COLES_DEFAULT_RHO = -0.08;

// Modello di previsione Dixon-Coles v1.0.0
export const dixonColesModel: PredictionModel = {
  id: 'dixon-coles',
  name: 'Dixon-Coles',
  description: 'Corregge il modello di Poisson nei risultati a basso punteggio (0-0, 1-0, 0-1, 1-1), migliorando la stima dei pareggi e degli incontri equilibrati.',
  status: 'active',
  calculate: (features: MatchFeatures): PredictionResult => {
    // Calcolo dei gol attesi casa e ospite tramite il modulo condiviso
    const { homeExpectedGoals, awayExpectedGoals } = calculateExpectedGoals(features);

    const rho = DIXON_COLES_DEFAULT_RHO;

    // Costruiamo una griglia 13x13 per calcolare le probabilità (0-12 gol)
    const CALC_LIMIT = 12;
    const calcGrid: number[][] = [];
    for (let h = 0; h <= CALC_LIMIT; h++) {
      calcGrid[h] = [];
      for (let a = 0; a <= CALC_LIMIT; a++) {
        const pH = poissonProbability(h, homeExpectedGoals);
        const pA = poissonProbability(a, awayExpectedGoals);
        const t = tau(h, a, homeExpectedGoals, awayExpectedGoals, rho);
        const cellVal = pH * pA * t;
        calcGrid[h][a] = isNaN(cellVal) || !isFinite(cellVal) ? 0 : Math.max(0, cellVal);
      }
    }

    // Calcolo massa probabilistica della griglia
    let gridProbabilityMass = 0;
    for (let h = 0; h <= CALC_LIMIT; h++) {
      for (let a = 0; a <= CALC_LIMIT; a++) {
        gridProbabilityMass += calcGrid[h][a];
      }
    }
    gridProbabilityMass = Math.max(0, Math.min(1, gridProbabilityMass));
    const residualProbabilityMass = Math.max(0, Math.min(1, 1 - gridProbabilityMass));

    // Calcolo probabilità grezza vittoria casa, pareggio, vittoria ospite
    let rawHomeWin = 0;
    let rawDraw = 0;
    let rawAwayWin = 0;

    for (let h = 0; h <= CALC_LIMIT; h++) {
      for (let a = 0; a <= CALC_LIMIT; a++) {
        if (h > a) {
          rawHomeWin += calcGrid[h][a];
        } else if (h === a) {
          rawDraw += calcGrid[h][a];
        } else {
          rawAwayWin += calcGrid[h][a];
        }
      }
    }

    // Normalizzazione delle probabilità 1-X-2 usando gridProbabilityMass
    let probHomeWin = gridProbabilityMass > 0 ? (rawHomeWin / gridProbabilityMass) * 100 : 33.333333;
    let probDraw = gridProbabilityMass > 0 ? (rawDraw / gridProbabilityMass) * 100 : 33.333334;
    let probAwayWin = gridProbabilityMass > 0 ? (rawAwayWin / gridProbabilityMass) * 100 : 33.333333;

    probHomeWin = Math.max(0, Math.min(100, probHomeWin));
    probDraw = Math.max(0, Math.min(100, probDraw));
    probAwayWin = Math.max(0, Math.min(100, probAwayWin));

    const sum1X2 = probHomeWin + probDraw + probAwayWin;
    if (sum1X2 > 0) {
      probHomeWin = (probHomeWin / sum1X2) * 100;
      probDraw = (probDraw / sum1X2) * 100;
      probAwayWin = 100 - probHomeWin - probDraw; // Garantito somma esattamente 100%
    }

    // Matrice risultati da 0-0 a 6-6 normalizzata
    const scoreMatrix: number[][] = [];
    for (let h = 0; h <= 6; h++) {
      scoreMatrix[h] = [];
      for (let a = 0; a <= 6; a++) {
        const rawProb = calcGrid[h][a];
        const normProb = gridProbabilityMass > 0 ? (rawProb / gridProbabilityMass) * 100 : 0;
        scoreMatrix[h][a] = Math.max(0, Math.min(100, normProb));
      }
    }

    // Mercati aggiuntivi (basati sulla griglia ad alta precisione e normalizzati)
    let rawUnder25 = 0;
    let rawOver15 = 0;
    let rawOver25 = 0;
    let rawOver35 = 0;

    for (let h = 0; h <= CALC_LIMIT; h++) {
      for (let a = 0; a <= CALC_LIMIT; a++) {
        const sumGoals = h + a;
        const p = calcGrid[h][a];
        if (sumGoals < 2.5) {
          rawUnder25 += p;
        } else {
          rawOver25 += p;
        }
        if (sumGoals >= 1.5) {
          rawOver15 += p;
        }
        if (sumGoals >= 3.5) {
          rawOver35 += p;
        }
      }
    }

    let over15 = gridProbabilityMass > 0 ? (rawOver15 / gridProbabilityMass) * 100 : 0;
    let over25 = gridProbabilityMass > 0 ? (rawOver25 / gridProbabilityMass) * 100 : 0;
    let under25 = gridProbabilityMass > 0 ? (rawUnder25 / gridProbabilityMass) * 100 : 0;
    let over35 = gridProbabilityMass > 0 ? (rawOver35 / gridProbabilityMass) * 100 : 0;

    over15 = Math.max(0, Math.min(100, over15));
    over25 = Math.max(0, Math.min(100, over25));
    under25 = Math.max(0, Math.min(100, under25));
    over35 = Math.max(0, Math.min(100, over35));

    const sum25 = over25 + under25;
    if (sum25 > 0) {
      over25 = (over25 / sum25) * 100;
      under25 = 100 - over25; // Over 2.5 + Under 2.5 = 100%
    }

    // Goal / No Goal basato sulla griglia di probabilità corretta (Dixon-Coles)
    let rawGoal = 0;
    let rawNoGoal = 0;

    for (let h = 0; h <= CALC_LIMIT; h++) {
      for (let a = 0; a <= CALC_LIMIT; a++) {
        const p = calcGrid[h][a];
        if (h > 0 && a > 0) {
          rawGoal += p;
        } else {
          rawNoGoal += p;
        }
      }
    }

    let goal = gridProbabilityMass > 0 ? (rawGoal / gridProbabilityMass) * 100 : 0;
    let noGoal = gridProbabilityMass > 0 ? (rawNoGoal / gridProbabilityMass) * 100 : 0;

    goal = Math.max(0, Math.min(100, goal));
    noGoal = Math.max(0, Math.min(100, noGoal));

    const sumGoalNoGoal = goal + noGoal;
    if (sumGoalNoGoal > 0) {
      goal = (goal / sumGoalNoGoal) * 100;
      noGoal = 100 - goal; // Goal + NoGoal = 100%
    }

    // Cinque risultati esatti più probabili (dalla griglia 0-0 a 6-6)
    const exactScoresList: ExactScoreProb[] = [];
    for (let h = 0; h <= 6; h++) {
      for (let a = 0; a <= 6; a++) {
        exactScoresList.push({
          score: `${h}-${a}`,
          homeGoals: h,
          awayGoals: a,
          probability: scoreMatrix[h][a]
        });
      }
    }
    // Ordiniamo in modo decrescente per probabilità
    exactScoresList.sort((x, y) => y.probability - x.probability);
    const exactScores = exactScoresList.slice(0, 5);

    // === SEZIONE INCERTEZZA ED ENTROPIA ===
    const p1 = probHomeWin / 100;
    const pX = probDraw / 100;
    const p2 = probAwayWin / 100;

    const term = (p: number) => (p > 0 ? p * Math.log(p) : 0);
    const entropyRaw = -(term(p1) + term(pX) + term(p2));
    const entropy = entropyRaw / Math.log(3);

    const uncertaintyIndex = Math.min(100, Math.max(0, entropy * 100));

    // Qualità dei dati basata sulle partite giocate
    let dataQuality = 0;
    const M = features.matchesPlayed;
    if (M <= 4) {
      dataQuality = M * 6.25;
    } else if (M <= 9) {
      dataQuality = 25 + (M - 4) * 5.0;
    } else if (M <= 19) {
      dataQuality = 50 + (M - 9) * 2.5;
    } else {
      dataQuality = Math.min(100, 75 + (M - 19) * 1.25);
    }

    // Concentrazione della previsione
    const concentration = (1 - entropy) * 100;

    // Stabilità dei parametri
    const xGDiff = Math.abs(homeExpectedGoals - awayExpectedGoals);
    const parameterStability = Math.min(100, dataQuality * (0.8 + 0.2 * Math.min(1.0, xGDiff)));

    // Indice di solidità
    const solidityIndex = (0.5 * dataQuality) + (0.3 * concentration) + (0.2 * parameterStability);

    // Classificazione
    let classification: 'Bassa Incertezza' | 'Incertezza Moderata' | 'Alta Incertezza' = 'Incertezza Moderata';
    if (uncertaintyIndex < 50) {
      classification = 'Bassa Incertezza';
    } else if (uncertaintyIndex > 75) {
      classification = 'Alta Incertezza';
    }

    return {
      homeExpectedGoals,
      awayExpectedGoals,
      probHomeWin,
      probDraw,
      probAwayWin,
      over15,
      over25,
      over35,
      under25,
      goal,
      noGoal,
      scoreMatrix,
      exactScores,
      modelId: 'dixon-coles',
      modelName: 'Dixon-Coles',
      modelVersion: '1.0.0',
      calculationDiagnostics: {
        gridProbabilityMass,
        residualProbabilityMass,
        calculationLimit: CALC_LIMIT
      },
      uncertainty: {
        entropy,
        uncertaintyIndex: Math.round(uncertaintyIndex * 100) / 100,
        dataQuality: Math.round(dataQuality * 100) / 100,
        solidityIndex: Math.round(solidityIndex * 100) / 100,
        classification
      }
    };
  }
};
