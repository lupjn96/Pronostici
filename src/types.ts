/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchFeatures } from './data/types';

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
  parameterUncertainty?: {
    homeLambdaMean: number;
    awayLambdaMean: number;
    homeLambdaVariance: number;
    awayLambdaVariance: number;
    homeLambdaStdDev: number;
    awayLambdaStdDev: number;
    homeShape: number;
    awayShape: number;
    homeRate: number;
    awayRate: number;
    epistemicIndex: number;
  };
  totalUncertaintyIndex?: number;
  dixonColesParameters?: {
    rho: number;
  };
  eloManualFallback?: boolean;
  warnings?: string[];
}

export interface PredictionModel {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  calculate: (features: MatchFeatures) => PredictionResult;
}

export interface SavedPrediction {
  id: string;
  dateTime: string;
  input: ModelInput;
  result: PredictionResult;
  actualResult?: ActualMatchResult;
  evaluation?: PredictionEvaluation;
}

export type MatchOutcome = 'HOME' | 'DRAW' | 'AWAY';

export interface ActualMatchResult {
  homeGoals: number;
  awayGoals: number;
  outcome: MatchOutcome;
  recordedAt: string;
}

export interface PredictionEvaluation {
  modelId: string;
  modelName: string;
  modelVersion: string;

  predictedOutcome: MatchOutcome;
  actualOutcome: MatchOutcome;

  correct1X2: boolean;
  correctExactScore: boolean;

  brierScore: number;
  logLoss: number;

  probabilityAssignedToActualOutcome: number;

  predictedHomeGoals: number;
  predictedAwayGoals: number;
  actualHomeGoals: number;
  actualAwayGoals: number;

  absoluteHomeGoalsError: number;
  absoluteAwayGoalsError: number;
  totalGoalsAbsoluteError: number;

  evaluatedAt: string;
}

