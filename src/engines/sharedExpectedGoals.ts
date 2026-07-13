/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchFeatures } from '../data/types';

export function calculateExpectedGoals(features: MatchFeatures): { homeExpectedGoals: number; awayExpectedGoals: number } {
  // Calcolo dei gol attesi casa e ospite
  let homeExpectedGoals = 0;
  if (features.leagueHomeGoals > 0) {
    // Attacco Casa * Difesa Ospite * Media Campionato Casa
    const homeAttack = features.homeAttack / features.leagueHomeGoals;
    const awayDefense = features.awayDefense / features.leagueHomeGoals;
    homeExpectedGoals = homeAttack * awayDefense * features.leagueHomeGoals;
  } else {
    homeExpectedGoals = (features.homeAttack + features.awayDefense) / 2;
  }
  
  // Applica vantaggio casa (Correzione manuale casa) soltanto se diverso da zero
  if (features.manualHomeAdjustment !== 0) {
    homeExpectedGoals = homeExpectedGoals * (1 + features.manualHomeAdjustment / 100);
  }

  let awayExpectedGoals = 0;
  if (features.leagueAwayGoals > 0) {
    // Attacco Ospite * Difesa Casa * Media Campionato Trasferta
    const awayAttack = features.awayAttack / features.leagueAwayGoals;
    const homeDefense = features.homeDefense / features.leagueAwayGoals;
    awayExpectedGoals = awayAttack * homeDefense * features.leagueAwayGoals;
  } else {
    awayExpectedGoals = (features.awayAttack + features.homeDefense) / 2;
  }

  // Assicuriamoci che i gol attesi non siano mai negativi, NaN o infiniti
  homeExpectedGoals = Math.max(0, isNaN(homeExpectedGoals) || !isFinite(homeExpectedGoals) ? 0 : homeExpectedGoals);
  awayExpectedGoals = Math.max(0, isNaN(awayExpectedGoals) || !isFinite(awayExpectedGoals) ? 0 : awayExpectedGoals);

  return {
    homeExpectedGoals,
    awayExpectedGoals
  };
}
