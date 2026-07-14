/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchOutcome } from '../types';

export interface EloConfig {
  initialRating: number;
  kFactor: number;
  homeAdvantage: number;
  drawMargin: number;
}

export interface TeamEloState {
  teamName: string;
  rating: number;
  matchesPlayed: number;
  lastUpdated: string; // ISO string or date string
}

export interface EloMatchResult {
  matchId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  outcome: MatchOutcome;
  homeEloBefore: number;
  awayEloBefore: number;
  homeEloAfter: number;
  awayEloAfter: number;
  ratingChange: number;
}
