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
    const homeTeam = String(input?.homeTeam || '').trim() || 'Home Team';
    const awayTeam = String(input?.awayTeam || '').trim() || 'Away Team';

    const parseNum = (val: any, defaultVal: number): number => {
      if (val === undefined || val === null) return defaultVal;
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (isNaN(num) || !isFinite(num)) {
        return defaultVal;
      }
      return num;
    };

    let homeScoredAvg = parseNum(input?.homeScoredAvg, 0);
    let homeConcededAvg = parseNum(input?.homeConcededAvg, 0);
    let awayScoredAvg = parseNum(input?.awayScoredAvg, 0);
    let awayConcededAvg = parseNum(input?.awayConcededAvg, 0);
    let leagueHomeScoredAvg = parseNum(input?.leagueHomeScoredAvg, 1.4);
    let leagueAwayScoredAvg = parseNum(input?.leagueAwayScoredAvg, 1.1);
    let matchesPlayed = parseNum(input?.matchesPlayed, 10);
    let homeAdvantage = parseNum(input?.homeAdvantage, 0);

    // Blocca valori negativi impossibili per le medie gol e limita a un massimo ragionevole
    homeScoredAvg = Math.max(0, Math.min(20, homeScoredAvg));
    homeConcededAvg = Math.max(0, Math.min(20, homeConcededAvg));
    awayScoredAvg = Math.max(0, Math.min(20, awayScoredAvg));
    awayConcededAvg = Math.max(0, Math.min(20, awayConcededAvg));

    // Le medie campionato non possono essere <= 0 per evitare divisioni per zero
    if (leagueHomeScoredAvg <= 0) leagueHomeScoredAvg = 1.4;
    leagueHomeScoredAvg = Math.min(20, leagueHomeScoredAvg);

    if (leagueAwayScoredAvg <= 0) leagueAwayScoredAvg = 1.1;
    leagueAwayScoredAvg = Math.min(20, leagueAwayScoredAvg);

    // Partite giocate dev'essere almeno 1 e un numero intero
    matchesPlayed = Math.max(1, Math.round(matchesPlayed));

    // Correzione manuale casa (homeAdvantage) limitata tra -100 e 200
    homeAdvantage = Math.max(-100, Math.min(200, homeAdvantage));

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
