import { BacktestMatchResult, BacktestModelSummary } from './BacktestTypes';

/**
 * Raggruppa e aggrega i risultati del backtest per combinazione di modello e versione.
 * Ignora i record skipped e convalida rigorosamente le metriche per evitare NaN/Infinity o anomalie.
 */
export function aggregateBacktestResults(results: BacktestMatchResult[]): BacktestModelSummary[] {
  const groups: Record<string, {
    modelId: string;
    modelName: string;
    modelVersion: string;
    evaluated: BacktestMatchResult[];
    skippedCount: number;
  }> = {};

  for (const r of results) {
    const key = `${r.modelId}_${r.modelVersion}`;
    if (!groups[key]) {
      groups[key] = {
        modelId: r.modelId,
        modelName: r.modelName,
        modelVersion: r.modelVersion,
        evaluated: [],
        skippedCount: 0
      };
    }
    
    if (r.skipped) {
      groups[key].skippedCount++;
    } else {
      // Validazione metriche
      const brier = r.brierScore;
      const logLoss = r.logLoss;
      const prob = r.probabilityAssignedToActualOutcome;

      // Se uno dei valori critici è invalido (NaN, Infinity, fuori range consentito), lo scartiamo
      if (
        typeof brier !== 'number' || isNaN(brier) || !isFinite(brier) || brier < 0 || brier > 2 ||
        typeof logLoss !== 'number' || isNaN(logLoss) || !isFinite(logLoss) || logLoss < 0 ||
        typeof prob !== 'number' || isNaN(prob) || !isFinite(prob) || prob < 0 || prob > 1
      ) {
        continue;
      }

      groups[key].evaluated.push(r);
    }
  }

  const summaries: BacktestModelSummary[] = [];

  for (const group of Object.values(groups)) {
    const totalEvaluated = group.evaluated.length;
    
    if (totalEvaluated === 0) {
      // Se non ci sono previsioni valutate per questo modello, creiamo comunque una riga a 0 per non perdere traccia
      summaries.push({
        modelId: group.modelId,
        modelName: group.modelName,
        modelVersion: group.modelVersion,
        evaluatedPredictions: 0,
        skippedPredictions: group.skippedCount,
        correct1X2Count: 0,
        accuracy1X2: 0,
        correctExactScoreCount: 0,
        exactScoreAccuracy: 0,
        averageBrierScore: 0,
        averageLogLoss: 0,
        averageProbabilityAssignedToActualOutcome: 0,
        averageHomeGoalsError: 0,
        averageAwayGoalsError: 0,
        averageTotalGoalsError: 0
      });
      continue;
    }

    let correct1X2Count = 0;
    let correctExactScoreCount = 0;
    let sumBrier = 0;
    let sumLogLoss = 0;
    let sumProb = 0;
    let sumHomeGoalsErr = 0;
    let sumAwayGoalsErr = 0;
    let sumTotalGoalsErr = 0;

    for (const m of group.evaluated) {
      if (m.correct1X2) correct1X2Count++;
      if (m.correctExactScore) correctExactScoreCount++;
      sumBrier += m.brierScore;
      sumLogLoss += m.logLoss;
      sumProb += m.probabilityAssignedToActualOutcome;
      sumHomeGoalsErr += m.absoluteHomeGoalsError;
      sumAwayGoalsErr += m.absoluteAwayGoalsError;
      sumTotalGoalsErr += m.totalGoalsAbsoluteError;
    }

    summaries.push({
      modelId: group.modelId,
      modelName: group.modelName,
      modelVersion: group.modelVersion,
      evaluatedPredictions: totalEvaluated,
      skippedPredictions: group.skippedCount,
      correct1X2Count,
      accuracy1X2: (correct1X2Count / totalEvaluated) * 100,
      correctExactScoreCount,
      exactScoreAccuracy: (correctExactScoreCount / totalEvaluated) * 100,
      averageBrierScore: sumBrier / totalEvaluated,
      averageLogLoss: sumLogLoss / totalEvaluated,
      averageProbabilityAssignedToActualOutcome: sumProb / totalEvaluated,
      averageHomeGoalsError: sumHomeGoalsErr / totalEvaluated,
      averageAwayGoalsError: sumAwayGoalsErr / totalEvaluated,
      averageTotalGoalsError: sumTotalGoalsErr / totalEvaluated
    });
  }

  return summaries;
}

/**
 * Ordina l'aggregato dei modelli per produrre la "Classifica preliminare del backtest".
 * Criteri:
 * 1. averageLogLoss crescente
 * 2. averageBrierScore crescente
 * 3. accuracy1X2 decrescente
 * 4. evaluatedPredictions decrescente
 */
export function rankBacktestModels(summaries: BacktestModelSummary[]): BacktestModelSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.averageLogLoss !== b.averageLogLoss) {
      return a.averageLogLoss - b.averageLogLoss;
    }
    if (a.averageBrierScore !== b.averageBrierScore) {
      return a.averageBrierScore - b.averageBrierScore;
    }
    if (b.accuracy1X2 !== a.accuracy1X2) {
      return b.accuracy1X2 - a.accuracy1X2;
    }
    return b.evaluatedPredictions - a.evaluatedPredictions;
  });
}
