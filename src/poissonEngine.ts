/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput, PredictionResult, ExactScoreProb, PredictionModel, SavedPrediction } from './types';
import { calculateExpectedGoals } from './engines/sharedExpectedGoals';
import { MatchFeatures } from './data/types';
import { FootballDataEngine } from './data/FootballDataEngine';

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
  // Formula: (lambda^k * e^-lambda) / k!
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Funzione di validazione dei dati di input
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validateInput(input: ModelInput): ValidationResult {
  const engine = new FootballDataEngine();
  engine.loadManualInput(input);
  return engine.validate();
}

// Modello di previsione basato sulla distribuzione di Poisson v1.1
export const poissonModel: PredictionModel = {
  id: 'poisson-standard',
  name: 'Poisson standard',
  description: 'Usa la classica distribuzione di Poisson per stimare le probabilità basandosi sulle medie storiche offensive e difensive dei team, pesate per le medie del campionato e l\'eventuale correzione manuale casa.',
  status: 'active',
  calculate: (features: MatchFeatures): PredictionResult => {
    // 3. Calcolo dei gol attesi casa e ospite tramite modulo condiviso
    const { homeExpectedGoals, awayExpectedGoals } = calculateExpectedGoals(features);

    // Costruiamo una griglia 13x13 per calcolare 1-X-2 con elevata accuratezza (0-12 gol)
    const CALC_LIMIT = 12;
    const calcGrid: number[][] = [];
    for (let h = 0; h <= CALC_LIMIT; h++) {
      calcGrid[h] = [];
      for (let a = 0; a <= CALC_LIMIT; a++) {
        const pH = poissonProbability(h, homeExpectedGoals);
        const pA = poissonProbability(a, awayExpectedGoals);
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

    // Goal / No Goal formula analitica Poisson
    const pH0 = poissonProbability(0, homeExpectedGoals);
    const pA0 = poissonProbability(0, awayExpectedGoals);
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
    // Normalizziamo dividendo per ln(3) che è la massima entropia possibile con 3 classi
    const entropy = entropyRaw / Math.log(3);

    // Indice di incertezza (Entropia degli esiti 1-X-2) da 0 a 100
    const uncertaintyIndex = Math.min(100, Math.max(0, entropy * 100));

    // Qualità dei dati basata sulle partite giocate:
    // • 0-4 partite: max 25
    // • 5-9 partite: max 50
    // • 10-19 partite: max 75
    // • da 20 partite in poi: max 100
    let dataQuality = 0;
    const M = features.matchesPlayed;
    if (M <= 4) {
      dataQuality = M * 6.25; // a 4 partite è 25
    } else if (M <= 9) {
      dataQuality = 25 + (M - 4) * 5.0; // a 9 partite è 50
    } else if (M <= 19) {
      dataQuality = 50 + (M - 9) * 2.5; // a 19 partite è 75
    } else {
      dataQuality = Math.min(100, 75 + (M - 19) * 1.25); // a 39 partite arriva a 100
    }

    // Concentrazione della previsione
    const concentration = (1 - entropy) * 100;

    // Stabilità dei parametri
    const xGDiff = Math.abs(homeExpectedGoals - awayExpectedGoals);
    const parameterStability = Math.min(100, dataQuality * (0.8 + 0.2 * Math.min(1.0, xGDiff)));

    // Indice preliminare di solidità (ex reliability)
    // 50% qualità dati, 30% concentrazione, 20% stabilità dei parametri
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
      modelId: 'poisson-standard',
      modelName: 'Poisson standard',
      modelVersion: '1.1.0',
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

export function migrateSavedPrediction(pred: any): SavedPrediction {
  if (!pred || typeof pred !== 'object') {
    throw new Error('Record non valido');
  }

  const id = pred.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
  const dateTime = pred.dateTime || new Date().toISOString();

  // Input data mapping
  const input: ModelInput = {
    homeTeam: pred.input?.homeTeam || 'Sconosciuta',
    awayTeam: pred.input?.awayTeam || 'Sconosciuta',
    homeScoredAvg: Number(pred.input?.homeScoredAvg) || 0,
    homeConcededAvg: Number(pred.input?.homeConcededAvg) || 0,
    awayScoredAvg: Number(pred.input?.awayScoredAvg) || 0,
    awayConcededAvg: Number(pred.input?.awayConcededAvg) || 0,
    leagueHomeScoredAvg: Number(pred.input?.leagueHomeScoredAvg) || 1.4,
    leagueAwayScoredAvg: Number(pred.input?.leagueAwayScoredAvg) || 1.1,
    matchesPlayed: Number(pred.input?.matchesPlayed) || 15,
    homeAdvantage: Number(pred.input?.homeAdvantage) || 0
  };

  // Result data mapping
  const rawResult = pred.result || {};
  const uncertainty = rawResult.uncertainty || {};

  // Resolve solidityIndex or reliability
  let solidityIndex = 0;
  if (uncertainty.solidityIndex !== undefined) {
    solidityIndex = Number(uncertainty.solidityIndex);
  } else if (uncertainty.reliability !== undefined) {
    solidityIndex = Number(uncertainty.reliability);
  }

  const result: PredictionResult = {
    homeExpectedGoals: Number(rawResult.homeExpectedGoals) || 0,
    awayExpectedGoals: Number(rawResult.awayExpectedGoals) || 0,
    probHomeWin: Number(rawResult.probHomeWin) || 0,
    probDraw: Number(rawResult.probDraw) || 0,
    probAwayWin: Number(rawResult.probAwayWin) || 0,
    over15: Number(rawResult.over15) || 0,
    over25: Number(rawResult.over25) || 0,
    over35: Number(rawResult.over35) || 0,
    under25: Number(rawResult.under25) || 0,
    goal: Number(rawResult.goal) || 0,
    noGoal: Number(rawResult.noGoal) || 0,
    scoreMatrix: Array.isArray(rawResult.scoreMatrix) ? rawResult.scoreMatrix : Array(7).fill(0).map(() => Array(7).fill(0)),
    exactScores: Array.isArray(rawResult.exactScores) ? rawResult.exactScores : [],
    modelId: rawResult.modelId || 'poisson-standard',
    modelName: rawResult.modelName || 'Poisson standard',
    modelVersion: rawResult.modelVersion || '1.0.0',
    calculationDiagnostics: {
      gridProbabilityMass: rawResult.calculationDiagnostics?.gridProbabilityMass !== undefined ? Number(rawResult.calculationDiagnostics.gridProbabilityMass) : 1,
      residualProbabilityMass: rawResult.calculationDiagnostics?.residualProbabilityMass !== undefined ? Number(rawResult.calculationDiagnostics.residualProbabilityMass) : 0,
      calculationLimit: rawResult.calculationDiagnostics?.calculationLimit !== undefined ? Number(rawResult.calculationDiagnostics.calculationLimit) : 12,
    },
    uncertainty: {
      entropy: Number(uncertainty.entropy) || 0,
      uncertaintyIndex: Number(uncertainty.uncertaintyIndex) || 0,
      dataQuality: Number(uncertainty.dataQuality) || 0,
      solidityIndex: solidityIndex,
      classification: uncertainty.classification || 'Incertezza Moderata'
    },
    parameterUncertainty: rawResult.parameterUncertainty ? {
      homeLambdaMean: Number(rawResult.parameterUncertainty.homeLambdaMean) || 0,
      awayLambdaMean: Number(rawResult.parameterUncertainty.awayLambdaMean) || 0,
      homeLambdaVariance: Number(rawResult.parameterUncertainty.homeLambdaVariance) || 0,
      awayLambdaVariance: Number(rawResult.parameterUncertainty.awayLambdaVariance) || 0,
      homeLambdaStdDev: Number(rawResult.parameterUncertainty.homeLambdaStdDev) || 0,
      awayLambdaStdDev: Number(rawResult.parameterUncertainty.awayLambdaStdDev) || 0,
      homeShape: Number(rawResult.parameterUncertainty.homeShape) || 0,
      awayShape: Number(rawResult.parameterUncertainty.awayShape) || 0,
      homeRate: Number(rawResult.parameterUncertainty.homeRate) || 0,
      awayRate: Number(rawResult.parameterUncertainty.awayRate) || 0,
      epistemicIndex: Number(rawResult.parameterUncertainty.epistemicIndex) || 0
    } : undefined,
    totalUncertaintyIndex: rawResult.totalUncertaintyIndex !== undefined ? Number(rawResult.totalUncertaintyIndex) : undefined,
    dixonColesParameters: rawResult.dixonColesParameters && !isNaN(Number(rawResult.dixonColesParameters.rho)) && isFinite(Number(rawResult.dixonColesParameters.rho))
      ? { rho: Number(rawResult.dixonColesParameters.rho) }
      : undefined
  };

  return {
    id,
    dateTime,
    input,
    result
  };
}

