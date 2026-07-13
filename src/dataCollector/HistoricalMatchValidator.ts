import { HistoricalMatch } from './HistoricalMatchTypes';
import { parseNumberItalian } from './CSVParser';

/**
 * Normalizza il nome di una squadra:
 * - trim degli spazi esterni
 * - riduzione degli spazi multipli interni ad un singolo spazio
 * - case-insensitive (tutto lowercase per la chiave)
 */
export function normalizedTeamKey(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Crea in modo deterministico un ID per la partita storica basato su data,
 * competizione, squadra casa e squadra trasferta.
 */
export function createHistoricalMatchId(match: {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
}): string {
  const dateStr = match.date.trim();
  const compKey = normalizedTeamKey(match.competition);
  const homeKey = normalizedTeamKey(match.homeTeam);
  const awayKey = normalizedTeamKey(match.awayTeam);
  return `${dateStr}_${compKey}_${homeKey}_${awayKey}`;
}

/**
 * Analizza e valida una data in diversi formati europei ed ISO.
 * Restituisce una data ISO YYYY-MM-DD se valida.
 */
export function parseHistoricalDate(value: string): {
  isValid: boolean;
  isoDate?: string;
  error?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, error: 'La data è obbligatoria e mancante.' };
  }

  let day = 0;
  let month = 0;
  let year = 0;
  let matched = false;

  // 1. Pattern YYYY-MM-DD
  const p1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (p1) {
    year = parseInt(p1[1], 10);
    month = parseInt(p1[2], 10);
    day = parseInt(p1[3], 10);
    matched = true;
  }

  // 2. Pattern DD/MM/YYYY
  if (!matched) {
    const p2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (p2) {
      day = parseInt(p2[1], 10);
      month = parseInt(p2[2], 10);
      year = parseInt(p2[3], 10);
      matched = true;
    }
  }

  // 3. Pattern DD/MM/YY
  if (!matched) {
    const p3 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(trimmed);
    if (p3) {
      day = parseInt(p3[1], 10);
      month = parseInt(p3[2], 10);
      const yy = parseInt(p3[3], 10);
      year = yy <= 49 ? 2000 + yy : 1900 + yy;
      matched = true;
    }
  }

  // 4. Pattern DD-MM-YYYY
  if (!matched) {
    const p4 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
    if (p4) {
      day = parseInt(p4[1], 10);
      month = parseInt(p4[2], 10);
      year = parseInt(p4[3], 10);
      matched = true;
    }
  }

  // 5. Pattern DD-MM-YY
  if (!matched) {
    const p5 = /^(\d{1,2})-(\d{1,2})-(\d{2})$/.exec(trimmed);
    if (p5) {
      day = parseInt(p5[1], 10);
      month = parseInt(p5[2], 10);
      const yy = parseInt(p5[3], 10);
      year = yy <= 49 ? 2000 + yy : 1900 + yy;
      matched = true;
    }
  }

  if (!matched) {
    return {
      isValid: false,
      error: `Formato data non riconosciuto: "${trimmed}". Formati supportati: YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MM-YY.`
    };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, error: `Mese non valido: ${month}` };
  }

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonths = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (day < 1 || day > daysInMonths[month]) {
    return {
      isValid: false,
      error: `Giorno non valido per il mese e anno specificati: ${day}/${month}/${year}`
    };
  }

  const pad = (num: number) => num.toString().padStart(2, '0');
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;

  return { isValid: true, isoDate };
}

export interface ValidationResult {
  isValid: boolean;
  match?: HistoricalMatch;
  errors: string[];
  warnings: string[];
}

/**
 * Valida e converte una riga grezza in un record HistoricalMatch.
 */
export function validateHistoricalMatch(
  row: Record<string, string>,
  datasetId: string,
  source: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Campi obbligatori grezzi
  const rawDate = row['date'] || '';
  const rawComp = row['competition'] || '';
  const rawHome = row['homeTeam'] || '';
  const rawAway = row['awayTeam'] || '';
  const rawHomeGoals = row['homeGoals'];
  const rawAwayGoals = row['awayGoals'];

  let validatedIsoDate = '';

  // 1. Validazione Data
  if (!rawDate.trim()) {
    errors.push('La data è obbligatoria e mancante.');
  } else {
    const dateCheck = parseHistoricalDate(rawDate);
    if (!dateCheck.isValid || !dateCheck.isoDate) {
      errors.push(dateCheck.error || `Data non valida: "${rawDate}"`);
    } else {
      validatedIsoDate = dateCheck.isoDate;
    }
  }

  // 2. Competizione
  if (!rawComp.trim()) {
    errors.push('La competizione è obbligatoria e mancante.');
  }

  // 3. Squadre
  if (!rawHome.trim()) {
    errors.push('La squadra di casa è obbligatoria e mancante.');
  }
  if (!rawAway.trim()) {
    errors.push('La squadra ospite è obbligatoria e mancante.');
  }

  const normHome = normalizedTeamKey(rawHome);
  const normAway = normalizedTeamKey(rawAway);
  if (rawHome.trim() && rawAway.trim() && normHome === normAway) {
    errors.push(`Squadra casa e squadra ospite non possono coincidere: "${rawHome}"`);
  }

  // 4. Gol
  let homeGoals = parseNumberItalian(rawHomeGoals);
  let awayGoals = parseNumberItalian(rawAwayGoals);

  if (isNaN(homeGoals) || !isFinite(homeGoals)) {
    errors.push(`I gol di casa non sono un numero valido: "${rawHomeGoals}"`);
  } else if (!Number.isInteger(homeGoals) || homeGoals < 0 || homeGoals > 30) {
    errors.push(`I gol di casa devono essere un intero compreso tra 0 e 30: ${homeGoals}`);
  }

  if (isNaN(awayGoals) || !isFinite(awayGoals)) {
    errors.push(`I gol ospite non sono un numero valido: "${rawAwayGoals}"`);
  } else if (!Number.isInteger(awayGoals) || awayGoals < 0 || awayGoals > 30) {
    errors.push(`I gol ospite devono essere un intero compreso tra 0 e 30: ${awayGoals}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Crea la base del match
  const match: HistoricalMatch = {
    id: '', // Verrà impostato alla fine
    datasetId,
    date: validatedIsoDate, // Standardizza a YYYY-MM-DD
    season: row['season']?.trim() || undefined,
    competition: rawComp.trim(),
    homeTeam: rawHome.trim(),
    awayTeam: rawAway.trim(),
    competitionKey: normalizedTeamKey(rawComp),
    homeTeamKey: normHome,
    awayTeamKey: normAway,
    homeGoals,
    awayGoals,
    source,
    importedAt: new Date().toISOString()
  };

  // Helper per convalidare interi opzionali >= 0
  const validateOptionalInteger = (
    key: keyof HistoricalMatch,
    rawVal: string | undefined,
    label: string
  ) => {
    if (rawVal === undefined || rawVal === null || rawVal.trim() === '') return;
    const parsed = parseNumberItalian(rawVal);
    if (isNaN(parsed) || !isFinite(parsed)) {
      warnings.push(`Campo opzionale "${label}" ignorato perché non è un numero valido: "${rawVal}"`);
    } else if (!Number.isInteger(parsed) || parsed < 0) {
      warnings.push(`Campo opzionale "${label}" ignorato perché deve essere un intero >= 0: ${parsed}`);
    } else {
      (match as any)[key] = parsed;
    }
  };

  // Helper per convalidare float opzionali >= 0
  const validateOptionalFloat = (
    key: keyof HistoricalMatch,
    rawVal: string | undefined,
    label: string,
    minValue = 0
  ) => {
    if (rawVal === undefined || rawVal === null || rawVal.trim() === '') return;
    const parsed = parseNumberItalian(rawVal);
    if (isNaN(parsed) || !isFinite(parsed)) {
      warnings.push(`Campo opzionale "${label}" ignorato perché non è un numero valido: "${rawVal}"`);
    } else if (parsed < minValue) {
      warnings.push(`Campo opzionale "${label}" ignorato perché minore del minimo consentito (${minValue}): ${parsed}`);
    } else {
      (match as any)[key] = parsed;
    }
  };

  // Campi opzionali
  validateOptionalInteger('halfTimeHomeGoals', row['halfTimeHomeGoals'], 'Gol primo tempo casa');
  validateOptionalInteger('halfTimeAwayGoals', row['halfTimeAwayGoals'], 'Gol primo tempo ospite');
  validateOptionalInteger('homeShots', row['homeShots'], 'Tiri casa');
  validateOptionalInteger('awayShots', row['awayShots'], 'Tiri ospite');
  validateOptionalInteger('homeShotsOnTarget', row['homeShotsOnTarget'], 'Tiri in porta casa');
  validateOptionalInteger('awayShotsOnTarget', row['awayShotsOnTarget'], 'Tiri in porta ospite');
  validateOptionalInteger('homeCorners', row['homeCorners'], 'Calci d\'angolo casa');
  validateOptionalInteger('awayCorners', row['awayCorners'], 'Calci d\'angolo ospite');
  validateOptionalInteger('homeYellowCards', row['homeYellowCards'], 'Ammonizioni casa');
  validateOptionalInteger('awayYellowCards', row['awayYellowCards'], 'Ammonizioni ospite');
  validateOptionalInteger('homeRedCards', row['homeRedCards'], 'Espulsioni casa');
  validateOptionalInteger('awayRedCards', row['awayRedCards'], 'Espulsioni ospite');

  validateOptionalFloat('homeXG', row['homeXG'], 'xG casa', 0);
  validateOptionalFloat('awayXG', row['awayXG'], 'xG ospite', 0);

  // Quote (devono essere > 1)
  validateOptionalFloat('oddsHome', row['oddsHome'], 'Quota 1', 1.0001);
  validateOptionalFloat('oddsDraw', row['oddsDraw'], 'Quota X', 1.0001);
  validateOptionalFloat('oddsAway', row['oddsAway'], 'Quota 2', 1.0001);

  // Genera l'id deterministico
  match.id = createHistoricalMatchId(match);

  return {
    isValid: true,
    match,
    errors,
    warnings
  };
}

/**
 * Mappa le intestazioni CSV rilevando alias comuni e restituisce una mappa ad indici per ogni campo desiderato.
 */
export function mapHeadersToIndices(headers: string[]): Record<string, number> {
  const indices: Record<string, number> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  const checkAlias = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = lowerHeaders.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  indices['date'] = checkAlias(['date', 'match_date', 'matchdate']);
  indices['competition'] = checkAlias(['competition', 'league', 'div', 'division']);
  indices['season'] = checkAlias(['season', 'anno']);
  indices['homeTeam'] = checkAlias(['hometeam', 'home_team', 'home']);
  indices['awayTeam'] = checkAlias(['awayteam', 'away_team', 'away']);
  indices['homeGoals'] = checkAlias(['fthg', 'homegoals', 'home_goals', 'fulltimehomegoals']);
  indices['awayGoals'] = checkAlias(['ftag', 'awaygoals', 'away_goals', 'fulltimeawaygoals']);
  indices['halfTimeHomeGoals'] = checkAlias(['hthg', 'halftimehomegoals', 'ht_home_goals']);
  indices['halfTimeAwayGoals'] = checkAlias(['htag', 'halftimeawaygoals', 'ht_away_goals']);
  indices['homeShots'] = checkAlias(['hs', 'homeshots', 'home_shots']);
  indices['awayShots'] = checkAlias(['as', 'awayshots', 'away_shots']);
  indices['homeShotsOnTarget'] = checkAlias(['hst', 'homeshotsontarget', 'home_shots_on_target']);
  indices['awayShotsOnTarget'] = checkAlias(['ast', 'awayshotsontarget', 'away_shots_on_target']);
  indices['homeCorners'] = checkAlias(['hc', 'homecorners', 'home_corners']);
  indices['awayCorners'] = checkAlias(['ac', 'awaycorners', 'away_corners']);
  indices['homeYellowCards'] = checkAlias(['hy', 'homeyellowcards', 'home_yellow_cards']);
  indices['awayYellowCards'] = checkAlias(['ay', 'awayyellowcards', 'away_yellow_cards']);
  indices['homeRedCards'] = checkAlias(['hr', 'homeredcards', 'home_red_cards']);
  indices['awayRedCards'] = checkAlias(['ar', 'awayredcards', 'away_red_cards']);
  indices['homeXG'] = checkAlias(['homexg', 'home_xg', 'xg_home']);
  indices['awayXG'] = checkAlias(['awayxg', 'away_xg', 'xg_away']);
  indices['oddsHome'] = checkAlias(['oddshome', 'b365h', 'homeodds']);
  indices['oddsDraw'] = checkAlias(['oddsdraw', 'b365d', 'drawodds']);
  indices['oddsAway'] = checkAlias(['oddsaway', 'b365a', 'awayodds']);

  return indices;
}
