export type BacktestStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface BacktestOptions {
  competition: string;
  startDate?: string;
  endDate?: string;

  modelIds: string[];

  minimumMatches: number;
  lastMatches?: number;

  timeDecayEnabled: boolean;
  timeDecayRate?: number;

  batchSize: number;

  includeInsufficientDataMatches: boolean;
}

export interface BacktestMatchResult {
  id: string; // deterministico: runId_historicalMatchId_modelId_modelVersion
  runId: string; // runId di appartenenza per query in IndexedDB
  historicalMatchId: string;

  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;

  modelId: string;
  modelName: string;
  modelVersion: string;

  actualHomeGoals: number;
  actualAwayGoals: number;
  actualOutcome: 'HOME' | 'DRAW' | 'AWAY';

  predictedOutcome: 'HOME' | 'DRAW' | 'AWAY';

  probHomeWin: number; // percentuale 0-100
  probDraw: number;    // percentuale 0-100
  probAwayWin: number; // percentuale 0-100

  homeExpectedGoals: number;
  awayExpectedGoals: number;

  correct1X2: boolean;
  correctExactScore: boolean;

  brierScore: number;
  logLoss: number;

  probabilityAssignedToActualOutcome: number; // scala 0-1

  absoluteHomeGoalsError: number;
  absoluteAwayGoalsError: number;
  totalGoalsAbsoluteError: number;

  topExactScore?: string;

  dataCoverageScore: number;
  homeHistoricalMatches: number;
  awayHistoricalMatches: number;

  skipped: boolean;
  skipReason?: string;
}

export interface BacktestRun {
  id: string;
  name: string;

  createdAt: string;
  completedAt?: string;

  status: BacktestStatus;
  options: BacktestOptions;

  totalCandidateMatches: number;
  processedMatches: number;
  evaluatedPredictions: number;
  skippedMatches: number;

  // Stato per la ripresa (checkpointing)
  lastProcessedMatchIndex: number;
  lastProcessedDate?: string;

  error?: string;
}

export interface BacktestModelSummary {
  modelId: string;
  modelName: string;
  modelVersion: string;
  evaluatedPredictions: number;
  skippedPredictions: number;
  correct1X2Count: number;
  accuracy1X2: number;
  correctExactScoreCount: number;
  exactScoreAccuracy: number;
  averageBrierScore: number;
  averageLogLoss: number;
  averageProbabilityAssignedToActualOutcome: number;
  averageHomeGoalsError: number;
  averageAwayGoalsError: number;
  averageTotalGoalsError: number;
}

