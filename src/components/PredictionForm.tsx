/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ModelInput } from '../types';
import { validateInput } from '../poissonEngine';
import { HelpCircle, AlertTriangle, Play, Sparkles } from 'lucide-react';

interface PredictionFormProps {
  onCalculate: (input: ModelInput, modelId: string) => void;
  initialInput?: ModelInput;
  initialModelId?: string;
}

export default function PredictionForm({ onCalculate, initialInput, initialModelId }: PredictionFormProps) {
  const [homeTeam, setHomeTeam] = useState('Inter');
  const [awayTeam, setAwayTeam] = useState('Juventus');
  
  // Medie Gol del Team
  const [homeScoredAvg, setHomeScoredAvg] = useState<string>('2,15');
  const [homeConcededAvg, setHomeConcededAvg] = useState<string>('0,85');
  const [awayScoredAvg, setAwayScoredAvg] = useState<string>('1,65');
  const [awayConcededAvg, setAwayConcededAvg] = useState<string>('0,95');

  // Medie Campionato
  const [leagueHomeScoredAvg, setLeagueHomeScoredAvg] = useState<string>('1,45');
  const [leagueAwayScoredAvg, setLeagueAwayScoredAvg] = useState<string>('1,15');

  // Altri parametri richiesti
  const [matchesPlayed, setMatchesPlayed] = useState<string>('15');
  const [homeAdvantage, setHomeAdvantage] = useState<number>(0); // in %

  const [selectedModelId, setSelectedModelId] = useState<string>('poisson-standard');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Sincronizza il modello iniziale se presente
  useEffect(() => {
    if (initialModelId) {
      setSelectedModelId(initialModelId);
    }
  }, [initialModelId]);

  // Carica i valori predefiniti salvati se presenti, o un input iniziale (es. dallo storico)
  useEffect(() => {
    if (initialInput) {
      setHomeTeam(initialInput.homeTeam);
      setAwayTeam(initialInput.awayTeam);
      setHomeScoredAvg(initialInput.homeScoredAvg.toString().replace('.', ','));
      setHomeConcededAvg(initialInput.homeConcededAvg.toString().replace('.', ','));
      setAwayScoredAvg(initialInput.awayScoredAvg.toString().replace('.', ','));
      setAwayConcededAvg(initialInput.awayConcededAvg.toString().replace('.', ','));
      setLeagueHomeScoredAvg(initialInput.leagueHomeScoredAvg.toString().replace('.', ','));
      setLeagueAwayScoredAvg(initialInput.leagueAwayScoredAvg.toString().replace('.', ','));
      setMatchesPlayed(initialInput.matchesPlayed.toString());
      setHomeAdvantage(initialInput.homeAdvantage);
    } else {
      const cachedHome = localStorage.getItem('def_league_home_scored');
      const cachedAway = localStorage.getItem('def_league_away_scored');
      const cachedMatches = localStorage.getItem('def_matches_played');
      const cachedAdv = localStorage.getItem('def_home_advantage');

      if (cachedHome) setLeagueHomeScoredAvg(cachedHome.replace('.', ','));
      if (cachedAway) setLeagueAwayScoredAvg(cachedAway.replace('.', ','));
      if (cachedMatches) setMatchesPlayed(cachedMatches);
      if (cachedAdv) setHomeAdvantage(parseFloat(cachedAdv));
    }
  }, [initialInput]);

  // Gestione precompilazione dati demo (Inter - Juventus o Milan - Napoli)
  const handleLoadDemo = () => {
    setHomeTeam('Milan');
    setAwayTeam('Napoli');
    setHomeScoredAvg('1,85');
    setHomeConcededAvg('1,10');
    setAwayScoredAvg('1,50');
    setAwayConcededAvg('1,20');
    setLeagueHomeScoredAvg('1,40');
    setLeagueAwayScoredAvg('1,10');
    setMatchesPlayed('12');
    setHomeAdvantage(0);
    setErrors({});
    setWarnings({});
    setGeneralError(null);
  };

  const parseItalianFloat = (val: string): number => {
    const clean = val.replace(',', '.').trim();
    return parseFloat(clean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    // Costruisci l'oggetto ModelInput eseguendo il parsing dei float italiani (es. 2,15 -> 2.15)
    const input: ModelInput = {
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      homeScoredAvg: parseItalianFloat(homeScoredAvg),
      homeConcededAvg: parseItalianFloat(homeConcededAvg),
      awayScoredAvg: parseItalianFloat(awayScoredAvg),
      awayConcededAvg: parseItalianFloat(awayConcededAvg),
      leagueHomeScoredAvg: parseItalianFloat(leagueHomeScoredAvg),
      leagueAwayScoredAvg: parseItalianFloat(leagueAwayScoredAvg),
      matchesPlayed: parseInt(matchesPlayed, 10),
      homeAdvantage: homeAdvantage,
    };

    // Validazione
    const validation = validateInput(input);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setGeneralError('Correggi gli errori nel modulo prima di procedere.');
      return;
    }

    // Imposta gli eventuali avvisi del modello
    setWarnings(validation.warnings || {});

    // Passa i dati validati al genitore per il calcolo
    onCalculate(input, selectedModelId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bottoni veloci Demo */}
      <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700">
        <div>
          <span className="block text-xs font-semibold text-white">Modalità di Prova</span>
          <span className="text-[10px] text-slate-400">Compila istantaneamente con dati realistici di esempio</span>
        </div>
        <button
          type="button"
          onClick={handleLoadDemo}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-xs px-3.5 py-2 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" /> Dati Demo
        </button>
      </div>

      {/* Selettore Modello di Calcolo */}
      <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-3">
          Modello di Calcolo Attivo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedModelId('poisson-standard')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${
              selectedModelId === 'poisson-standard'
                ? 'border-emerald-500/40 bg-slate-800/40 ring-1 ring-emerald-500/10'
                : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
            }`}
          >
            <div>
              <span className={`block text-xs font-bold ${selectedModelId === 'poisson-standard' ? 'text-emerald-400' : 'text-slate-300'}`}>
                Poisson Standard v1.1
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block leading-normal">
                Usa la classica distribuzione di Poisson per stimare le probabilità basandosi sulle medie storiche indipendenti.
              </span>
            </div>
            <div className="flex items-center gap-1.5 self-end mt-2">
              <span className={`w-1.5 h-1.5 rounded-full ${selectedModelId === 'poisson-standard' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Selezionato</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedModelId('poisson-gamma')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${
              selectedModelId === 'poisson-gamma'
                ? 'border-emerald-500/40 bg-slate-800/40 ring-1 ring-emerald-500/10'
                : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
            }`}
          >
            <div>
              <span className={`block text-xs font-bold ${selectedModelId === 'poisson-gamma' ? 'text-emerald-400' : 'text-slate-300'}`}>
                Poisson-Gamma Bayesiano v0.1
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block leading-normal">
                Modella i gol con un a-priori Gamma per catturare l'incertezza epistemica dovuta a dati ridotti.
              </span>
            </div>
            <div className="flex items-center gap-1.5 self-end mt-2">
              <span className={`w-1.5 h-1.5 rounded-full ${selectedModelId === 'poisson-gamma' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Selezionato</span>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-3">
          1. Nomi delle Squadre
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Squadra di Casa</label>
            <input
              type="text"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              className={`w-full bg-slate-900 border rounded p-2 text-white text-sm focus:outline-none transition-all ${
                errors.homeTeam ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-700 focus:border-emerald-500'
              }`}
              placeholder="Es. Inter"
            />
            {errors.homeTeam && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.homeTeam}</span>}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Squadra Ospite</label>
            <input
              type="text"
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              className={`w-full bg-slate-900 border rounded p-2 text-white text-sm focus:outline-none transition-all ${
                errors.awayTeam ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-700 focus:border-emerald-500'
              }`}
              placeholder="Es. Juventus"
            />
            {errors.awayTeam && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.awayTeam}</span>}
          </div>
        </div>
      </div>

      {/* Sezione Statistiche Medie Gol */}
      <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-3">
          2. Medie Storiche Gol dei Team
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Squadra di Casa (In Casa) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              {homeTeam || 'Squadra Casa'} (partite casalinghe)
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Gol Segnati (Casa)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={homeScoredAvg}
                  onChange={(e) => setHomeScoredAvg(e.target.value)}
                  className={`w-full bg-slate-900 border rounded p-2 text-white font-mono text-sm focus:outline-none transition-all ${
                    errors.homeScoredAvg ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'
                  }`}
                  placeholder="Es. 2,15"
                />
                {errors.homeScoredAvg && <span className="text-[9px] text-red-400 font-mono mt-1 block">{errors.homeScoredAvg}</span>}
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Gol Subiti (Casa)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={homeConcededAvg}
                  onChange={(e) => setHomeConcededAvg(e.target.value)}
                  className={`w-full bg-slate-900 border rounded p-2 text-white font-mono text-sm focus:outline-none transition-all ${
                    errors.homeConcededAvg ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'
                  }`}
                  placeholder="Es. 0,85"
                />
                {errors.homeConcededAvg && <span className="text-[9px] text-red-400 font-mono mt-1 block">{errors.homeConcededAvg}</span>}
              </div>
            </div>
          </div>

          {/* Squadra Ospite (In Trasferta) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              {awayTeam || 'Squadra Ospite'} (partite in trasferta)
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Gol Segnati (Fuori)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={awayScoredAvg}
                  onChange={(e) => setAwayScoredAvg(e.target.value)}
                  className={`w-full bg-slate-900 border rounded p-2 text-white font-mono text-sm focus:outline-none transition-all ${
                    errors.awayScoredAvg ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'
                  }`}
                  placeholder="Es. 1,65"
                />
                {errors.awayScoredAvg && <span className="text-[9px] text-red-400 font-mono mt-1 block">{errors.awayScoredAvg}</span>}
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Gol Subiti (Fuori)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={awayConcededAvg}
                  onChange={(e) => setAwayConcededAvg(e.target.value)}
                  className={`w-full bg-slate-900 border rounded p-2 text-white font-mono text-sm focus:outline-none transition-all ${
                    errors.awayConcededAvg ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'
                  }`}
                  placeholder="Es. 0,95"
                />
                {errors.awayConcededAvg && <span className="text-[9px] text-red-400 font-mono mt-1 block">{errors.awayConcededAvg}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Medie Campionato, Partite Giocate e Vantaggio Casa */}
      <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-3">
          3. Parametri Campionato e Affidabilità
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Gol Campionato (Casa)</label>
            <input
              type="text"
              inputMode="decimal"
              value={leagueHomeScoredAvg}
              onChange={(e) => setLeagueHomeScoredAvg(e.target.value)}
              className={`w-full bg-slate-900 border rounded p-2 text-white font-mono text-sm focus:outline-none transition-all ${
                errors.leagueHomeScoredAvg ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'
              }`}
              placeholder="Es. 1,45"
            />
            {errors.leagueHomeScoredAvg && <span className="text-[9px] text-red-400 font-mono mt-1 block">{errors.leagueHomeScoredAvg}</span>}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Gol Campionato (Fuori)</label>
            <input
              type="text"
              inputMode="decimal"
              value={leagueAwayScoredAvg}
              onChange={(e) => setLeagueAwayScoredAvg(e.target.value)}
              className={`w-full bg-slate-900 border rounded p-2 text-white font-mono text-sm focus:outline-none transition-all ${
                errors.leagueAwayScoredAvg ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'
              }`}
              placeholder="Es. 1,15"
            />
            {errors.leagueAwayScoredAvg && <span className="text-[9px] text-red-400 font-mono mt-1 block">{errors.leagueAwayScoredAvg}</span>}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Partite Giocate</label>
            <input
              type="number"
              min="1"
              step="1"
              value={matchesPlayed}
              onChange={(e) => setMatchesPlayed(e.target.value)}
              className={`w-full bg-slate-900 border rounded p-2 text-white font-mono text-sm focus:outline-none transition-all ${
                errors.matchesPlayed ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'
              }`}
              placeholder="Es. 15"
            />
            {errors.matchesPlayed && <span className="text-[9px] text-red-400 font-mono mt-1 block">{errors.matchesPlayed}</span>}
          </div>
        </div>

        {/* Correzione manuale casa */}
        <div className="pt-3 border-t border-slate-700">
          <div className="flex justify-between items-start mb-1.5">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Correzione manuale casa</label>
              <p className="text-[10px] text-slate-400 leading-tight">
                Usare soltanto per condizioni particolari non già rappresentate dalle statistiche casa/trasferta.
              </p>
            </div>
            <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0 ml-4">
              {homeAdvantage > 0 ? '+' : ''}{homeAdvantage}%
            </span>
          </div>
          
          <input
            type="range"
            min="-50"
            max="100"
            step="1"
            value={homeAdvantage}
            onChange={(e) => setHomeAdvantage(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
            <span>Svantaggio (-50%)</span>
            <span>Nullo (0%)</span>
            <span>Standard (+15%)</span>
            <span>Massimo (+100%)</span>
          </div>
        </div>
      </div>

      {/* Avvisi del Modello */}
      {Object.keys(warnings).length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col gap-2 text-amber-400 text-xs">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Avvisi di calcolo (Attenzione)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 font-sans">
            {Object.values(warnings).map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Errore Generale */}
      {generalError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Pulsante Calcola Previsione */}
      <button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-md text-sm font-semibold transition shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Play className="w-4 h-4 fill-white shrink-0" /> Calcola previsione
      </button>
    </form>
  );
}
