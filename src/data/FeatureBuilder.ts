/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput } from '../types';
import { MatchFeatures } from './types';

export class FeatureBuilder {
  /**
   * Riceve i dati normalizzati e prepara le feature usate dagli algoritmi.
   * Per ora restituisce esattamente le feature già utilizzate da Poisson.
   */
  static buildFeatures(normalized: ModelInput, dataSource: string = 'manual_input', modelReady: boolean = true): MatchFeatures {
    return {
      homeTeam: normalized.homeTeam,
      awayTeam: normalized.awayTeam,
      homeAttack: normalized.homeScoredAvg,
      homeDefense: normalized.homeConcededAvg,
      awayAttack: normalized.awayScoredAvg,
      awayDefense: normalized.awayConcededAvg,
      leagueHomeGoals: normalized.leagueHomeScoredAvg,
      leagueAwayGoals: normalized.leagueAwayScoredAvg,
      matchesPlayed: normalized.matchesPlayed,
      manualHomeAdjustment: normalized.homeAdvantage,
      timestamp: Date.now(),
      dataSource,
      modelReady
    };
  }
}
