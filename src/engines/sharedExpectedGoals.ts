/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput } from '../types';

export function calculateExpectedGoals(input: ModelInput): { homeExpectedGoals: number; awayExpectedGoals: number } {
  // Calcolo dei gol attesi casa e ospite
  let homeExpectedGoals = 0;
  if (input.leagueHomeScoredAvg > 0) {
    // Attacco Casa * Difesa Ospite * Media Campionato Casa
    const homeAttack = input.homeScoredAvg / input.leagueHomeScoredAvg;
    const awayDefense = input.awayConcededAvg / input.leagueHomeScoredAvg;
    homeExpectedGoals = homeAttack * awayDefense * input.leagueHomeScoredAvg;
  } else {
    homeExpectedGoals = (input.homeScoredAvg + input.awayConcededAvg) / 2;
  }
  
  // Applica vantaggio casa (Correzione manuale casa) soltanto se diverso da zero
  if (input.homeAdvantage !== 0) {
    homeExpectedGoals = homeExpectedGoals * (1 + input.homeAdvantage / 100);
  }

  let awayExpectedGoals = 0;
  if (input.leagueAwayScoredAvg > 0) {
    // Attacco Ospite * Difesa Casa * Media Campionato Trasferta
    const awayAttack = input.awayScoredAvg / input.leagueAwayScoredAvg;
    const homeDefense = input.homeConcededAvg / input.leagueAwayScoredAvg;
    awayExpectedGoals = awayAttack * homeDefense * input.leagueAwayScoredAvg;
  } else {
    awayExpectedGoals = (input.awayScoredAvg + input.homeConcededAvg) / 2;
  }

  // Assicuriamoci che i gol attesi non siano mai negativi, NaN o infiniti
  homeExpectedGoals = Math.max(0, isNaN(homeExpectedGoals) || !isFinite(homeExpectedGoals) ? 0 : homeExpectedGoals);
  awayExpectedGoals = Math.max(0, isNaN(awayExpectedGoals) || !isFinite(awayExpectedGoals) ? 0 : awayExpectedGoals);

  return {
    homeExpectedGoals,
    awayExpectedGoals
  };
}
