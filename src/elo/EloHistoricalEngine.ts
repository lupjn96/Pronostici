/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HistoricalMatch } from '../dataCollector/HistoricalMatchTypes';
import { EloConfig } from './EloTypes';
import { DEFAULT_ELO_CONFIG, calculateExpectedScore, calculateRatingChange } from './EloEngine';
import { MatchOutcome } from '../types';

/**
 * Ordina le partite storiche in modo deterministico e cronologico.
 * Stessa regola usata nel Backtesting Engine principale per mantenere la consistenza.
 */
export function sortEloMatchesChronologically(matches: HistoricalMatch[]): HistoricalMatch[] {
  return [...matches].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    const compComp = a.competition.localeCompare(b.competition);
    if (compComp !== 0) return compComp;
    const homeComp = a.homeTeam.localeCompare(b.homeTeam);
    if (homeComp !== 0) return homeComp;
    const awayComp = a.awayTeam.localeCompare(b.awayTeam);
    if (awayComp !== 0) return awayComp;
    return a.id.localeCompare(b.id);
  });
}

export interface MatchEloSnapshot {
  homeEloBefore: number;
  awayEloBefore: number;
  homeEloAfter: number;
  awayEloAfter: number;
}

/**
 * Esegue una simulazione cronologica completa dei rating Elo di tutti i team
 * presenti nel dataset fornito per una specifica competizione.
 * 
 * Ritorna una mappa: matchId -> MatchEloSnapshot
 */
export function computeEloHistory(
  allMatches: HistoricalMatch[],
  config: EloConfig = DEFAULT_ELO_CONFIG
): Map<string, MatchEloSnapshot> {
  const sortedMatches = sortEloMatchesChronologically(allMatches);
  const teamRatings = new Map<string, number>();
  const matchSnapshots = new Map<string, MatchEloSnapshot>();

  // Helper per recuperare il rating corrente di una squadra
  const getRating = (team: string): number => {
    if (!teamRatings.has(team)) {
      teamRatings.set(team, config.initialRating);
    }
    return teamRatings.get(team)!;
  };

  for (const match of sortedMatches) {
    const homeRating = getRating(match.homeTeam);
    const awayRating = getRating(match.awayTeam);

    // Salva lo stato dei rating prima del match
    const snapshot: MatchEloSnapshot = {
      homeEloBefore: homeRating,
      awayEloBefore: awayRating,
      homeEloAfter: homeRating, // Sarà aggiornato sotto
      awayEloAfter: awayRating,  // Sarà aggiornato sotto
    };

    // Determina l'outcome reale per l'aggiornamento (1.0 casa, 0.5 pareggio, 0.0 ospite)
    let actualScoreHome = 0.5;
    if (match.homeGoals > match.awayGoals) {
      actualScoreHome = 1.0;
    } else if (match.homeGoals < match.awayGoals) {
      actualScoreHome = 0.0;
    }

    const actualScoreAway = 1.0 - actualScoreHome;

    // Calcola i punteggi attesi basati sui rating prima del match (inclusa la correzione di casa standard)
    const expectedScoreHome = calculateExpectedScore(homeRating, awayRating, config.homeAdvantage);
    const expectedScoreAway = 1.0 - expectedScoreHome;

    // Calcola le variazioni dei rating
    const homeChange = calculateRatingChange(expectedScoreHome, actualScoreHome, config.kFactor);
    const awayChange = calculateRatingChange(expectedScoreAway, actualScoreAway, config.kFactor);

    // Aggiorna i rating dei team
    const newHomeRating = homeRating + homeChange;
    const newAwayRating = awayRating + awayChange;

    teamRatings.set(match.homeTeam, newHomeRating);
    teamRatings.set(match.awayTeam, newAwayRating);

    // Aggiorna lo snapshot con i rating post-match
    snapshot.homeEloAfter = newHomeRating;
    snapshot.awayEloAfter = newAwayRating;

    matchSnapshots.set(match.id, snapshot);
  }

  return matchSnapshots;
}
