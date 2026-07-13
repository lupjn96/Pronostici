/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MatchFeatures {
  homeTeam: string;
  awayTeam: string;
  homeAttack: number; // Media gol segnati in casa (raw)
  homeDefense: number; // Media gol subiti in casa (raw)
  awayAttack: number; // Media gol segnati in trasferta (raw)
  awayDefense: number; // Media gol subiti in trasferta (raw)
  leagueHomeGoals: number; // Media gol casa del campionato
  leagueAwayGoals: number; // Media gol trasferta del campionato
  matchesPlayed: number;
  manualHomeAdjustment: number; // Equivalente a homeAdvantage (-100% a +200%)
  timestamp: number;
  dataSource: string;
  modelReady: boolean;
}
