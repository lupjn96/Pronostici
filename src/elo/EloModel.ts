/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PredictionModel, PredictionResult } from '../types';
import { MatchFeatures } from '../data/types';
import { generatePredictionResult, DEFAULT_ELO_CONFIG } from './EloEngine';

export const eloModel: PredictionModel = {
  id: 'elo-rating',
  name: 'Elo Rating Model',
  description: 'Un modello basato sul punteggio di forza relativo Elo dei team. Registra i guadagni e le perdite storiche dei punti forza ad ogni partita. In modalità manuale ha limiti poiché i rating partono entrambi da 1500.',
  status: 'active',
  calculate: (features: MatchFeatures): PredictionResult => {
    // In modalità manuale (stateless), non disponiamo del rating storico calcolato cronologicamente.
    // Usiamo quindi il rating iniziale standard di 1500 per entrambi i team, evidenziando il limite tramite diagnostics/diagnostica.
    return generatePredictionResult(
      DEFAULT_ELO_CONFIG.initialRating,
      DEFAULT_ELO_CONFIG.initialRating,
      features.homeTeam,
      features.awayTeam,
      features.leagueHomeGoals,
      features.leagueAwayGoals,
      features.matchesPlayed,
      features.manualHomeAdjustment,
      DEFAULT_ELO_CONFIG,
      true // isManualFallback
    );
  }
};
