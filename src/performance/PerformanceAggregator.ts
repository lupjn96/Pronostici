/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavedPrediction, PredictionEvaluation } from '../types';

export interface ModelPerformanceSummary {
  modelId: string;
  modelName: string;
  modelVersion: string;

  evaluatedPredictions: number;

  correct1X2Count: number;
  accuracy1X2: number; // Percentuale 0-100

  correctExactScoreCount: number;
  exactScoreAccuracy: number; // Percentuale 0-100

  averageBrierScore: number;
  averageLogLoss: number;

  averageProbabilityAssignedToActualOutcome: number; // Percentuale 0-100

  averageHomeGoalsError: number;
  averageAwayGoalsError: number;
  averageTotalGoalsError: number;
}

/**
 * Helper to safely handle any NaN, Infinity, or out-of-bounds numbers
 */
function safeNum(val: number, fallback: number = 0, min?: number, max?: number): number {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
    return fallback;
  }
  if (min !== undefined && val < min) return min;
  if (max !== undefined && val > max) return max;
  return val;
}

/**
 * Raggruppa e aggrega le performance dei modelli basandosi sui pronostici valutati
 */
export function aggregateModelPerformance(predictions: SavedPrediction[]): ModelPerformanceSummary[] {
  // Filtra solo le predizioni valutate (con il campo evaluation presente)
  const evaluated = predictions.filter(p => p.evaluation !== undefined) as (SavedPrediction & { evaluation: PredictionEvaluation })[];

  if (evaluated.length === 0) {
    return [];
  }

  // Raggruppa per modelId + modelVersion
  const groups: { [key: string]: { info: { id: string; name: string; version: string }; evals: PredictionEvaluation[] } } = {};

  for (const pred of evaluated) {
    const key = `${pred.evaluation.modelId}::${pred.evaluation.modelVersion}`;
    if (!groups[key]) {
      groups[key] = {
        info: {
          id: pred.evaluation.modelId,
          name: pred.evaluation.modelName,
          version: pred.evaluation.modelVersion
        },
        evals: []
      };
    }
    groups[key].evals.push(pred.evaluation);
  }

  const summaries: ModelPerformanceSummary[] = [];

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    const n = group.evals.length;

    let correct1X2Count = 0;
    let correctExactScoreCount = 0;
    let sumBrier = 0;
    let sumLogLoss = 0;
    let sumProb = 0;
    let sumHomeGoalsError = 0;
    let sumAwayGoalsError = 0;
    let sumTotalGoalsError = 0;

    for (const ev of group.evals) {
      if (ev.correct1X2) correct1X2Count++;
      if (ev.correctExactScore) correctExactScoreCount++;
      sumBrier += safeNum(ev.brierScore, 0, 0, 3);
      sumLogLoss += safeNum(ev.logLoss, 0, 0, 100);
      sumProb += safeNum(ev.probabilityAssignedToActualOutcome, 0, 0, 1);
      sumHomeGoalsError += safeNum(ev.absoluteHomeGoalsError, 0, 0);
      sumAwayGoalsError += safeNum(ev.absoluteAwayGoalsError, 0, 0);
      sumTotalGoalsError += safeNum(ev.totalGoalsAbsoluteError, 0, 0);
    }

    const accuracy1X2 = n > 0 ? safeNum((correct1X2Count / n) * 100, 0, 0, 100) : 0;
    const exactScoreAccuracy = n > 0 ? safeNum((correctExactScoreCount / n) * 100, 0, 0, 100) : 0;
    const averageBrierScore = n > 0 ? safeNum(sumBrier / n, 0, 0, 3) : 0;
    const averageLogLoss = n > 0 ? safeNum(sumLogLoss / n, 0, 0, 100) : 0;
    const averageProbabilityAssignedToActualOutcome = n > 0 ? safeNum((sumProb / n) * 100, 0, 0, 100) : 0;
    const averageHomeGoalsError = n > 0 ? safeNum(sumHomeGoalsError / n, 0, 0) : 0;
    const averageAwayGoalsError = n > 0 ? safeNum(sumAwayGoalsError / n, 0, 0) : 0;
    const averageTotalGoalsError = n > 0 ? safeNum(sumTotalGoalsError / n, 0, 0) : 0;

    summaries.push({
      modelId: group.info.id,
      modelName: group.info.name,
      modelVersion: group.info.version,
      evaluatedPredictions: n,
      correct1X2Count,
      accuracy1X2,
      correctExactScoreCount,
      exactScoreAccuracy,
      averageBrierScore,
      averageLogLoss,
      averageProbabilityAssignedToActualOutcome,
      averageHomeGoalsError,
      averageAwayGoalsError,
      averageTotalGoalsError
    });
  }

  return summaries;
}
