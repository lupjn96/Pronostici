import { FootballDataEngine } from './FootballDataEngine';
import { ModelInput } from '../types';
import { poissonModel } from '../poissonEngine';
import { poissonGammaModel } from '../poissonGammaEngine';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export function runDataEngineValidation(): TestResult[] {
  const results: TestResult[] = [];

  // TEST 1
  try {
    const engine = new FootballDataEngine();
    const input: any = {
      homeTeam: '  Milan  ',
      awayTeam: 'Inter',
      homeScoredAvg: '1,45',
      homeConcededAvg: '0,85',
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 10
    };

    engine.loadManualInput(input);
    const normalized = engine.getNormalizedData();
    const features = engine.getFeatures();

    const passed1 =
      normalized !== null &&
      features !== null &&
      normalized.homeTeam === 'Milan' && // Spazi rimossi
      normalized.homeScoredAvg === 1.45 && // Conversione virgola italiana
      normalized.homeConcededAvg === 0.85 && // Conversione virgola italiana
      features.modelReady === true; // modelReady = true

    results.push({
      name: 'TEST 1: Conversione virgola italiana, rimozione spazi e modelReady',
      passed: !!passed1,
      message: passed1
        ? 'Successo: "1,45" convertito correttamente in 1.45, spazi rimossi dai nomi, e modelReady è true.'
        : `Fallimento: Campi non convertiti o modelReady errato. Ricevuto: ${JSON.stringify({ normalized, features })}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 1: Conversione virgola italiana, rimozione spazi e modelReady',
      passed: false,
      message: `Errore durante il test: ${err.message}`
    });
  }

  // TEST 2
  try {
    const engineNaN = new FootballDataEngine();
    engineNaN.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeScoredAvg: NaN,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 10
    });
    const valNaN = engineNaN.validate();

    const engineInf = new FootballDataEngine();
    engineInf.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeScoredAvg: 1.5,
      homeConcededAvg: Infinity,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 10
    });
    const valInf = engineInf.validate();

    const engineNeg = new FootballDataEngine();
    engineNeg.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeScoredAvg: -1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 10
    });
    const valNeg = engineNeg.validate();

    const passed2 =
      !valNaN.isValid && !!valNaN.errors.homeScoredAvg &&
      !valInf.isValid && !!valInf.errors.homeConcededAvg &&
      !valNeg.isValid && !!valNeg.errors.homeScoredAvg &&
      // Verifica che non vengano sostituiti silenziosamente prima della validazione
      engineNaN.getNormalizedData() === null &&
      engineInf.getNormalizedData() === null &&
      engineNeg.getNormalizedData() === null;

    results.push({
      name: 'TEST 2: Gestione NaN, Infinity e valori negativi senza sostituzioni silenziose',
      passed: passed2,
      message: passed2
        ? 'Successo: NaN, Infinity e valori negativi rilevano errore correttamente senza sostituzioni silenziose.'
        : 'Fallimento: Alcuni errori numerici non sono stati rilevati, o i dati sono stati sostituiti silenziosamente.'
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 2: Gestione NaN, Infinity e valori negativi senza sostituzioni silenziose',
      passed: false,
      message: `Errore durante il test: ${err.message}`
    });
  }

  // TEST 3
  try {
    // nomi vuoti
    const engineEmpty = new FootballDataEngine();
    engineEmpty.loadManualInput({
      homeTeam: '   ',
      awayTeam: 'Inter',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 10
    });
    const valEmpty = engineEmpty.validate();

    // squadre uguali
    const engineSame = new FootballDataEngine();
    engineSame.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'milan',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 10
    });
    const valSame = engineSame.validate();

    // matchesPlayed = 0
    const engineZeroMatches = new FootballDataEngine();
    engineZeroMatches.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.4,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 0,
      homeAdvantage: 10
    });
    const valZeroMatches = engineZeroMatches.validate();

    // medie campionato = 0
    const engineZeroLeague = new FootballDataEngine();
    engineZeroLeague.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.2,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 0,
      leagueAwayScoredAvg: 1.1,
      matchesPlayed: 10,
      homeAdvantage: 10
    });
    const valZeroLeague = engineZeroLeague.validate();

    const passed3 =
      !valEmpty.isValid && !!valEmpty.errors.homeTeam &&
      !valSame.isValid && !!valSame.errors.awayTeam &&
      !valZeroMatches.isValid && !!valZeroMatches.errors.matchesPlayed &&
      !valZeroLeague.isValid && !!valZeroLeague.errors.leagueHomeScoredAvg &&
      engineEmpty.getFeatures() === null &&
      engineSame.getFeatures() === null &&
      engineZeroMatches.getFeatures() === null &&
      engineZeroLeague.getFeatures() === null;

    results.push({
      name: 'TEST 3: Controlli per nomi vuoti, squadre uguali, matchesPlayed=0, medie campionato=0',
      passed: passed3,
      message: passed3
        ? 'Successo: Tutti i casi non validi vengono intercettati e getFeatures() restituisce null.'
        : 'Fallimento: Uno o più casi non validi non sono stati intercettati correttamente.'
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 3: Controlli per nomi vuoti, squadre uguali, matchesPlayed=0, medie campionato=0',
      passed: false,
      message: `Errore durante il test: ${err.message}`
    });
  }

  // TEST 4
  try {
    const engine = new FootballDataEngine();
    const input: ModelInput = {
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeScoredAvg: 1.8,
      homeConcededAvg: 1.1,
      awayScoredAvg: 1.4,
      awayConcededAvg: 1.2,
      leagueHomeScoredAvg: 1.45,
      leagueAwayScoredAvg: 1.15,
      matchesPlayed: 20,
      homeAdvantage: 10
    };

    engine.loadManualInput(input);
    const features = engine.getFeatures();

    let passed4 = false;
    if (features) {
      const resPoisson = poissonModel.calculate(features);
      const resGamma = poissonGammaModel.calculate(features);

      const sumPoisson = resPoisson.probHomeWin + resPoisson.probDraw + resPoisson.probAwayWin;
      const sumGamma = resGamma.probHomeWin + resGamma.probDraw + resGamma.probAwayWin;

      const poissonSumCorrect = Math.abs(sumPoisson - 100) < 0.01;
      const gammaSumCorrect = Math.abs(sumGamma - 100) < 0.01;

      passed4 =
        features.homeTeam === 'Milan' &&
        features.awayTeam === 'Inter' &&
        features.homeAttack === 1.8 &&
        features.homeDefense === 1.1 &&
        poissonSumCorrect &&
        gammaSumCorrect;
    }

    results.push({
      name: 'TEST 4: Correttezza delle MatchFeatures e somma probabilità pari a 100%',
      passed: passed4,
      message: passed4
        ? 'Successo: MatchFeatures valide generate, calcoli eseguiti con successo e probabilità sommano al 100%.'
        : 'Fallimento: Le MatchFeatures non sono corrette o le probabilità non sommano al 100%.'
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 4: Correttezza delle MatchFeatures e somma probabilità pari a 100%',
      passed: false,
      message: `Errore durante il test: ${err.message}`
    });
  }

  return results;
}
