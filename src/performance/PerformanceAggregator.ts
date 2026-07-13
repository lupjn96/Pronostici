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

  averageProbabilityAssignedToActualOutcome: number; // Frazione interna da 0 a 1

  averageHomeGoalsError: number;
  averageAwayGoalsError: number;
  averageTotalGoalsError: number;
}

/**
 * Verifica se un'evaluation è valida secondo criteri statistici rigorosi
 */
export function isValidEvaluation(evaluation: any): boolean {
  if (!evaluation || typeof evaluation !== 'object') return false;

  const brierScore = evaluation.brierScore;
  const logLoss = evaluation.logLoss;
  const probabilityAssignedToActualOutcome = evaluation.probabilityAssignedToActualOutcome;
  const absoluteHomeGoalsError = evaluation.absoluteHomeGoalsError;
  const absoluteAwayGoalsError = evaluation.absoluteAwayGoalsError;
  const totalGoalsAbsoluteError = evaluation.totalGoalsAbsoluteError;
  const correct1X2 = evaluation.correct1X2;
  const correctExactScore = evaluation.correctExactScore;
  const modelId = evaluation.modelId;
  const modelName = evaluation.modelName;
  const modelVersion = evaluation.modelVersion;

  if (typeof brierScore !== 'number' || isNaN(brierScore) || !isFinite(brierScore) || brierScore < 0 || brierScore > 2) return false;
  if (typeof logLoss !== 'number' || isNaN(logLoss) || !isFinite(logLoss) || logLoss < 0) return false;
  if (typeof probabilityAssignedToActualOutcome !== 'number' || isNaN(probabilityAssignedToActualOutcome) || !isFinite(probabilityAssignedToActualOutcome) || probabilityAssignedToActualOutcome < 0 || probabilityAssignedToActualOutcome > 1) return false;
  if (typeof absoluteHomeGoalsError !== 'number' || isNaN(absoluteHomeGoalsError) || !isFinite(absoluteHomeGoalsError) || absoluteHomeGoalsError < 0) return false;
  if (typeof absoluteAwayGoalsError !== 'number' || isNaN(absoluteAwayGoalsError) || !isFinite(absoluteAwayGoalsError) || absoluteAwayGoalsError < 0) return false;
  if (typeof totalGoalsAbsoluteError !== 'number' || isNaN(totalGoalsAbsoluteError) || !isFinite(totalGoalsAbsoluteError) || totalGoalsAbsoluteError < 0) return false;

  if (typeof correct1X2 !== 'boolean') return false;
  if (typeof correctExactScore !== 'boolean') return false;

  if (typeof modelId !== 'string' || modelId.trim() === '') return false;
  if (typeof modelName !== 'string' || modelName.trim() === '') return false;
  if (typeof modelVersion !== 'string' || modelVersion.trim() === '') return false;

  return true;
}

/**
 * Raggruppa e aggrega le performance dei modelli basandosi sui pronostici valutati
 */
export function aggregateModelPerformance(predictions: SavedPrediction[]): ModelPerformanceSummary[] {
  // Filtra solo le predizioni con evaluation presente e valida
  const evaluated = predictions.filter(p => p.evaluation !== undefined && isValidEvaluation(p.evaluation)) as (SavedPrediction & { evaluation: PredictionEvaluation })[];

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
