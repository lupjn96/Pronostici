/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput, PredictionResult, ExactScoreProb, PredictionModel } from './types';

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
}

export function validateInput(input: ModelInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.homeTeam.trim()) errors.homeTeam = 'Inserisci il nome della squadra di casa';
  if (!input.awayTeam.trim()) errors.awayTeam = 'Inserisci il nome della squadra ospite';
  if (input.homeTeam.trim() && input.awayTeam.trim() && input.homeTeam.trim().toLowerCase() === input.awayTeam.trim().toLowerCase()) {
    errors.awayTeam = 'La squadra di casa e quella ospite devono essere diverse';
  }

  // Check per campi numerici negativi o NaN
  const checkNegativeAndNaN = (val: number, field: string, label: string) => {
    if (isNaN(val)) {
      errors[field] = `${label} deve essere un numero valido`;
    } else if (val < 0) {
      errors[field] = `${label} non può essere un valore negativo`;
    }
  };

  checkNegativeAndNaN(input.homeScoredAvg, 'homeScoredAvg', 'Media gol segnati in casa');
  checkNegativeAndNaN(input.homeConcededAvg, 'homeConcededAvg', 'Media gol subiti in casa');
  checkNegativeAndNaN(input.awayScoredAvg, 'awayScoredAvg', 'Media gol segnati in trasferta');
  checkNegativeAndNaN(input.awayConcededAvg, 'awayConcededAvg', 'Media gol subiti in trasferta');
  
  // Controlli divisione per zero
  if (isNaN(input.leagueHomeScoredAvg) || input.leagueHomeScoredAvg <= 0) {
    errors.leagueHomeScoredAvg = 'La media gol in casa del campionato deve essere maggiore di zero';
  }
  if (isNaN(input.leagueAwayScoredAvg) || input.leagueAwayScoredAvg <= 0) {
    errors.leagueAwayScoredAvg = 'La media gol in trasferta del campionato deve essere maggiore di zero';
  }

  // Controllo partite giocate
  if (isNaN(input.matchesPlayed) || input.matchesPlayed < 1) {
    errors.matchesPlayed = 'Il numero di partite giocate deve essere almeno 1';
  } else if (!Number.isInteger(input.matchesPlayed)) {
    errors.matchesPlayed = 'Il numero di partite deve essere un numero intero';
  }

  // Controllo vantaggio casa
  if (isNaN(input.homeAdvantage) || input.homeAdvantage < -100 || input.homeAdvantage > 200) {
    errors.homeAdvantage = 'Il vantaggio casa deve essere compreso tra -100% e +200%';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Modello di previsione basato sulla distribuzione di Poisson
export const poissonModel: PredictionModel = {
  id: 'poisson',
  name: 'Modello Poisson standard',
  description: 'Usa la classica distribuzione di Poisson per stimare le probabilità basandosi sulle medie storiche offensive e difensive dei team, pesate per le medie del campionato e il vantaggio casalingo.',
  status: 'active',
  calculate: (input: ModelInput): PredictionResult => {
    // 3. Calcolo dei gol attesi casa e ospite
    let homeExpectedGoals = 0;
    if (input.leagueHomeScoredAvg > 0) {
      // Attacco Casa * Difesa Ospite * Media Campionato Casa
      const homeAttack = input.homeScoredAvg / input.leagueHomeScoredAvg;
      const awayDefense = input.awayConcededAvg / input.leagueHomeScoredAvg;
      homeExpectedGoals = homeAttack * awayDefense * input.leagueHomeScoredAvg;
    } else {
      homeExpectedGoals = (input.homeScoredAvg + input.awayConcededAvg) / 2;
    }
    // Applica vantaggio casa (es: 15% significa moltiplicare per 1.15)
    homeExpectedGoals = homeExpectedGoals * (1 + input.homeAdvantage / 100);

    let awayExpectedGoals = 0;
    if (input.leagueAwayScoredAvg > 0) {
      // Attacco Ospite * Difesa Casa * Media Campionato Trasferta
      const awayAttack = input.awayScoredAvg / input.leagueAwayScoredAvg;
      const homeDefense = input.homeConcededAvg / input.leagueAwayScoredAvg;
      awayExpectedGoals = awayAttack * homeDefense * input.leagueAwayScoredAvg;
    } else {
      awayExpectedGoals = (input.awayScoredAvg + input.homeConcededAvg) / 2;
    }

    // Assicuriamoci che i gol attesi non siano mai negativi o NaN
    homeExpectedGoals = Math.max(0, isNaN(homeExpectedGoals) ? 0 : homeExpectedGoals);
    awayExpectedGoals = Math.max(0, isNaN(awayExpectedGoals) ? 0 : awayExpectedGoals);

    // Costruiamo una griglia 13x13 per calcolare 1-X-2 con elevata accuratezza
    const CALC_LIMIT = 12;
    const calcGrid: number[][] = [];
    for (let h = 0; h <= CALC_LIMIT; h++) {
      calcGrid[h] = [];
      for (let a = 0; a <= CALC_LIMIT; a++) {
        const pH = poissonProbability(h, homeExpectedGoals);
        const pA = poissonProbability(a, awayExpectedGoals);
        calcGrid[h][a] = pH * pA;
      }
    }

    // 5, 6, 7. Calcolo probabilità vittoria casa, pareggio, vittoria ospite
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

    // Normalizzazione delle probabilità 1-X-2 affinché sommino esattamente al 100%
    const totalRaw1X2 = rawHomeWin + rawDraw + rawAwayWin;
    const probHomeWin = totalRaw1X2 > 0 ? (rawHomeWin / totalRaw1X2) * 100 : 33.33;
    const probDraw = totalRaw1X2 > 0 ? (rawDraw / totalRaw1X2) * 100 : 33.34;
    const probAwayWin = totalRaw1X2 > 0 ? (rawAwayWin / totalRaw1X2) * 100 : 33.33;

    // 4. Matrice risultati da 0-0 a 6-6
    const scoreMatrix: number[][] = [];
    for (let h = 0; h <= 6; h++) {
      scoreMatrix[h] = [];
      for (let a = 0; a <= 6; a++) {
        // Usiamo la probabilità calcolata
        scoreMatrix[h][a] = calcGrid[h][a] * 100; // Memorizzata in %
      }
    }

    // 8, 9, 10, 11, 12, 13. Mercati aggiuntivi (basati sulla griglia ad alta precisione)
    let probUnder25 = 0;
    let probOver15 = 0;
    let probOver25 = 0;
    let probOver35 = 0;

    for (let h = 0; h <= CALC_LIMIT; h++) {
      for (let a = 0; a <= CALC_LIMIT; a++) {
        const sumGoals = h + a;
        const p = calcGrid[h][a] * 100;
        if (sumGoals < 2.5) {
          probUnder25 += p;
        } else {
          probOver25 += p;
        }
        if (sumGoals >= 1.5) {
          probOver15 += p;
        }
        if (sumGoals >= 3.5) {
          probOver35 += p;
        }
      }
    }

    // Goal / No Goal
    // Goal = Entrambe segnano almeno un gol
    // P(Goal) = (1 - P(H=0)) * (1 - P(A=0))
    const pH0 = poissonProbability(0, homeExpectedGoals);
    const pA0 = poissonProbability(0, awayExpectedGoals);
    const probGoal = (1 - pH0) * (1 - pA0) * 100;
    const probNoGoal = 100 - probGoal;

    // 14. Cinque risultati esatti più probabili (dalla griglia 0-0 a 6-6)
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

    // === SEZIONE INCERTEZZA ===
    // Entropia normalizzata di Shannon per la distribuzione 1-X-2
    // p_1, p_X, p_2 come frazioni (sommano a 1.0)
    const p1 = probHomeWin / 100;
    const pX = probDraw / 100;
    const p2 = probAwayWin / 100;

    const term = (p: number) => (p > 0 ? p * Math.log(p) : 0);
    const entropyRaw = -(term(p1) + term(pX) + term(p2));
    // Normalizziamo dividendo per ln(3) che è la massima entropia possibile con 3 classi
    const entropy = entropyRaw / Math.log(3);

    // Indice di incertezza da 0 a 100
    const uncertaintyIndex = Math.min(100, Math.max(0, entropy * 100));

    // Qualità dei dati basata sulle partite giocate:
    // • 0-4 partite: max 25
    // • 5-9 partite: max 50
    // • 10-19 partite: max 75
    // • da 20 partite in poi: max 100
    let dataQuality = 0;
    const M = input.matchesPlayed;
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

    // Affidabilità della stima
    // 50% qualità dati, 30% concentrazione, 20% stabilità dei parametri
    const reliability = (0.5 * dataQuality) + (0.3 * concentration) + (0.2 * parameterStability);

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
      over15: Math.min(100, Math.max(0, probOver15)),
      over25: Math.min(100, Math.max(0, probOver25)),
      over35: Math.min(100, Math.max(0, probOver35)),
      under25: Math.min(100, Math.max(0, probUnder25)),
      goal: Math.min(100, Math.max(0, probGoal)),
      noGoal: Math.min(100, Math.max(0, probNoGoal)),
      scoreMatrix,
      exactScores,
      uncertainty: {
        entropy,
        uncertaintyIndex: Math.round(uncertaintyIndex * 100) / 100,
        dataQuality: Math.round(dataQuality * 100) / 100,
        reliability: Math.round(reliability * 100) / 100,
        classification
      }
    };
  }
};
