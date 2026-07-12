/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavedPrediction } from '../types';
import { LayoutDashboard, ShieldAlert, Award, Calendar, Database, ArrowRight, Play, CheckCircle2, TrendingUp } from 'lucide-react';

interface DashboardProps {
  predictions: SavedPrediction[];
  onNavigate: (section: string) => void;
  onOpenPrediction: (prediction: SavedPrediction) => void;
  onRunDemo: () => void;
}

export default function Dashboard({ predictions, onNavigate, onOpenPrediction, onRunDemo }: DashboardProps) {
  const formatComma = (val: number) => {
    return val.toFixed(1).replace('.', ',');
  };

  // Calcolo statistiche storiche
  const totalCount = predictions.length;
  const avgReliability = totalCount > 0
    ? predictions.reduce((acc, curr) => acc + (curr.result.uncertainty.solidityIndex ?? (curr.result.uncertainty as any).reliability ?? 0), 0) / totalCount
    : 0;
  const avgQuality = totalCount > 0
    ? predictions.reduce((acc, curr) => acc + curr.result.uncertainty.dataQuality, 0) / totalCount
    : 0;

  // Prendi le ultime 3 previsioni
  const recentPredictions = predictions.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Hero Welcome banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#1e293b] border border-slate-700 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase">
            ⚽ Laboratorio di Predizione Calcistica
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-sans text-white tracking-tight leading-none">
            Football Prediction Lab
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Stima scientificamente le probabilità di eventi calcistici sfruttando la distribuzione di Poisson, l’entropia di Shannon e indici di affidabilità ponderati.
          </p>
        </div>

        <button
          onClick={() => onNavigate('prediction')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-950/20 self-start md:self-auto shrink-0 cursor-pointer"
        >
          Nuova Previsione <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-700 bg-slate-800/40 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
              Previsioni in Archivio
            </span>
            <span className="text-2xl font-black font-mono text-white">
              {totalCount}
            </span>
          </div>
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-700 bg-slate-800/40 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
              Solidità Media
            </span>
            <span className="text-2xl font-black font-mono text-white">
              {totalCount > 0 ? `${formatComma(avgReliability)}%` : 'N/D'}
            </span>
          </div>
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-700 bg-slate-800/40 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
              Qualità Dati Media
            </span>
            <span className="text-2xl font-black font-mono text-white">
              {totalCount > 0 ? `${formatComma(avgQuality)}%` : 'N/D'}
            </span>
          </div>
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sinistra/Centrale: Ultime Previsioni */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-sans font-bold text-white text-base">
              Previsioni Recenti
            </h3>
            {totalCount > 3 && (
              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-all cursor-pointer"
              >
                Vedi tutte ({totalCount}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentPredictions.length === 0 ? (
            <div className="p-6 rounded-xl border border-slate-700 bg-slate-800/20 text-center space-y-3">
              <p className="text-slate-400 text-xs">
                Non ci sono ancora simulazioni salvate. Fai la tua prima previsione in un click!
              </p>
              <button
                onClick={onRunDemo}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-xs px-4 py-2 rounded-lg border border-emerald-500/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-emerald-400" /> Avvia una Previsione Demo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {recentPredictions.map((pred) => {
                const homeWin = pred.result.probHomeWin;
                const draw = pred.result.probDraw;
                const awayWin = pred.result.probAwayWin;
                
                let mainTip = '1';
                let mainProb = homeWin;
                if (draw > mainProb) { mainTip = 'X'; mainProb = draw; }
                if (awayWin > mainProb) { mainTip = '2'; mainProb = awayWin; }

                return (
                  <div
                    key={pred.id}
                    className="p-4 rounded-xl border border-slate-700/60 bg-slate-800/20 flex items-center justify-between gap-4"
                  >
                    <div className="truncate">
                      <span className="font-mono text-[9px] text-slate-500 block">
                        {new Date(pred.dateTime).toLocaleDateString('it-IT')}
                      </span>
                      <strong className="text-white text-sm truncate block mt-0.5">
                        {pred.input.homeTeam} vs {pred.input.awayTeam}
                      </strong>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="block text-[9px] font-mono text-slate-500 uppercase">Pronostico</span>
                        <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                          {mainTip} ({formatComma(mainProb)}%)
                        </span>
                      </div>

                      <button
                        onClick={() => onOpenPrediction(pred)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all border border-slate-700/60 cursor-pointer"
                        title="Vedi dettagli"
                      >
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Destra: Guide e Modello Attivo */}
        <div className="space-y-4">
          <h3 className="font-sans font-bold text-white text-base">
            Modello in Funzione
          </h3>

          <div className="p-5 rounded-xl border border-slate-700 bg-slate-800/40 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              <h4 className="font-bold text-sm text-white">Poisson Model</h4>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              Il calcolo stima in modo matematico la distribuzione di probabilità dei punteggi, calcola l’entropia degli esiti per quantificare il disordine del pronostico (Incertezza) e unisce la qualità dei dati con l'entropia della distribuzione per determinare l'Indice di Solidità.
            </p>

            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                Feature Implementate
              </span>
              <ul className="text-[10.5px] text-slate-300 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Funzione Poisson & Fattoriale
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Calcolo xG con Correzione Casa
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Entropia degli esiti 1-X-2
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Qualità Dati & Solidità %
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Matrice 7x7 interattiva
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
