import { HistoricalMatch } from './HistoricalMatchTypes';
import { ModelInput } from '../types';
import { normalizedTeamKey } from './HistoricalMatchValidator';

export interface FeatureCalculatorOptions {
  lastMatches?: number;
  timeDecayEnabled?: boolean;
  timeDecayRate?: number;
}

export interface TeamStatistics {
  homeTeamHomeMatches: number;
  awayTeamAwayMatches: number;

  homeScoredAvg: number;
  homeConcededAvg: number;

  awayScoredAvg: number;
  awayConcededAvg: number;

  leagueHomeScoredAvg: number;
  leagueAwayScoredAvg: number;

  homeOverallMatches: number;
  awayOverallMatches: number;

  dataCoverageScore: number;
}

/**
 * Calcola le statistiche storiche per la squadra in casa e in trasferta
 * basandosi solo sulle partite precedenti la data specificata (no data-leakage).
 */
export function calculateTeamStatistics(
  matches: HistoricalMatch[],
  homeTeam: string,
  awayTeam: string,
  competition: string,
  beforeDate: string,
  options: FeatureCalculatorOptions = {}
): TeamStatistics {
  const timeDecayEnabled = options.timeDecayEnabled ?? false;
  const timeDecayRate = options.timeDecayRate ?? 0.005;
  const lastMatches = options.lastMatches;

  const targetCompNorm = normalizedTeamKey(competition);
  const targetHomeNorm = normalizedTeamKey(homeTeam);
  const targetAwayNorm = normalizedTeamKey(awayTeam);
  const targetBeforeTime = new Date(beforeDate).getTime();

  // 1. Filtra per competizione e data precedente (escludendo la partita corrente/future)
  const previousCompMatches = matches.filter(m => {
    return normalizedTeamKey(m.competition) === targetCompNorm && 
           new Date(m.date).getTime() < targetBeforeTime;
  });

  // Ordina per data decrescente (dalle più recenti alle più vecchie)
  const sortedCompMatches = [...previousCompMatches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 2. Calcolo medie generali del campionato per le partite precedenti
  let leagueTotalHomeGoals = 0;
  let leagueTotalAwayGoals = 0;
  const leagueMatchesCount = sortedCompMatches.length;

  for (const m of sortedCompMatches) {
    leagueTotalHomeGoals += m.homeGoals;
    leagueTotalAwayGoals += m.awayGoals;
  }

  const leagueHomeScoredAvg = leagueMatchesCount > 0 ? leagueTotalHomeGoals / leagueMatchesCount : 1.5;
  const leagueAwayScoredAvg = leagueMatchesCount > 0 ? leagueTotalAwayGoals / leagueMatchesCount : 1.1;

  // 3. Trova tutte le partite casalinghe precedenti della squadra di casa
  const homeMatchesOfHomeTeam = sortedCompMatches.filter(
    m => normalizedTeamKey(m.homeTeam) === targetHomeNorm
  );

  // 4. Trova tutte le partite in trasferta precedenti della squadra ospite
  const awayMatchesOfAwayTeam = sortedCompMatches.filter(
    m => normalizedTeamKey(m.awayTeam) === targetAwayNorm
  );

  // 5. Partite complessive per diagnosi/coverage (casa + fuori) nella competizione
  const homeOverallMatches = sortedCompMatches.filter(
    m => normalizedTeamKey(m.homeTeam) === targetHomeNorm || normalizedTeamKey(m.awayTeam) === targetHomeNorm
  ).length;

  const awayOverallMatches = sortedCompMatches.filter(
    m => normalizedTeamKey(m.homeTeam) === targetAwayNorm || normalizedTeamKey(m.awayTeam) === targetAwayNorm
  ).length;

  // Applica finestra mobile lastMatches se specificata
  const homeMatchesSubset = lastMatches !== undefined && lastMatches > 0 
    ? homeMatchesOfHomeTeam.slice(0, lastMatches)
    : homeMatchesOfHomeTeam;

  const awayMatchesSubset = lastMatches !== undefined && lastMatches > 0
    ? awayMatchesOfAwayTeam.slice(0, lastMatches)
    : awayMatchesOfAwayTeam;

  // Calcola le medie con eventuale decadimento temporale (Time Decay)
  const calculateAverages = (subset: HistoricalMatch[], isHome: boolean) => {
    if (subset.length === 0) {
      return { scored: 0, conceded: 0 };
    }

    let sumScored = 0;
    let sumConceded = 0;
    let sumWeights = 0;

    for (const m of subset) {
      const scored = isHome ? m.homeGoals : m.awayGoals;
      const conceded = isHome ? m.awayGoals : m.homeGoals;

      if (timeDecayEnabled) {
        // Differenza in giorni tra la partita storica e la data prima del pronostico
        const diffDays = Math.max(0, (targetBeforeTime - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24));
        const weight = Math.exp(-timeDecayRate * diffDays);

        sumScored += scored * weight;
        sumConceded += conceded * weight;
        sumWeights += weight;
      } else {
        sumScored += scored;
        sumConceded += conceded;
        sumWeights += 1;
      }
    }

    return {
      scored: sumWeights > 0 ? sumScored / sumWeights : 0,
      conceded: sumWeights > 0 ? sumConceded / sumWeights : 0
    };
  };

  const homeAvgs = calculateAverages(homeMatchesSubset, true);
  const awayAvgs = calculateAverages(awayMatchesSubset, false);

  // Calcolo indice di copertura dei dati (da 0 a 1)
  const homeCount = homeMatchesOfHomeTeam.length;
  const awayCount = awayMatchesOfAwayTeam.length;
  const dataCoverageScore = Math.min(1, (Math.min(homeCount, 10) + Math.min(awayCount, 10)) / 20);

  return {
    homeTeamHomeMatches: homeCount,
    awayTeamAwayMatches: awayCount,
    homeScoredAvg: homeAvgs.scored,
    homeConcededAvg: homeAvgs.conceded,
    awayScoredAvg: awayAvgs.scored,
    awayConcededAvg: awayAvgs.conceded,
    leagueHomeScoredAvg,
    leagueAwayScoredAvg,
    homeOverallMatches,
    awayOverallMatches,
    dataCoverageScore
  };
}

/**
 * Converte le statistiche storiche estratte in un formato ModelInput compatibile.
 * Se le partite giocate sono inferiori a minimumMatches, segnala che il pronostico non è pronto.
 */
export function buildModelInputFromHistoricalData(
  matches: HistoricalMatch[],
  homeTeam: string,
  awayTeam: string,
  competition: string,
  matchDate: string,
  options: FeatureCalculatorOptions & { minimumMatches?: number } = {}
): { isReady: boolean; modelInput?: ModelInput; errors: string[] } {
  const minimumMatches = options.minimumMatches ?? 5;
  const errors: string[] = [];

  const stats = calculateTeamStatistics(matches, homeTeam, awayTeam, competition, matchDate, options);

  if (stats.homeTeamHomeMatches < minimumMatches) {
    errors.push(
      `La squadra di casa "${homeTeam}" ha solo ${stats.homeTeamHomeMatches} partite disputate in casa (minimo richiesto: ${minimumMatches}).`
    );
  }

  if (stats.awayTeamAwayMatches < minimumMatches) {
    errors.push(
      `La squadra ospite "${awayTeam}" ha solo ${stats.awayTeamAwayMatches} partite disputate in trasferta (minimo richiesto: ${minimumMatches}).`
    );
  }

  if (errors.length > 0) {
    return {
      isReady: false,
      errors
    };
  }

  const matchesPlayed = Math.min(stats.homeTeamHomeMatches, stats.awayTeamAwayMatches);

  const modelInput: ModelInput = {
    homeTeam,
    awayTeam,
    homeScoredAvg: stats.homeScoredAvg,
    homeConcededAvg: stats.homeConcededAvg,
    awayScoredAvg: stats.awayScoredAvg,
    awayConcededAvg: stats.awayConcededAvg,
    leagueHomeScoredAvg: stats.leagueHomeScoredAvg,
    leagueAwayScoredAvg: stats.leagueAwayScoredAvg,
    matchesPlayed,
    homeAdvantage: 0 // Default richiesto
  };

  return {
    isReady: true,
    modelInput,
    errors
  };
}
