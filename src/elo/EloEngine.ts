/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EloConfig } from './EloTypes';
import { ExactScoreProb, PredictionResult, MatchOutcome } from '../types';

// Default configuration for Football Elo
export const DEFAULT_ELO_CONFIG: EloConfig = {
  initialRating: 1500,
  kFactor: 32,
  homeAdvantage: 100, // Equivale a circa +100 punti Elo per la squadra in casa
  drawMargin: 80,     // Margine di pareggio simmetrico
};

/**
 * Calcola il fattoriale di un numero in modo sicuro.
 */
function factorial(n: number): number {
  if (n < 0) return 0;
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Calcola la probabilità di Poisson per k gol dato lambda.
 */
export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0) {
    return k === 0 ? 1 : 0;
  }
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Calcola l'outcome atteso (expected score) per la squadra di casa basato sulla differenza rating.
 * Formula classica: 1 / (1 + 10^(-D / 400))
 */
export function calculateExpectedScore(homeRating: number, awayRating: number, homeAdvantage: number): number {
  const diff = homeRating + homeAdvantage - awayRating;
  return 1 / (1 + Math.pow(10, -diff / 400));
}

/**
 * Calcola la variazione di rating Elo dopo una partita.
 * S è il punteggio reale (1 per vittoria casa, 0.5 per pareggio, 0 per vittoria fuori).
 */
export function calculateRatingChange(expectedScore: number, actualScore: number, kFactor: number): number {
  return kFactor * (actualScore - expectedScore);
}

/**
 * Converte la differenza di rating Elo in probabilità 1-X-2 usando un margine di pareggio simmetrico.
 */
export function calculate1X2Probabilities(
  homeRating: number,
  awayRating: number,
  config: EloConfig = DEFAULT_ELO_CONFIG,
  manualHomeAdjustment: number = 0
): { probHomeWin: number; probDraw: number; probAwayWin: number; ratingDiff: number } {
  // Applica l'home advantage standard e l'eventuale correzione manuale
  // manualHomeAdjustment è espresso in percentuale (es. +15% per default).
  // Mappiamo il manualHomeAdjustment a una variazione del rating di home advantage:
  // Se manualHomeAdjustment = 0, usiamo l'homeAdvantage standard.
  // Se manualHomeAdjustment != 0, lo scaliamo: (1 + adjustment / 100) * standard_home_advantage
  const effectiveHomeAdvantage = config.homeAdvantage * (1 + manualHomeAdjustment / 100);
  const ratingDiff = homeRating + effectiveHomeAdvantage - awayRating;

  // Formule logistiche con margine di pareggio (drawMargin, delta)
  const delta = config.drawMargin;
  
  const pHomeWinRaw = 1 / (1 + Math.pow(10, -(ratingDiff - delta) / 400));
  const pAwayWinRaw = 1 / (1 + Math.pow(10, (ratingDiff + delta) / 400));
  const pDrawRaw = Math.max(0, 1 - pHomeWinRaw - pAwayWinRaw);

  const sumRaw = pHomeWinRaw + pAwayWinRaw + pDrawRaw;

  let probHomeWin = sumRaw > 0 ? (pHomeWinRaw / sumRaw) * 100 : 33.3333;
  let probAwayWin = sumRaw > 0 ? (pAwayWinRaw / sumRaw) * 100 : 33.3333;
  let probDraw = sumRaw > 0 ? (pDrawRaw / sumRaw) * 100 : 33.3334;

  // Normalizzazione rigorosa al 100%
  probHomeWin = Math.max(0, Math.min(100, probHomeWin));
  probAwayWin = Math.max(0, Math.min(100, probAwayWin));
  probDraw = Math.max(0, Math.min(100, probDraw));

  const totalSum = probHomeWin + probAwayWin + probDraw;
  if (totalSum > 0) {
    probHomeWin = (probHomeWin / totalSum) * 100;
    probDraw = (probDraw / totalSum) * 100;
    probAwayWin = 100 - probHomeWin - probDraw; // Somma esattamente 100%
  }

  return {
    probHomeWin,
    probDraw,
    probAwayWin,
    ratingDiff,
  };
}

/**
 * Genera un PredictionResult completo a partire dai rating Elo di casa e ospite.
 * Utilizza la differenza Elo per stimare i gol attesi e una griglia Poisson per i mercati secondari.
 */
export function generatePredictionResult(
  homeRating: number,
  awayRating: number,
  homeTeam: string,
  awayTeam: string,
  leagueHomeGoals: number,
  leagueAwayGoals: number,
  matchesPlayed: number,
  manualHomeAdjustment: number = 0,
  config: EloConfig = DEFAULT_ELO_CONFIG,
  isManualFallback: boolean = false
): PredictionResult {
  const { probHomeWin, probDraw, probAwayWin, ratingDiff } = calculate1X2Probabilities(
    homeRating,
    awayRating,
    config,
    manualHomeAdjustment
  );

  // Stima dei gol attesi (Expected Goals) basata sull'expected score classico
  // Media totale gol del campionato (default 2.6 se non valido)
  const avgTotalGoals = (leagueHomeGoals > 0 && leagueAwayGoals > 0) ? (leagueHomeGoals + leagueAwayGoals) : 2.6;
  const expectedScoreHome = calculateExpectedScore(homeRating, awayRating, config.homeAdvantage * (1 + manualHomeAdjustment / 100));

  // Ripartizione proporzionale all'expected score
  let homeExpectedGoals = avgTotalGoals * expectedScoreHome;
  let awayExpectedGoals = avgTotalGoals * (1 - expectedScoreHome);

  homeExpectedGoals = Math.max(0.1, isNaN(homeExpectedGoals) ? 1.3 : homeExpectedGoals);
  awayExpectedGoals = Math.max(0.1, isNaN(awayExpectedGoals) ? 1.3 : awayExpectedGoals);

  // Creazione griglia 13x13 (0-12 gol) per mercati secondari
  const CALC_LIMIT = 12;
  const calcGrid: number[][] = [];
  let gridProbabilityMass = 0;

  for (let h = 0; h <= CALC_LIMIT; h++) {
    calcGrid[h] = [];
    const pH = poissonProbability(h, homeExpectedGoals);
    for (let a = 0; a <= CALC_LIMIT; a++) {
      const pA = poissonProbability(a, awayExpectedGoals);
      const cellVal = pH * pA;
      const cleanVal = isNaN(cellVal) || !isFinite(cellVal) ? 0 : cellVal;
      calcGrid[h][a] = cleanVal;
      gridProbabilityMass += cleanVal;
    }
  }

  gridProbabilityMass = Math.max(0.0001, Math.min(1, gridProbabilityMass));
  const residualProbabilityMass = Math.max(0, Math.min(1, 1 - gridProbabilityMass));

  // Costruiamo la matrice dei risultati 7x7 (0-6 gol) normalizzata
  const scoreMatrix: number[][] = [];
  for (let h = 0; h <= 6; h++) {
    scoreMatrix[h] = [];
    for (let a = 0; a <= 6; a++) {
      const normProb = (calcGrid[h]?.[a] || 0) / gridProbabilityMass * 100;
      scoreMatrix[h][a] = Math.max(0, Math.min(100, normProb));
    }
  }

  // Calcolo mercati Over/Under e Goal/No Goal usando la griglia
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

  let over15 = (rawOver15 / gridProbabilityMass) * 100;
  let over25 = (rawOver25 / gridProbabilityMass) * 100;
  let under25 = (rawUnder25 / gridProbabilityMass) * 100;
  let over35 = (rawOver35 / gridProbabilityMass) * 100;

  over15 = Math.max(0, Math.min(100, over15));
  over25 = Math.max(0, Math.min(100, over25));
  under25 = Math.max(0, Math.min(100, under25));
  over35 = Math.max(0, Math.min(100, over35));

  const sum25 = over25 + under25;
  if (sum25 > 0) {
    over25 = (over25 / sum25) * 100;
    under25 = 100 - over25;
  }

  // Goal / No Goal
  const pH0 = poissonProbability(0, homeExpectedGoals);
  const pA0 = poissonProbability(0, awayExpectedGoals);
  let goal = (1 - pH0) * (1 - pA0) * 100;
  goal = Math.max(0, Math.min(100, goal));
  const noGoal = 100 - goal;

  // Primi 5 risultati esatti più probabili
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

  // Qualità dati basata sulle partite giocate
  let dataQuality = 0;
  if (matchesPlayed <= 4) {
    dataQuality = matchesPlayed * 6.25;
  } else if (matchesPlayed <= 9) {
    dataQuality = 25 + (matchesPlayed - 4) * 5.0;
  } else if (matchesPlayed <= 19) {
    dataQuality = 50 + (matchesPlayed - 9) * 2.5;
  } else {
    dataQuality = Math.min(100, 75 + (matchesPlayed - 19) * 1.25);
  }

  const concentration = (1 - entropy) * 100;
  const parameterStability = Math.min(100, dataQuality * (0.8 + 0.2 * Math.min(1.0, Math.abs(homeExpectedGoals - awayExpectedGoals))));
  const solidityIndex = (0.5 * dataQuality) + (0.3 * concentration) + (0.2 * parameterStability);

  let classification: 'Bassa Incertezza' | 'Incertezza Moderata' | 'Alta Incertezza' = 'Incertezza Moderata';
  if (uncertaintyIndex < 50) {
    classification = 'Bassa Incertezza';
  } else if (uncertaintyIndex > 75) {
    classification = 'Alta Incertezza';
  }

  const warningsList: string[] = [];
  if (isManualFallback) {
    warningsList.push("Modalità manuale limitata: i rating Elo di entrambe le squadre sono stati inizializzati a 1500 per assenza di storico.");
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
    modelId: 'elo-rating',
    modelName: 'Elo Rating Model',
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
