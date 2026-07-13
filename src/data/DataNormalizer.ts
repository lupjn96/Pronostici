/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput } from '../types';

export class DataNormalizer {
  /**
   * Sanitizza e normalizza l'input grezzo, garantendo l'assenza di NaN, Infinity e valori fuori dai limiti reali.
   */
  static normalize(input: any): ModelInput {
    const parseValue = (val: any): number => {
      if (val === undefined || val === null) return NaN;
      if (typeof val === 'number') return val;
      const str = String(val).trim().replace(',', '.');
      if (str === '') return NaN;
      return Number(str);
    };

    const homeTeam = input?.homeTeam !== undefined && input?.homeTeam !== null ? String(input.homeTeam).trim() : '';
    const awayTeam = input?.awayTeam !== undefined && input?.awayTeam !== null ? String(input.awayTeam).trim() : '';

    const homeScoredAvg = parseValue(input?.homeScoredAvg);
    const homeConcededAvg = parseValue(input?.homeConcededAvg);
    const awayScoredAvg = parseValue(input?.awayScoredAvg);
    const awayConcededAvg = parseValue(input?.awayConcededAvg);
    const leagueHomeScoredAvg = parseValue(input?.leagueHomeScoredAvg);
    const leagueAwayScoredAvg = parseValue(input?.leagueAwayScoredAvg);
    const matchesPlayed = parseValue(input?.matchesPlayed);
    let homeAdvantage = parseValue(input?.homeAdvantage);

    if (typeof homeAdvantage === 'number' && !isNaN(homeAdvantage) && isFinite(homeAdvantage)) {
      homeAdvantage = Math.max(-100, Math.min(200, homeAdvantage));
    }

    return {
      homeTeam,
      awayTeam,
      homeScoredAvg,
      homeConcededAvg,
      awayScoredAvg,
      awayConcededAvg,
      leagueHomeScoredAvg,
      leagueAwayScoredAvg,
      matchesPlayed,
      homeAdvantage
    };
  }
}
