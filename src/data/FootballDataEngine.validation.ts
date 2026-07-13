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

  // 1. Test Normalizzazione
  try {
    const engine = new FootballDataEngine();
    const badInput: ModelInput = {
      homeTeam: '  Milan  ',
      awayTeam: 'Inter',
      homeScoredAvg: NaN,
      homeConcededAvg: -1.5,
      awayScoredAvg: Infinity,
      awayConcededAvg: 12.0, // clipping check (should clip to 10 max in normalizer)
      leagueHomeScoredAvg: 0, // should adjust to min > 0
      leagueAwayScoredAvg: 0,
      matchesPlayed: 0.5, // should be normalized / handled
      homeAdvantage: -150 // out of bounds, should clip or validate
    };

    engine.loadManualInput(badInput);
    const normalized = engine.getNormalizedData();

    const normalizerPassed = 
      normalized !== null &&
      normalized.homeTeam === 'Milan' && // trimmed
      normalized.homeScoredAvg === 0 && // NaN fallback to 0
      normalized.homeConcededAvg === 0 && // negative to 0
      normalized.awayScoredAvg === 10 && // Infinity clipped to 10 max
      normalized.awayConcededAvg === 10 && // > 10 clipped to 10 max
      normalized.leagueHomeScoredAvg > 0 && // 0 raised to min
      normalized.leagueAwayScoredAvg > 0;

    results.push({
      name: '1. Normalizzazione Dati (Sanitizzazione e Range)',
      passed: !!normalizerPassed,
      message: normalizerPassed
        ? 'Successo: I dati corrotti (NaN, negativi, Infinity, fuori scala) sono stati corretti o limitati entro intervalli di sicurezza.'
        : `Fallimento: La normalizzazione non ha prodotto i valori attesi. Ricevuto: ${JSON.stringify(normalized)}`
    });
  } catch (err: any) {
    results.push({
      name: '1. Normalizzazione Dati (Sanitizzazione e Range)',
      passed: false,
      message: `Errore durante l'esecuzione del test: ${err.message}`
    });
  }

  // 2. Test Feature Generation
  try {
    const engine = new FootballDataEngine();
    const input: ModelInput = {
      homeTeam: 'Roma',
      awayTeam: 'Lazio',
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

    const featuresPassed =
      features !== null &&
      features.homeTeam === 'Roma' &&
      features.awayTeam === 'Lazio' &&
      features.homeAttack === 1.8 &&
      features.homeDefense === 1.1 &&
      features.awayAttack === 1.4 &&
      features.awayDefense === 1.2 &&
      features.leagueHomeGoals === 1.45 &&
      features.leagueAwayGoals === 1.15 &&
      features.matchesPlayed === 20 &&
      features.manualHomeAdjustment === 10;

    results.push({
      name: '2. Feature Generation (Mappatura)',
      passed: !!featuresPassed,
      message: featuresPassed
        ? 'Successo: Mappatura corretta e coerente da ModelInput a MatchFeatures indipendenti.'
        : `Fallimento: Le feature generate differiscono dall'input atteso. Ricevuto: ${JSON.stringify(features)}`
    });
  } catch (err: any) {
    results.push({
      name: '2. Feature Generation (Mappatura)',
      passed: false,
      message: `Errore durante l'esecuzione del test: ${err.message}`
    });
  }

  // 3. Test Validazione Strutturale
  try {
    const engine = new FootballDataEngine();
    
    // Team names vuoti
    engine.loadManualInput({
      homeTeam: '   ',
      awayTeam: '   ',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.0,
      awayConcededAvg: 1.0,
      leagueHomeScoredAvg: 1.45,
      leagueAwayScoredAvg: 1.15,
      matchesPlayed: 10,
      homeAdvantage: 0
    });
    const valEmptyTeams = engine.validate();

    // Stesso team
    engine.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'milan',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.0,
      awayConcededAvg: 1.0,
      leagueHomeScoredAvg: 1.45,
      leagueAwayScoredAvg: 1.15,
      matchesPlayed: 10,
      homeAdvantage: 0
    });
    const valSameTeam = engine.validate();

    // Partite giocate < 1
    engine.loadManualInput({
      homeTeam: 'Milan',
      awayTeam: 'Inter',
      homeScoredAvg: 1.5,
      homeConcededAvg: 1.0,
      awayScoredAvg: 1.0,
      awayConcededAvg: 1.0,
      leagueHomeScoredAvg: 1.45,
      leagueAwayScoredAvg: 1.15,
      matchesPlayed: 0,
      homeAdvantage: 0
    });
    const valLowMatches = engine.validate();

    const validationPassed =
      !valEmptyTeams.isValid && !!valEmptyTeams.errors.homeTeam && !!valEmptyTeams.errors.awayTeam &&
      !valSameTeam.isValid && !!valSameTeam.errors.awayTeam &&
      !valLowMatches.isValid && !!valLowMatches.errors.matchesPlayed;

    results.push({
      name: '3. Validazione dei Dati Inseriti (Controlli Errore)',
      passed: validationPassed,
      message: validationPassed
        ? 'Successo: I controlli di validazione bloccano correttamente i nomi vuoti, squadre uguali, e partite giocate inferiori a 1.'
        : 'Fallimento: Alcuni scenari non validi non sono stati rilevati correttamente dal validatore.'
    });
  } catch (err: any) {
    results.push({
      name: '3. Validazione dei Dati Inseriti (Controlli Errore)',
      passed: false,
      message: `Errore durante l'esecuzione del test: ${err.message}`
    });
  }

  // 4. Test Compatibilità con i Modelli Predittivi
  try {
    const engine = new FootballDataEngine();
    const standardInput: ModelInput = {
      homeTeam: 'Juventus',
      awayTeam: 'Napoli',
      homeScoredAvg: 1.6,
      homeConcededAvg: 0.9,
      awayScoredAvg: 1.4,
      awayConcededAvg: 1.1,
      leagueHomeScoredAvg: 1.45,
      leagueAwayScoredAvg: 1.15,
      matchesPlayed: 15,
      homeAdvantage: 5
    };

    engine.loadManualInput(standardInput);
    const features = engine.getFeatures();

    if (!features) {
      throw new Error('Nessuna feature generata per la verifica di compatibilità.');
    }

    // Esegui calcolo su Poisson
    const resPoisson = poissonModel.calculate(features);
    // Esegui calcolo su Poisson-Gamma
    const resGamma = poissonGammaModel.calculate(features);

    const checkSaneResult = (res: any) => {
      return (
        res.homeExpectedGoals > 0 &&
        res.awayExpectedGoals > 0 &&
        !isNaN(res.probHomeWin) &&
        !isNaN(res.probDraw) &&
        !isNaN(res.probAwayWin) &&
        res.exactScores.length === 5 &&
        res.calculationDiagnostics !== undefined
      );
    };

    const compatibilityPassed = checkSaneResult(resPoisson) && checkSaneResult(resGamma);

    results.push({
      name: '4. Compatibilità Algoritmi Modello (Poisson & Gamma)',
      passed: compatibilityPassed,
      message: compatibilityPassed
        ? 'Successo: Entrambi i motori di calcolo (Poisson standard e Poisson-Gamma) elaborano perfettamente le feature fornite dal Football Data Engine senza errori o valori non validi.'
        : 'Fallimento: Uno o entrambi i modelli hanno prodotto calcoli non validi a partire dalle feature del Football Data Engine.'
    });
  } catch (err: any) {
    results.push({
      name: '4. Compatibilità Algoritmi Modello (Poisson & Gamma)',
      passed: false,
      message: `Errore durante l'esecuzione del test: ${err.message}`
    });
  }

  return results;
}
