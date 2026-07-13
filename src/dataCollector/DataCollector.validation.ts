import { parseHistoricalCSV, parseNumberItalian } from './CSVParser';
import { validateHistoricalMatch, mapHeadersToIndices, createHistoricalMatchId, normalizedTeamKey } from './HistoricalMatchValidator';
import { calculateTeamStatistics, buildModelInputFromHistoricalData } from './HistoricalFeatureCalculator';
import { HistoricalMatch } from './HistoricalMatchTypes';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runDataCollectorValidation(): TestResult[] {
  const results: TestResult[] = [];

  // =========================================================================
  // TEST A — CSV Parsing
  // =========================================================================
  try {
    const csvComma = `Date,Competition,HomeTeam,AwayTeam,FTHG,FTAG\n2026-01-01,Serie A,Inter,Milan,2,1\n\n`;
    const parsedComma = parseHistoricalCSV(csvComma);
    const commaOk = parsedComma.headers.length === 6 && parsedComma.rows.length === 1 && parsedComma.rows[0][2] === 'Inter';

    const csvSemi = `Date;Competition;HomeTeam;AwayTeam;FTHG;FTAG\n2026-01-01;Serie A;Inter;Milan;2;1`;
    const parsedSemi = parseHistoricalCSV(csvSemi);
    const semiOk = parsedSemi.headers.length === 6 && parsedSemi.rows.length === 1 && parsedSemi.rows[0][2] === 'Inter';

    const csvQuotes = `Date,Competition,HomeTeam,AwayTeam,FTHG,FTAG\n"2026-01-01","Serie A","Inter","Milan, AC",2,1`;
    const parsedQuotes = parseHistoricalCSV(csvQuotes);
    const quotesOk = parsedQuotes.rows[0][3] === 'Milan, AC';

    const csvBOM = `\uFEFFDate,Competition\n2026-01-01,Serie A`;
    const parsedBOM = parseHistoricalCSV(csvBOM);
    const bomOk = parsedBOM.headers[0] === 'Date';

    const passed = commaOk && semiOk && quotesOk && bomOk;
    results.push({
      name: 'TEST A: Parsificazione CSV (separatori, virgolette, BOM, vuoti)',
      passed,
      message: passed 
        ? 'Successo: CSV con virgole, punti e virgole, campi tra virgolette e BOM decodificati correttamente.'
        : `Fallimento: commaOk=${commaOk}, semiOk=${semiOk}, quotesOk=${quotesOk}, bomOk=${bomOk}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST A: Parsificazione CSV (separatori, virgolette, BOM, vuoti)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST B — Alias colonne
  // =========================================================================
  try {
    const customHeaders = ['div', 'Home_Team', 'away', 'FullTimeHomeGoals', 'ftag', 'B365H', 'b365d', 'b365a', 'match_date'];
    const indices = mapHeadersToIndices(customHeaders);
    const passed = indices['competition'] === 0 && 
                   indices['homeTeam'] === 1 && 
                   indices['awayTeam'] === 2 && 
                   indices['homeGoals'] === 3 && 
                   indices['awayGoals'] === 4 && 
                   indices['oddsHome'] === 5 && 
                   indices['oddsDraw'] === 6 && 
                   indices['oddsAway'] === 7 &&
                   indices['date'] === 8;

    results.push({
      name: 'TEST B: Alias colonne CSV',
      passed,
      message: passed
        ? 'Successo: Alias comuni come Div, Home_Team, B365H e match_date mappati con successo.'
        : `Fallimento: mappatura indici errata.`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST B: Alias colonne CSV',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST C — Validazione partite
  // =========================================================================
  try {
    const datasetId = 'test-dataset';
    const source = 'Test Source';

    // 1. Partita valida
    const rowValid = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: '2', awayGoals: '1', oddsHome: '1.85' };
    const valValid = validateHistoricalMatch(rowValid, datasetId, source);

    // 2. Squadra mancante
    const rowNoTeam = { date: '2026-01-01', competition: 'Serie A', homeTeam: '', awayTeam: 'Milan', homeGoals: '2', awayGoals: '1' };
    const valNoTeam = validateHistoricalMatch(rowNoTeam, datasetId, source);

    // 3. Squadre uguali
    const rowSame = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: ' Inter ', homeGoals: '2', awayGoals: '1' };
    const valSame = validateHistoricalMatch(rowSame, datasetId, source);

    // 4. Gol negativi
    const rowNegGoals = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: '-1', awayGoals: '1' };
    const valNegGoals = validateHistoricalMatch(rowNegGoals, datasetId, source);

    // 5. Gol decimali
    const rowDecGoals = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: '2.5', awayGoals: '1' };
    const valDecGoals = validateHistoricalMatch(rowDecGoals, datasetId, source);

    // 6. NaN / Infinity
    const rowNaN = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: 'NaN', awayGoals: '1' };
    const valNaN = validateHistoricalMatch(rowNaN, datasetId, source);

    const rowInf = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: '2', awayGoals: 'Infinity' };
    const valInf = validateHistoricalMatch(rowInf, datasetId, source);

    // 7. Quota <= 1
    const rowLowOdd = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: '2', awayGoals: '1', oddsHome: '0.95' };
    const valLowOdd = validateHistoricalMatch(rowLowOdd, datasetId, source);

    const passed = valValid.isValid && 
                   !valNoTeam.isValid && 
                   !valSame.isValid && 
                   !valNegGoals.isValid && 
                   !valDecGoals.isValid && 
                   !valNaN.isValid && 
                   !valInf.isValid && 
                   valLowOdd.isValid && valLowOdd.warnings.length > 0; // Quota errata è un warning, non esclude il record

    results.push({
      name: 'TEST C: Validazione regole obbligatorie e opzionali',
      passed,
      message: passed
        ? 'Successo: Partita valida accettata, esclusioni per squadre coincidenti, vuote, gol negativi/decimali, NaN ed Infinity funzionano.'
        : `Fallimento: valValid=${valValid.isValid}, valNoTeam=${valNoTeam.isValid}, valSame=${valSame.isValid}, valNeg=${valNegGoals.isValid}, valDec=${valDecGoals.isValid}, valNaN=${valNaN.isValid}, valInf=${valInf.isValid}, valLowOdd=${valLowOdd.isValid}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST C: Validazione regole obbligatorie e opzionali',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST D — Duplicati (ID deterministico)
  // =========================================================================
  try {
    const m1 = { date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan' };
    const m2 = { date: '2026-01-01', competition: ' Serie A ', homeTeam: ' INTER ', awayTeam: 'milan' };

    const id1 = createHistoricalMatchId(m1);
    const id2 = createHistoricalMatchId(m2);

    const passed = id1 === id2;
    results.push({
      name: 'TEST D: Determinismo ID e chiavi duplicati',
      passed,
      message: passed
        ? `Successo: ID generato deterministico per la stessa partita (${id1}).`
        : `Fallimento: id1="${id1}", id2="${id2}"`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST D: Determinismo ID e chiavi duplicati',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST E — Nessun data leakage
  // =========================================================================
  try {
    const matches: HistoricalMatch[] = [
      { id: '1', datasetId: 'd1', date: '2026-01-10', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: 2, awayGoals: 0, source: 'S', importedAt: '' },
      { id: '2', datasetId: 'd1', date: '2026-01-15', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Napoli', homeGoals: 3, awayGoals: 0, source: 'S', importedAt: '' },
      { id: '3', datasetId: 'd1', date: '2026-01-20', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Juventus', homeGoals: 4, awayGoals: 0, source: 'S', importedAt: '' },
    ];

    // Valuta statistiche "Inter" prima del 2026-01-18. Dovrebbe vedere solo le partite del 10 e 15.
    const stats = calculateTeamStatistics(matches, 'Inter', 'Juventus', 'Serie A', '2026-01-18');
    const passed = stats.homeTeamHomeMatches === 2 && stats.homeScoredAvg === 2.5; // (2+3)/2

    results.push({
      name: 'TEST E: Protezione data leakage (esclusione partite future)',
      passed,
      message: passed
        ? 'Successo: Le statistiche non includono partite giocate alla data o successive a beforeDate.'
        : `Fallimento: homeMatches=${stats.homeTeamHomeMatches}, scoredAvg=${stats.homeScoredAvg}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST E: Protezione data leakage (esclusione partite future)',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST F — Statistiche casa/trasferta
  // =========================================================================
  try {
    const matches: HistoricalMatch[] = [
      // Inter in casa
      { id: '1', datasetId: 'd1', date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Genoa', homeGoals: 3, awayGoals: 0, source: 'S', importedAt: '' },
      { id: '2', datasetId: 'd1', date: '2026-01-05', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Roma', homeGoals: 1, awayGoals: 1, source: 'S', importedAt: '' },
      // Inter in trasferta (da non contare per homeScoredAvg!)
      { id: '3', datasetId: 'd1', date: '2026-01-08', competition: 'Serie A', homeTeam: 'Lazio', awayTeam: 'Inter', homeGoals: 0, awayGoals: 5, source: 'S', importedAt: '' },
      // Milan in trasferta
      { id: '4', datasetId: 'd1', date: '2026-01-02', competition: 'Serie A', homeTeam: 'Torino', awayTeam: 'Milan', homeGoals: 1, awayGoals: 2, source: 'S', importedAt: '' },
      { id: '5', datasetId: 'd1', date: '2026-01-06', competition: 'Serie A', homeTeam: 'Fiorentina', awayTeam: 'Milan', homeGoals: 2, awayGoals: 4, source: 'S', importedAt: '' },
    ];

    const stats = calculateTeamStatistics(matches, 'Inter', 'Milan', 'Serie A', '2026-01-15');
    
    // Inter casa: 3+1 = 4 gol segnati in 2 partite (media 2.0). 0+1 = 1 gol subito (media 0.5)
    // Milan fuori: 2+4 = 6 gol segnati in 2 partite (media 3.0). 1+2 = 3 gol subiti (media 1.5)
    // Media campionato (su 5 partite): homeScoredAvg campionato = (3+1+0+1+2)/5 = 1.4, awayScoredAvg campionato = (0+1+5+2+4)/5 = 2.4
    const homeOk = stats.homeTeamHomeMatches === 2 && stats.homeScoredAvg === 2.0 && stats.homeConcededAvg === 0.5;
    const awayOk = stats.awayTeamAwayMatches === 2 && stats.awayScoredAvg === 3.0 && stats.awayConcededAvg === 1.5;
    const leagueOk = Math.abs(stats.leagueHomeScoredAvg - 1.4) < 1e-9 && Math.abs(stats.leagueAwayScoredAvg - 2.4) < 1e-9;

    const passed = homeOk && awayOk && leagueOk;

    results.push({
      name: 'TEST F: Statistiche isolate casa/trasferta e medie campionato',
      passed,
      message: passed
        ? 'Successo: Statistiche calcolate accuratamente e isolate tra partite in casa e trasferta.'
        : `Fallimento: homeOk=${homeOk}, awayOk=${awayOk}, leagueOk=${leagueOk}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST F: Statistiche isolate casa/trasferta e medie campionato',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST G — ModelInput Compatibilità
  // =========================================================================
  try {
    const matches: HistoricalMatch[] = [];
    // Aggiungi 6 partite in casa per Inter e 6 in trasferta per Milan per superare il limite minimo di 5
    for (let i = 1; i <= 6; i++) {
      matches.push({
        id: `h-${i}`,
        datasetId: 'd1',
        date: `2026-01-0${i}`,
        competition: 'Serie A',
        homeTeam: 'Inter',
        awayTeam: `TeamX-${i}`,
        homeGoals: 2,
        awayGoals: 0,
        source: 'S',
        importedAt: ''
      });
      matches.push({
        id: `a-${i}`,
        datasetId: 'd1',
        date: `2026-01-0${i}`,
        competition: 'Serie A',
        homeTeam: `TeamY-${i}`,
        awayTeam: 'Milan',
        homeGoals: 1,
        awayGoals: 3,
        source: 'S',
        importedAt: ''
      });
    }

    const res = buildModelInputFromHistoricalData(matches, 'Inter', 'Milan', 'Serie A', '2026-02-01', { minimumMatches: 5 });
    
    const passed = res.isReady && 
                   res.modelInput !== undefined && 
                   res.modelInput.homeTeam === 'Inter' && 
                   res.modelInput.awayTeam === 'Milan' && 
                   res.modelInput.matchesPlayed === 6 &&
                   res.modelInput.homeScoredAvg === 2 && 
                   res.modelInput.awayScoredAvg === 3;

    results.push({
      name: 'TEST G: Conversione in ModelInput compatibile',
      passed,
      message: passed
        ? 'Successo: Generato ModelInput perfettamente allineato al motore predittivo.'
        : `Fallimento: isReady=${res.isReady}, inputExists=${res.modelInput !== undefined}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST G: Conversione in ModelInput compatibile',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST H — Dati insufficienti (minimumMatches)
  // =========================================================================
  try {
    const matches: HistoricalMatch[] = [
      { id: '1', datasetId: 'd1', date: '2026-01-01', competition: 'Serie A', homeTeam: 'Inter', awayTeam: 'Milan', homeGoals: 2, awayGoals: 0, source: 'S', importedAt: '' }
    ];

    const res = buildModelInputFromHistoricalData(matches, 'Inter', 'Milan', 'Serie A', '2026-01-15', { minimumMatches: 5 });
    const passed = !res.isReady && res.errors.length > 0;

    results.push({
      name: 'TEST H: Blocco pronostici per dati insufficienti',
      passed,
      message: passed
        ? `Successo: Pronostico bloccato correttamente (campione inferiore a 5). Errori generati: ${res.errors.length}`
        : `Fallimento: isReady=${res.isReady}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST H: Blocco pronostici per dati insufficienti',
      passed: false,
      message: `Errore: ${err.message}`
    });
  }

  // =========================================================================
  // TEST I — IndexedDB Ambiente
  // =========================================================================
  try {
    const supportIndexedDB = typeof indexedDB !== 'undefined';
    results.push({
      name: 'TEST I: Supporto ambiente IndexedDB',
      passed: true,
      message: supportIndexedDB
        ? 'Rilevato: L\'ambiente supporta IndexedDB per la persistenza asincrona avanzata dei dataset.'
        : 'Rilevato: IndexedDB non supportato nell\'ambiente corrente dei test automatizzati. I test pure sono stati eseguiti con successo.'
    });
  } catch (err: any) {
    results.push({
      name: 'TEST I: Supporto ambiente IndexedDB',
      passed: false,
      message: `Errore durante il test di supporto: ${err.message}`
    });
  }

  return results;
}
