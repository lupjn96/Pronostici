/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchOutcome, PredictionResult, SavedPrediction, ActualMatchResult, PredictionEvaluation } from '../types';

/**
 * Determina l'esito della partita in base ai gol segnati
 */
export function getOutcome(homeGoals: number, awayGoals: number): MatchOutcome {
  if (homeGoals > awayGoals) return 'HOME';
  if (homeGoals === awayGoals) return 'DRAW';
  return 'AWAY';
}

/**
 * Determina l'esito previsto in base alle probabilità del modello
 * In caso di parità usa un criterio deterministico: 1. DRAW, 2. HOME, 3. AWAY
 */
export function getPredictedOutcome(result: PredictionResult): MatchOutcome {
  const pHome = result.probHomeWin;
  const pDraw = result.probDraw;
  const pAway = result.probAwayWin;
  const maxProb = Math.max(pHome, pDraw, pAway);

  if (pDraw === maxProb) {
    return 'DRAW';
  }
  if (pHome === maxProb) {
    return 'HOME';
  }
  return 'AWAY';
}

/**
 * Valuta una previsione a partire dal risultato reale del match
 */
export function evaluatePrediction(
  savedPrediction: SavedPrediction,
  actualResult: ActualMatchResult
): PredictionEvaluation {
  const result = savedPrediction.result;
  const predictedOutcome = getPredictedOutcome(result);
  const actualOutcome = actualResult.outcome;

  const correct1X2 = predictedOutcome === actualOutcome;

  // correctExactScore è true se e solo se il primo elemento di exactScores corrisponde al risultato reale
  let correctExactScore = false;
  if (result.exactScores && result.exactScores.length > 0) {
    const topScore = result.exactScores[0];
    correctExactScore = topScore.homeGoals === actualResult.homeGoals && 
                        topScore.awayGoals === actualResult.awayGoals;
  }

  // Probabilità assegnata all'esito reale (in percentuale da 0 a 100)
  let probabilityAssignedToActualOutcome = 0;
  if (actualOutcome === 'HOME') {
    probabilityAssignedToActualOutcome = result.probHomeWin;
  } else if (actualOutcome === 'DRAW') {
    probabilityAssignedToActualOutcome = result.probDraw;
  } else {
    probabilityAssignedToActualOutcome = result.probAwayWin;
  }

  // 1. Calcolo Brier Score (scala 0-1 per le probabilità)
  const pHome = result.probHomeWin / 100;
  const pDraw = result.probDraw / 100;
  const pAway = result.probAwayWin / 100;

  const yHome = actualOutcome === 'HOME' ? 1 : 0;
  const yDraw = actualOutcome === 'DRAW' ? 1 : 0;
  const yAway = actualOutcome === 'AWAY' ? 1 : 0;

  const brierScore = Math.pow(pHome - yHome, 2) + Math.pow(pDraw - yDraw, 2) + Math.pow(pAway - yAway, 2);

  // 2. Calcolo Log Loss con protezione numerica
  const pFrac = probabilityAssignedToActualOutcome / 100;
  const epsilon = 1e-15;
  const protectedProb = Math.max(epsilon, Math.min(1 - epsilon, pFrac));
  const logLoss = -Math.log(protectedProb);

  // 3. Calcolo Errori sui gol
  const predictedHomeGoals = result.homeExpectedGoals;
  const predictedAwayGoals = result.awayExpectedGoals;
  const actualHomeGoals = actualResult.homeGoals;
  const actualAwayGoals = actualResult.awayGoals;

  const absoluteHomeGoalsError = Math.abs(predictedHomeGoals - actualHomeGoals);
  const absoluteAwayGoalsError = Math.abs(predictedAwayGoals - actualAwayGoals);
  const totalGoalsAbsoluteError = Math.abs((predictedHomeGoals + predictedAwayGoals) - (actualHomeGoals + actualAwayGoals));

  return {
    modelId: result.modelId,
    modelName: result.modelName,
    modelVersion: result.modelVersion,
    predictedOutcome,
    actualOutcome,
    correct1X2,
    correctExactScore,
    brierScore,
    logLoss,
    probabilityAssignedToActualOutcome,
    predictedHomeGoals,
    predictedAwayGoals,
    actualHomeGoals,
    actualAwayGoals,
    absoluteHomeGoalsError,
    absoluteAwayGoalsError,
    totalGoalsAbsoluteError,
    evaluatedAt: new Date().toISOString()
  };
}
