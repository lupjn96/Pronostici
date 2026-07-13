/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trash2, Download, Upload, Check, AlertTriangle, HelpCircle, Save, Database, Settings as SettingsIcon } from 'lucide-react';
import { SavedPrediction, MODEL_VERSION } from '../types';
import { runDiagnostics, TestResult } from '../poissonEngine.validation';
import { runPoissonGammaValidation } from '../poissonGammaEngine.validation';
import { runDataEngineValidation } from '../data/FootballDataEngine.validation';
import { runDixonColesValidation } from '../dixonColes.validation';
import { runPerformanceValidation } from '../performance/PerformanceEngine.validation';
import { runDataCollectorValidation } from '../dataCollector/DataCollector.validation';

interface SettingsProps {
  onClearHistory: () => void;
  onImportHistory: (imported: SavedPrediction[]) => boolean;
  historyCount: number;
}

export default function Settings({ onClearHistory, onImportHistory, historyCount }: SettingsProps) {
  // Impostazioni di default salvate in localStorage
  const [defLeagueHomeScored, setDefLeagueHomeScored] = useState<number>(1.45);
  const [defLeagueAwayScored, setDefLeagueAwayScored] = useState<number>(1.15);
  const [defMatchesPlayed, setDefMatchesPlayed] = useState<number>(15);
  const [defHomeAdvantage, setDefHomeAdvantage] = useState<number>(0);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [diagResults, setDiagResults] = useState<(TestResult & { model?: string })[] | null>(null);

  const handleRunDiag = () => {
    const poissonResults = runDiagnostics().map(t => ({ ...t, model: 'Poisson Standard v1.1.0' }));
    const gammaResults = runPoissonGammaValidation().map(t => ({ ...t, model: 'Poisson-Gamma Empirico v0.1.0' }));
    const dataEngineResults = runDataEngineValidation().map(t => ({ ...t, model: 'Football Data Engine v1.0.0' }));
    const dixonColesResults = runDixonColesValidation().map(t => ({ ...t, model: 'Dixon-Coles v1.0.0' }));
    const performanceResults = runPerformanceValidation().map(t => ({ ...t, model: 'Performance Engine v1.0.0' }));
    const dataCollectorResults = runDataCollectorValidation().map(t => ({ ...t, model: 'Data Collector v1.0.0' }));
    setDiagResults([...poissonResults, ...gammaResults, ...dataEngineResults, ...dixonColesResults, ...performanceResults, ...dataCollectorResults]);
  };

  useEffect(() => {
    const cachedHome = localStorage.getItem('def_league_home_scored');
    const cachedAway = localStorage.getItem('def_league_away_scored');
    const cachedMatches = localStorage.getItem('def_matches_played');
    const cachedAdv = localStorage.getItem('def_home_advantage');

    if (cachedHome) setDefLeagueHomeScored(parseFloat(cachedHome));
    if (cachedAway) setDefLeagueAwayScored(parseFloat(cachedAway));
    if (cachedMatches) setDefMatchesPlayed(parseInt(cachedMatches));
    if (cachedAdv) setDefHomeAdvantage(parseFloat(cachedAdv));
  }, []);

  const handleSaveDefaults = () => {
    localStorage.setItem('def_league_home_scored', defLeagueHomeScored.toString());
    localStorage.setItem('def_league_away_scored', defLeagueAwayScored.toString());
    localStorage.setItem('def_matches_played', defMatchesPlayed.toString());
    localStorage.setItem('def_home_advantage', defHomeAdvantage.toString());

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleExportData = () => {
    try {
      const historyJson = localStorage.getItem('football_lab_history') || '[]';
      const blob = new Blob([historyJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `football-prediction-lab-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed)) {
          setImportError('Il file JSON deve essere un array di previsioni.');
          return;
        }

        const success = onImportHistory(parsed);
        if (success) {
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3000);
        } else {
          setImportError('Struttura dei dati non valida per l’importazione.');
        }
      } catch (err) {
        setImportError('Errore durante la lettura o il parsing del file JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-700 pb-5">
        <h2 className="text-2xl font-bold font-sans text-white">Impostazioni</h2>
        <p className="text-slate-400 mt-1 text-sm">
          Personalizza i parametri predefiniti e gestisci il database locale.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parametri Predefiniti */}
        <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/20 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Valori Predefiniti per la Nuova Previsione</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Media Gol Casa Campionato</label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                value={defLeagueHomeScored}
                onChange={(e) => setDefLeagueHomeScored(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Media Gol Ospite Campionato</label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                value={defLeagueAwayScored}
                onChange={(e) => setDefLeagueAwayScored(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Partite Utilizzate Base</label>
              <input
                type="number"
                min="1"
                value={defMatchesPlayed}
                onChange={(e) => setDefMatchesPlayed(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Correzione casa predefinita (%)</label>
              <input
                type="number"
                min="-100"
                max="200"
                value={defHomeAdvantage}
                onChange={(e) => setDefHomeAdvantage(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleSaveDefaults}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-md transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-950/20 cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 shrink-0" /> Salvato con successo!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 shrink-0" /> Salva valori predefiniti
              </>
            )}
          </button>
        </div>

        {/* Gestione Database */}
        <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/20 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Database Locale</h3>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 flex items-center justify-between">
            <div>
              <span className="block text-xs text-slate-400">Previsioni salvate</span>
              <span className="text-xl font-bold font-mono text-white">{historyCount}</span>
            </div>
            <span className="font-mono text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
              LocalStorage
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={handleExportData}
              disabled={historyCount === 0}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm border border-slate-700 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" /> Esporta storico (.JSON)
            </button>

            <label className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm border border-slate-700 cursor-pointer text-center">
              <Upload className="w-4 h-4 shrink-0" /> Importa storico (.JSON)
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>

            <button
              onClick={() => {
                if (window.confirm('Sei sicuro di voler cancellare definitivamente tutto lo storico delle previsioni? Questa azione non è reversibile.')) {
                  onClearHistory();
                }
              }}
              disabled={historyCount === 0}
              className="w-full bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-400 font-semibold py-2.5 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm border border-rose-500/20 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" /> Cancella tutto lo storico
            </button>
          </div>

          {importSuccess && (
            <div className="p-3 bg-emerald-500/10 text-emerald-400 text-xs rounded-xl border border-emerald-500/20 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" /> Storico importato correttamente!
            </div>
          )}

          {importError && (
            <div className="p-3 bg-rose-500/10 text-rose-400 text-xs rounded-xl border border-rose-500/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {importError}
            </div>
          )}
        </div>
      </div>

      {/* Diagnostica & Validazione Motore */}
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/20 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Suite di Validazione Poisson v{MODEL_VERSION}</h3>
          </div>
          <button
            onClick={handleRunDiag}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-md transition-all flex items-center justify-center gap-1.5 text-xs shadow-md cursor-pointer"
          >
            Esegui Test Diagnostici
          </button>
        </div>

        <p className="text-slate-400 text-xs">
          La suite esegue controlli rigorosi sul motore di calcolo, verificando la stabilità dei parametri per lambde uguali a zero, l'invarianza simmetrica e la correctness formale della massa probabilistica (somma 1-X-2 = 100%, complementarietà mercati Over/Under e Goal/NoGoal).
        </p>

        {diagResults ? (
          <div className="space-y-2 mt-4">
            {diagResults.map((test, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                {test.passed ? (
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className={`font-bold ${test.passed ? 'text-white' : 'text-rose-400'}`}>
                      {test.name}
                    </h4>
                    {test.model && (
                      <span className="font-mono text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/50">
                        {test.model}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">{test.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 bg-slate-900/30 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs font-sans">
            Clicca su "Esegui Test Diagnostici" per verificare formalmente la rigorosità matematica del motore Poisson.
          </div>
        )}
      </div>

      {/* Matematica di Poisson Spiegata */}
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/20 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
          <HelpCircle className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white">Logica Matematica del Modello di Poisson</h3>
        </div>

        <div className="text-slate-300 text-sm space-y-3 leading-relaxed">
          <p>
            Il modello di Poisson assume che i gol segnati dalla squadra di casa e da quella ospite siano eventi indipendenti distribuiti secondo una determinata intensità, chiamata <strong className="text-white">Gol Attesi (xG)</strong>.
          </p>

          <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 font-mono text-xs space-y-2 text-slate-400">
            <div>
              <span className="text-emerald-400 font-bold">xG_Casa =</span> (MedGolSegnatiCasa / CampionatoMedGolSegnatiCasa) * (MedGolSubitiOspite / CampionatoMedGolSegnatiCasa) * CampionatoMedGolSegnatiCasa * (1 + VantaggioCasa/100)
            </div>
            <div>
              <span className="text-emerald-400 font-bold">xG_Ospite =</span> (MedGolSegnatiOspite / CampionatoMedGolSegnatiOspite) * (MedGolSubitiCasa / CampionatoMedGolSegnatiOspite) * CampionatoMedGolSegnatiOspite
            </div>
          </div>

          <p>
            Una volta calcolate le intensità $\lambda_c$ (xG Casa) e $\lambda_o$ (xG Ospite), la probabilità che il match finisca con un punteggio esatto $H-A$ viene ricavata tramite il prodotto delle singole probabilità di Poisson:
          </p>

          <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 font-mono text-xs text-slate-400 text-center">
            P(H - A) = [ (λ_c^H * e^-λ_c) / H! ] * [ (λ_o^A * e^-λ_o) / A! ]
          </div>

          <p>
            L’app genera poi una matrice fino a un limite di 12 gol, raggruppa le probabilità per ottenere i mercati 1X2, Under/Over e Goal/NoGoal, e infine normalizza l’esito 1X2 per far sì che la somma sia rigorosamente pari al 100%.
          </p>
        </div>
      </div>
    </div>
  );
}
