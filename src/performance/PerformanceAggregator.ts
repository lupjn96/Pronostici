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
      sumBrier += ev.brierScore;
      sumLogLoss += ev.logLoss;
      sumProb += ev.probabilityAssignedToActualOutcome;
      sumHomeGoalsError += ev.absoluteHomeGoalsError;
      sumAwayGoalsError += ev.absoluteAwayGoalsError;
      sumTotalGoalsError += ev.totalGoalsAbsoluteError;
    }

    const accuracy1X2 = n > 0 ? (correct1X2Count / n) * 100 : 0;
    const exactScoreAccuracy = n > 0 ? (correctExactScoreCount / n) * 100 : 0;
    const averageBrierScore = n > 0 ? sumBrier / n : 0;
    const averageLogLoss = n > 0 ? sumLogLoss / n : 0;
    const averageProbabilityAssignedToActualOutcome = n > 0 ? sumProb / n : 0;
    const averageHomeGoalsError = n > 0 ? sumHomeGoalsError / n : 0;
    const averageAwayGoalsError = n > 0 ? sumAwayGoalsError / n : 0;
    const averageTotalGoalsError = n > 0 ? sumTotalGoalsError / n : 0;

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
