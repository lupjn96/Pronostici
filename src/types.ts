/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MODEL_VERSION = '1.1.0';

export interface ModelInput {
  homeTeam: string;
  awayTeam: string;
  homeScoredAvg: number;
  homeConcededAvg: number;
  awayScoredAvg: number;
  awayConcededAvg: number;
  leagueHomeScoredAvg: number;
  leagueAwayScoredAvg: number;
  matchesPlayed: number;
  homeAdvantage: number; // Percentaggio aggiuntivo di vantaggio in casa, es: 10 per +10%
}

export interface ExactScoreProb {
  score: string; // es: "1-0"
  homeGoals: number;
  awayGoals: number;
  probability: number; // Percentuale da 0 a 100
}

export interface PredictionResult {
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  probHomeWin: number; // % (0-100)
  probDraw: number;    // % (0-100)
  probAwayWin: number; // % (0-100)
  over15: number;      // % (0-100)
  over25: number;      // % (0-100)
  over35: number;      // % (0-100)
  under25: number;     // % (0-100)
  goal: number;        // % (0-100)
  noGoal: number;      // % (0-100)
  scoreMatrix: number[][]; // Matrice 7x7 da 0-0 a 6-6
  exactScores: ExactScoreProb[]; // Top 5 risultati esatti
  modelId: string;
  modelName: string;
  modelVersion: string;
  calculationDiagnostics: {
    gridProbabilityMass: number;
    residualProbabilityMass: number;
    calculationLimit: number;
  };
  uncertainty: {
    entropy: number;            // Entropia normalizzata da 0 a 1
    uncertaintyIndex: number;   // Indice da 0 a 100
    dataQuality: number;        // Qualità dati da 0 a 100
    solidityIndex: number;      // Indice preliminare di solidità da 0 a 100
    classification: 'Bassa Incertezza' | 'Incertezza Moderata' | 'Alta Incertezza';
  };
}

export interface PredictionModel {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  calculate: (input: ModelInput) => PredictionResult;
}

export interface SavedPrediction {
  id: string;
  dateTime: string;
  input: ModelInput;
  result: PredictionResult;
}
