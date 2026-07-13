/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInput } from '../types';
import { MatchFeatures } from './types';
import { DataNormalizer } from './DataNormalizer';
import { FeatureBuilder } from './FeatureBuilder';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export class FootballDataEngine {
  private rawInput: any = null;
  private normalizedData: ModelInput | null = null;
  private features: MatchFeatures | null = null;

  /**
   * Carica i dati di input manuali forniti dal form.
   */
  loadManualInput(input: any): void {
    this.rawInput = input;
    this.normalizedData = DataNormalizer.normalize(input);
    this.features = FeatureBuilder.buildFeatures(this.normalizedData);
  }

  /**
   * Restituisce il match corrente sotto forma di MatchFeatures.
   */
  getCurrentMatch(): MatchFeatures | null {
    return this.features;
  }

  /**
   * Restituisce le feature estratte e pronte per i modelli.
   */
  getFeatures(): MatchFeatures | null {
    return this.features;
  }

  /**
   * Restituisce i dati normalizzati (nel formato ModelInput).
   */
  getNormalizedData(): ModelInput | null {
    return this.normalizedData;
  }

  /**
   * Valida i dati correnti caricati nel motore.
   */
  validate(): ValidationResult {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    if (!this.normalizedData) {
      return {
        isValid: false,
        errors: { general: 'Nessun dato di input caricato nel Football Data Engine.' },
        warnings: {}
      };
    }

    const data = this.normalizedData;

    // Controllo nomi squadre obbligatori
    if (!data.homeTeam || !data.homeTeam.trim()) {
      errors.homeTeam = 'Inserisci il nome della squadra di casa';
    }
    if (!data.awayTeam || !data.awayTeam.trim()) {
      errors.awayTeam = 'Inserisci il nome della squadra ospite';
    }
    if (
      data.homeTeam &&
      data.awayTeam &&
      data.homeTeam.trim().toLowerCase() === data.awayTeam.trim().toLowerCase()
    ) {
      errors.awayTeam = 'La squadra di casa e quella ospite devono essere diverse';
    }

    // Controlli per assenza di NaN e Infinity, e che i numeri siano finiti e non negativi (media gol >= 0)
    const checkValidNumber = (val: number, field: string, label: string) => {
      if (val === undefined || val === null) {
        errors[field] = `${label} è obbligatorio`;
      } else if (isNaN(val) || !isFinite(val)) {
        errors[field] = `${label} deve essere un numero valido e finito`;
      } else if (val < 0) {
        errors[field] = `${label} non può essere negativo`;
      } else if (val > 10) {
        warnings[field] = `${label} è molto alta (> 10). Assicurati che il valore sia corretto.`;
      }
    };

    checkValidNumber(data.homeScoredAvg, 'homeScoredAvg', 'Media gol segnati in casa');
    checkValidNumber(data.homeConcededAvg, 'homeConcededAvg', 'Media gol subiti in casa');
    checkValidNumber(data.awayScoredAvg, 'awayScoredAvg', 'Media gol segnati in trasferta');
    checkValidNumber(data.awayConcededAvg, 'awayConcededAvg', 'Media gol subiti in trasferta');

    // Medie gol del campionato (devono essere strettamente > 0)
    if (data.leagueHomeScoredAvg === undefined || data.leagueHomeScoredAvg === null) {
      errors.leagueHomeScoredAvg = 'La media gol in casa del campionato è obbligatoria';
    } else if (isNaN(data.leagueHomeScoredAvg) || !isFinite(data.leagueHomeScoredAvg) || data.leagueHomeScoredAvg <= 0) {
      errors.leagueHomeScoredAvg = 'La media gol in casa del campionato deve essere maggiore di zero e finita';
    } else if (data.leagueHomeScoredAvg > 10) {
      warnings.leagueHomeScoredAvg = 'La media gol in casa del campionato è insolitamente alta (> 10).';
    }

    if (data.leagueAwayScoredAvg === undefined || data.leagueAwayScoredAvg === null) {
      errors.leagueAwayScoredAvg = 'La media gol in trasferta del campionato è obbligatoria';
    } else if (isNaN(data.leagueAwayScoredAvg) || !isFinite(data.leagueAwayScoredAvg) || data.leagueAwayScoredAvg <= 0) {
      errors.leagueAwayScoredAvg = 'La media gol in trasferta del campionato deve essere maggiore di zero e finita';
    } else if (data.leagueAwayScoredAvg > 10) {
      warnings.leagueAwayScoredAvg = 'La media gol in trasferta del campionato è insolitamente alta (> 10).';
    }

    // Controllo partite giocate (matchesPlayed >= 1)
    if (data.matchesPlayed === undefined || data.matchesPlayed === null) {
      errors.matchesPlayed = 'Il numero di partite giocate è obbligatorio';
    } else if (isNaN(data.matchesPlayed) || !isFinite(data.matchesPlayed) || data.matchesPlayed < 1) {
      errors.matchesPlayed = 'Il numero di partite giocate deve essere almeno 1';
    } else if (!Number.isInteger(data.matchesPlayed)) {
      errors.matchesPlayed = 'Il numero di partite deve essere un numero intero';
    }

    // Controllo vantaggio casa (-100% a +200%)
    if (data.homeAdvantage === undefined || data.homeAdvantage === null) {
      errors.homeAdvantage = 'La correzione manuale casa è obbligatoria';
    } else if (isNaN(data.homeAdvantage) || !isFinite(data.homeAdvantage) || data.homeAdvantage < -100 || data.homeAdvantage > 200) {
      errors.homeAdvantage = 'La correzione manuale casa deve essere compresa tra -100% e +200%';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  }
}
