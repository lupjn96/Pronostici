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
  private validationResult: ValidationResult | null = null;

  /**
   * Carica i dati di input manuali forniti dal form.
   */
  loadManualInput(input: any): void {
    this.rawInput = input;
    
    // Valida prima il rawInput originale
    const validation = this.validateRaw(input);
    this.validationResult = validation;

    if (!validation.isValid) {
      this.normalizedData = null;
      this.features = null;
    } else {
      // Genera i dati normalizzati e le feature solo se valido
      this.normalizedData = DataNormalizer.normalize(input);
      this.features = FeatureBuilder.buildFeatures(this.normalizedData, 'manual_input', true);
    }
  }

  /**
   * Restituisce il match corrente sotto forma di MatchFeatures.
   */
  getCurrentMatch(): MatchFeatures | null {
    return this.getFeatures();
  }

  /**
   * Restituisce le feature estratte e pronte per i modelli.
   */
  getFeatures(): MatchFeatures | null {
    if (this.validationResult && !this.validationResult.isValid) {
      return null;
    }
    return this.features;
  }

  /**
   * Restituisce i dati normalizzati (nel formato ModelInput).
   */
  getNormalizedData(): ModelInput | null {
    return this.normalizedData;
  }

  /**
   * Valida l'input originale correntemente caricato nel motore.
   */
  validate(): ValidationResult {
    if (this.validationResult) {
      return this.validationResult;
    }
    return this.validateRaw(this.rawInput);
  }

  /**
   * Valida il rawInput originale.
   */
  private validateRaw(raw: any): ValidationResult {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    if (!raw) {
      return {
        isValid: false,
        errors: { general: 'Nessun dato di input caricato nel Football Data Engine.' },
        warnings: {}
      };
    }

    // Nomi squadre obbligatori e diversi
    const homeTeam = raw.homeTeam !== undefined && raw.homeTeam !== null ? String(raw.homeTeam).trim() : '';
    const awayTeam = raw.awayTeam !== undefined && raw.awayTeam !== null ? String(raw.awayTeam).trim() : '';

    if (!homeTeam) {
      errors.homeTeam = 'Inserisci il nome della squadra di casa';
    }
    if (!awayTeam) {
      errors.awayTeam = 'Inserisci il nome della squadra ospite';
    }
    if (homeTeam && awayTeam && homeTeam.toLowerCase() === awayTeam.toLowerCase()) {
      errors.awayTeam = 'La squadra di casa e quella ospite devono essere diverse';
    }

    const parseRawValue = (val: any): number => {
      if (val === undefined || val === null) return NaN;
      if (typeof val === 'number') return val;
      const str = String(val).trim().replace(',', '.');
      if (str === '') return NaN;
      return Number(str);
    };

    const validateGoalAvg = (val: any, field: string, label: string) => {
      const num = parseRawValue(val);
      if (val === undefined || val === null) {
        errors[field] = `${label} è obbligatorio`;
      } else if (isNaN(num) || !isFinite(num)) {
        errors[field] = `${label} deve essere un numero valido e finito`;
      } else if (num < 0) {
        errors[field] = `${label} non può essere negativo`;
      } else if (num > 10) {
        warnings[field] = `${label} è molto alta (> 10). Assicurati che il valore sia corretto.`;
      }
    };

    validateGoalAvg(raw.homeScoredAvg, 'homeScoredAvg', 'Media gol segnati in casa');
    validateGoalAvg(raw.homeConcededAvg, 'homeConcededAvg', 'Media gol subiti in casa');
    validateGoalAvg(raw.awayScoredAvg, 'awayScoredAvg', 'Media gol segnati in trasferta');
    validateGoalAvg(raw.awayConcededAvg, 'awayConcededAvg', 'Media gol subiti in trasferta');

    // Medie gol del campionato (devono essere strettamente > 0)
    const validateLeagueAvg = (val: any, field: string, label: string) => {
      const num = parseRawValue(val);
      if (val === undefined || val === null) {
        errors[field] = `${label} è obbligatoria`;
      } else if (isNaN(num) || !isFinite(num)) {
        errors[field] = `${label} deve essere un numero valido e finito`;
      } else if (num <= 0) {
        errors[field] = `${label} deve essere maggiore di zero e finita`;
      } else if (num > 10) {
        warnings[field] = `${label} è insolitamente alta (> 10).`;
      }
    };

    validateLeagueAvg(raw.leagueHomeScoredAvg, 'leagueHomeScoredAvg', 'La media gol in casa del campionato');
    validateLeagueAvg(raw.leagueAwayScoredAvg, 'leagueAwayScoredAvg', 'La media gol in trasferta del campionato');

    // Controllo partite giocate (matchesPlayed >= 1 e intero)
    const matchesPlayedRaw = raw.matchesPlayed;
    const matchesPlayedNum = parseRawValue(matchesPlayedRaw);
    if (matchesPlayedRaw === undefined || matchesPlayedRaw === null) {
      errors.matchesPlayed = 'Il numero di partite giocate è obbligatorio';
    } else if (isNaN(matchesPlayedNum) || !isFinite(matchesPlayedNum)) {
      errors.matchesPlayed = 'Il numero di partite giocate deve essere un numero valido e finito';
    } else if (matchesPlayedNum < 1) {
      errors.matchesPlayed = 'Il numero di partite giocate deve essere almeno 1';
    } else if (!Number.isInteger(matchesPlayedNum)) {
      errors.matchesPlayed = 'Il numero di partite deve essere un numero intero';
    }

    // Controllo vantaggio casa (-100% a +200%)
    const homeAdvantageRaw = raw.homeAdvantage;
    const homeAdvantageNum = parseRawValue(homeAdvantageRaw);
    if (homeAdvantageRaw === undefined || homeAdvantageRaw === null) {
      errors.homeAdvantage = 'La correzione manuale casa è obbligatoria';
    } else if (isNaN(homeAdvantageNum) || !isFinite(homeAdvantageNum)) {
      errors.homeAdvantage = 'La correzione manuale casa deve essere un numero valido e finito';
    } else if (homeAdvantageNum < -100 || homeAdvantageNum > 200) {
      errors.homeAdvantage = 'La correzione manuale casa deve essere compresa tra -100% e +200%';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  }
}
