/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput, PredictionResult, ExactScoreProb, PredictionModel } from './types';
import { calculateExpectedGoals } from './engines/sharedExpectedGoals';
import { MatchFeatures } from './data/types';

// 1. Funzione log-Gamma (per precisione e stabilità numerica ad ampi input)
export function logGamma(z: number): number {
  if (z <= 0) return 0;
  // Lanczos approximation (g=7, n=9)
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507301707322688,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  let x = p[0];
  for (let i = 1; i < p.length; i++) {
    x += p[i] / (z + i - 1);
  }
  const t = z + g - 0.5;
  return Math.log(Math.sqrt(2 * Math.PI)) + Math.log(x) + (z - 0.5) * Math.log(t) - t;
}

// 2. Funzione log-Fattoriale
export function logFactorial(k: number): number {
  if (k <= 1) return 0;
  let sum = 0;
  for (let i = 2; i <= k; i++) {
    sum += Math.log(i);
  }
  return sum;
}

// 3. Distribuzione predittiva Binomiale Negativa (Poisson-Gamma mixture)
export function negativeBinomialPredictiveProbability(k: number, shape: number, rate: number): number {
  if (shape <= 0 || rate <= 0) {
    return k === 0 ? 1 : 0;
  }
  // Formula logaritmica: logGamma(k + shape) - logGamma(shape) - logFactorial(k) 
  // + shape * log(rate / (rate + 1)) + k * log(1 / (rate + 1))
  const logP = logGamma(k + shape) - logGamma(shape) - logFactorial(k)
    + shape * (Math.log(rate) - Math.log(rate + 1))
    + k * (-Math.log(rate + 1));
  
  const p = Math.exp(logP);
  return isNaN(p) || !isFinite(p) ? 0 : p;
}

export const poissonGammaModel: PredictionModel = {
  id: 'poisson-gamma',
  name: 'Poisson-Gamma Empirico',
  description: 'Modello Poisson-Gamma che rappresenta lambda come parametro incerto. La varianza iniziale è stimata empiricamente in funzione del numero di partite disponibili.',
  status: 'active',
  calculate: (features: MatchFeatures): PredictionResult => {
    // Calcolo dei gol attesi (media lambda stimata como Poisson standard)
    const { homeExpectedGoals, awayExpectedGoals } = calculateExpectedGoals(features);

    const matchesPlayedSafe = Math.max(features.matchesPlayed, 1);

    // Calcolo parametri Gamma per la squadra di casa
    let homeLambdaVariance = 0;
    let homeShape = 0;
    let homeRate = 0;
    if (homeExpectedGoals > 0) {
      homeLambdaVariance = (homeExpectedGoals * homeExpectedGoals) / matchesPlayedSafe;
      homeShape = (homeExpectedGoals * homeExpectedGoals) / homeLambdaVariance;
      homeRate = homeExpectedGoals / homeLambdaVariance;
    }

    // Calcolo parametri Gamma per la squadra ospite
    let awayLambdaVariance = 0;
    let awayShape = 0;
    let awayRate = 0;
    if (awayExpectedGoals > 0) {
      awayLambdaVariance = (awayExpectedGoals * awayExpectedGoals) / matchesPlayedSafe;
      awayShape = (awayExpectedGoals * awayExpectedGoals) / awayLambdaVariance;
      awayRate = awayExpectedGoals / awayLambdaVariance;
    }

    // Costruzione della griglia predittiva 0-12
    const CALC_LIMIT = 12;
    const calcGrid: number[][] = [];

    for (let h = 0; h <= CALC_LIMIT; h++) {
      calcGrid[h] = [];
      for (let a = 0; a <= CALC_LIMIT; a++) {
        // Probabilità di segnare h gol per la squadra di casa
        const pH = homeExpectedGoals > 0 
          ? negativeBinomialPredictiveProbability(h, homeShape, homeRate)
          : (h === 0 ? 1 : 0);

        // Probabilità di segnare a gol per la squadra ospite
        const pA = awayExpectedGoals > 0
          ? negativeBinomialPredictiveProbability(a, awayShape, awayRate)
          : (a === 0 ? 1 : 0);

        const cellVal = pH * pA;
        calcGrid[h][a] = isNaN(cellVal) || !isFinite(cellVal) ? 0 : cellVal;
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

    // Probabilità grezze
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

    // Goal / No Goal formula basata sulla predittiva Negative Binomial
    const pH0 = homeExpectedGoals > 0 
      ? negativeBinomialPredictiveProbability(0, homeShape, homeRate)
      : 1;
    const pA0 = awayExpectedGoals > 0 
      ? negativeBinomialPredictiveProbability(0, awayShape, awayRate)
      : 1;

    let goal = (1 - pH0) * (1 - pA0) * 100;
    goal = Math.max(0, Math.min(100, goal));
    const noGoal = 100 - goal;

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
    // Entropia normalizzata di Shannon per la distribuzione 1-X-2
    const p1 = probHomeWin / 100;
    const pX = probDraw / 100;
    const p2 = probAwayWin / 100;

    const term = (p: number) => (p > 0 ? p * Math.log(p) : 0);
    const entropyRaw = -(term(p1) + term(pX) + term(p2));
    const entropy = entropyRaw / Math.log(3);

    // Indice di incertezza (Entropia degli esiti 1-X-2) da 0 a 100
    const uncertaintyIndex = Math.min(100, Math.max(0, entropy * 100));

    // Qualità dei dati basata sulle partite giocate:
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

    // Indice preliminare di solidità (ex reliability)
    const solidityIndex = (0.5 * dataQuality) + (0.3 * concentration) + (0.2 * parameterStability);

    // Classificazione
    let classification: 'Bassa Incertezza' | 'Incertezza Moderata' | 'Alta Incertezza' = 'Incertezza Moderata';
    if (uncertaintyIndex < 50) {
      classification = 'Bassa Incertezza';
    } else if (uncertaintyIndex > 75) {
      classification = 'Alta Incertezza';
    }

    // --- Calcolo Incertezza dei Parametri (Epistemica) ---
    const homeLambdaStdDev = Math.sqrt(homeLambdaVariance);
    const awayLambdaStdDev = Math.sqrt(awayLambdaVariance);

    const homeRelativeUncertainty = homeExpectedGoals > 0 
      ? homeLambdaStdDev / homeExpectedGoals 
      : 0;

    const awayRelativeUncertainty = awayExpectedGoals > 0 
      ? awayLambdaStdDev / awayExpectedGoals 
      : 0;

    let epistemicIndex = ((homeRelativeUncertainty + awayRelativeUncertainty) / 2) * 100;
    epistemicIndex = Math.min(100, Math.max(0, epistemicIndex));

    const parameterUncertainty = {
      homeLambdaMean: homeExpectedGoals,
      awayLambdaMean: awayExpectedGoals,
      homeLambdaVariance,
      awayLambdaVariance,
      homeLambdaStdDev,
      awayLambdaStdDev,
      homeShape,
      awayShape,
      homeRate,
      awayRate,
      epistemicIndex: Math.round(epistemicIndex * 100) / 100
    };

    // --- Calcolo Incertezza Totale ---
    let totalUncertaintyIndex = 0.6 * uncertaintyIndex + 0.4 * epistemicIndex;
    totalUncertaintyIndex = Math.min(100, Math.max(0, totalUncertaintyIndex));

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
      modelId: 'poisson-gamma',
      modelName: 'Poisson-Gamma Empirico',
      modelVersion: '0.1.0',
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
      },
      parameterUncertainty,
      totalUncertaintyIndex: Math.round(totalUncertaintyIndex * 100) / 100
    };
  }
};
