/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { SavedPrediction } from '../types';
import { Trash2, Eye, Calendar, ShieldAlert, Award, Search, Sparkles } from 'lucide-react';

interface HistoryListProps {
  predictions: SavedPrediction[];
  onDelete: (id: string) => void;
  onOpen: (prediction: SavedPrediction) => void;
}

export default function HistoryList({ predictions, onDelete, onOpen }: HistoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const formatComma = (val: number, decimals: number = 2) => {
    return val.toFixed(decimals).replace('.', ',');
  };

  const getPrimaryPrediction = (pred: SavedPrediction) => {
    const r = pred.result;
    let tip = '1';
    let prob = r.probHomeWin;
    let color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

    if (r.probDraw > prob) {
      tip = 'X';
      prob = r.probDraw;
      color = 'text-slate-300 bg-slate-800 border-slate-700';
    }
    if (r.probAwayWin > prob) {
      tip = '2';
      prob = r.probAwayWin;
      color = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }

    return { tip, prob, color };
  };

  const filtered = predictions.filter((pred) => {
    const matchName = `${pred.input.homeTeam} vs ${pred.input.awayTeam}`.toLowerCase();
    return matchName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-700 pb-5">
        <h2 className="text-2xl font-bold font-sans text-white">Storico Previsioni</h2>
        <p className="text-slate-400 mt-1 text-sm">
          Sfoglia e ricarica i calcoli salvati localmente sul tuo dispositivo.
        </p>
      </div>

      {/* Barra di ricerca */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <Search className="h-4 w-4 text-slate-500" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca per nome squadra..."
          className="w-full bg-slate-900 border border-slate-700 rounded pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all"
        />
      </div>

      {predictions.length === 0 ? (
        <div className="text-center p-12 rounded-xl border border-dashed border-slate-700 bg-slate-800/10 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Nessuna previsione nello storico</h3>
            <p className="text-slate-500 text-xs max-w-sm mx-auto mt-1">
              Inserisci i dati nella sezione "Nuova previsione" e premi "Calcola previsione" per salvare i tuoi studi.
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-8 rounded-xl border border-slate-700 bg-slate-800/10 text-slate-500 text-sm">
          Nessuna previsione corrisponde alla ricerca "{searchTerm}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((pred) => {
            const { tip, prob, color } = getPrimaryPrediction(pred);
            const classif = pred.result.uncertainty.classification;
            return (
              <div
                key={pred.id}
                className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/30 transition-all flex flex-col md:flex-row justify-between gap-4"
              >
                {/* Parte sinistra: info partita e data */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono text-[11px] text-slate-500">
                      {new Date(pred.dateTime).toLocaleString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {pred.input.homeTeam} <span className="text-slate-600 font-normal">vs</span> {pred.input.awayTeam}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        xG: {formatComma(pred.result.homeExpectedGoals)} - {formatComma(pred.result.awayExpectedGoals)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {pred.input.matchesPlayed} match
                      </span>
                    </div>
                  </div>
                </div>

                {/* Parte centrale: Pronostico ed Affidabilità */}
                <div className="flex flex-wrap items-center gap-4 md:gap-8 justify-between md:justify-end shrink-0">
                  <div className="text-center">
                    <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      Pronostico
                    </span>
                    <span className={`inline-block font-mono font-bold text-xs px-2.5 py-1 rounded-md border uppercase ${color}`}>
                      {tip} ({formatComma(prob, 1)}%)
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      Incertezza
                    </span>
                    <span className={`inline-block font-sans font-semibold text-[10px] px-2 py-1 rounded-md border uppercase ${
                      classif === 'Bassa Incertezza'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : classif === 'Incertezza Moderata'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {classif}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      Affidabilità
                    </span>
                    <span className="font-mono font-bold text-slate-200 text-sm flex items-center gap-1 justify-center">
                      <Award className="w-3.5 h-3.5 text-emerald-400" /> {formatComma(pred.result.uncertainty.reliability, 0)}%
                    </span>
                  </div>
                </div>

                {/* Parte destra: Pulsanti azione */}
                <div className="flex items-center gap-2 border-t border-slate-700/50 pt-4 md:pt-0 md:border-t-0 md:pl-4 justify-end shrink-0">
                  <button
                    onClick={() => onOpen(pred)}
                    className="flex-1 md:flex-none p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-all flex items-center justify-center gap-1.5 text-xs border border-slate-700 cursor-pointer"
                    title="Vedi Analisi"
                  >
                    <Eye className="w-4 h-4" /> Apri
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Sei sicuro di voler eliminare definitivamente lo studio di ${pred.input.homeTeam} vs ${pred.input.awayTeam}?`)) {
                        onDelete(pred.id);
                      }
                    }}
                    className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-md transition-all flex items-center justify-center border border-rose-500/20 cursor-pointer"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
