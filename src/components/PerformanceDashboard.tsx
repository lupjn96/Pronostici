/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { SavedPrediction } from '../types';
import { aggregateModelPerformance, ModelPerformanceSummary } from '../performance/PerformanceAggregator';
import { 
  Trophy, 
  Target, 
  Activity, 
  Info, 
  ShieldAlert, 
  Percent, 
  FileCheck, 
  Flame, 
  BarChart3, 
  TrendingUp, 
  Sparkles 
} from 'lucide-react';

interface PerformanceDashboardProps {
  predictions: SavedPrediction[];
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ predictions }) => {
  // Genera i riepiloghi delle prestazioni
  const performanceSummaries = useMemo(() => {
    return aggregateModelPerformance(predictions);
  }, [predictions]);

  // Genera la classifica preliminare ordinata secondo le regole:
  // 1. averageLogLoss crescente
  // 2. averageBrierScore crescente
  // 3. accuracy1X2 decrescente
  const rankedModels = useMemo(() => {
    return [...performanceSummaries].sort((a, b) => {
      if (a.averageLogLoss !== b.averageLogLoss) {
        return a.averageLogLoss - b.averageLogLoss;
      }
      if (a.averageBrierScore !== b.averageBrierScore) {
        return a.averageBrierScore - b.averageBrierScore;
      }
      return b.accuracy1X2 - a.accuracy1X2;
    });
  }, [performanceSummaries]);

  // Conta le predizioni valutate in totale
  const totalEvaluated = useMemo(() => {
    return predictions.filter(p => p.evaluation !== undefined).length;
  }, [predictions]);

  // Funzione per ottenere il badge sul campione statistico
  const getSampleSizeBadge = (n: number) => {
    if (n < 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <ShieldAlert className="w-3 h-3" />
          Campione insufficiente
        </span>
      );
    } else if (n <= 99) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Info className="w-3 h-3" />
          Campione limitato
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Sparkles className="w-3 h-3" />
          Campione significativo
        </span>
      );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Intestazione */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-emerald-400" />
          Performance Tracker
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Monitora e confronta l'accuratezza predittiva dei modelli statistici sulla base dei risultati reali delle partite registrate.
        </p>
      </div>

      {totalEvaluated === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-500 border border-slate-800">
            <FileCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">Nessun dato di performance</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Per visualizzare le metriche e sbloccare la classifica, vai nella sezione <strong className="text-emerald-400">Storico</strong> e inserisci il risultato reale di una o più partite pronosticate.
          </p>
        </div>
      ) : (
        <>
          {/* Sezione Avviso Statistico e Sicurezza */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 text-sm text-slate-300">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-blue-400 block">Avviso di sicurezza statistica</span>
              <p className="leading-relaxed text-xs">
                Le metriche valutano la qualità statistica delle previsioni passate. Non garantiscono risultati futuri né profitti nelle scommesse.
              </p>
            </div>
          </div>

          {/* 11. CLASSIFICA MODELLI */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Classifica preliminare sui dati valutati
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ordinamento principale per Log Loss decrescente (valore minore = migliore), seguito da Brier Score e accuratezza 1-X-2.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/60">
                      <th className="p-4 text-center w-12">Rank</th>
                      <th className="p-4">Modello</th>
                      <th className="p-4 text-center">Partite Valutate</th>
                      <th className="p-4 text-center">Accuratezza 1-X-2</th>
                      <th className="p-4 text-center">Log Loss Medio</th>
                      <th className="p-4 text-center">Brier Score Medio</th>
                      <th className="p-4">Stato Campione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {rankedModels.map((model, idx) => {
                      const rankColors = [
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                        'bg-slate-400/10 text-slate-300 border border-slate-400/20',
                        'bg-amber-700/10 text-amber-600 border border-amber-700/20'
                      ];
                      const rankBadge = idx < 3 ? rankColors[idx] : 'bg-slate-800 text-slate-400 border border-slate-700';

                      return (
                        <tr key={model.modelId} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-bold ${rankBadge}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-slate-200">
                            {model.modelName}
                            <span className="text-[10px] text-slate-500 block font-mono">v{model.modelVersion}</span>
                          </td>
                          <td className="p-4 text-center font-mono text-slate-300">
                            {model.evaluatedPredictions}
                          </td>
                          <td className="p-4 text-center font-mono text-slate-200 font-bold text-sm">
                            {model.accuracy1X2.toFixed(1)}%
                          </td>
                          <td className="p-4 text-center font-mono font-semibold text-emerald-400">
                            {model.averageLogLoss.toFixed(4)}
                          </td>
                          <td className="p-4 text-center font-mono text-slate-300">
                            {model.averageBrierScore.toFixed(4)}
                          </td>
                          <td className="p-4">
                            {getSampleSizeBadge(model.evaluatedPredictions)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 flex gap-2.5 items-start text-xs text-slate-400">
              <ShieldAlert className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
              <span>
                <strong>Nota di cautela:</strong> I risultati sono indicativi. Un numero ridotto di partite non è sufficiente per stabilire quale modello sia realmente migliore.
              </span>
            </div>
          </div>

          {/* 10. GUIDA METRICHE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/20 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-200">Accuratezza 1-X-2</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Percentuale di partite in cui il modello ha individuato correttamente 1, X o 2.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/20 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-bold text-slate-200">Brier Score</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Misura l'errore complessivo delle probabilità distribuite sui tre esiti. Più basso è, meglio è.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/20 space-y-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-slate-200">Log Loss</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Penalizza fortemente le previsioni in cui il modello era molto sicuro ma si sono rivelate sbagliate. Più basso è, meglio è.
              </p>
            </div>
          </div>

          {/* 10. SCHEDE DEI MODELLI VALUTATI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {performanceSummaries.map((model) => (
              <div 
                key={model.modelId} 
                className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6 space-y-6 flex flex-col justify-between"
              >
                {/* Nome Modello e Info Generali */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black text-slate-100 tracking-tight">
                        {model.modelName}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Versione: {model.modelVersion}
                      </span>
                    </div>
                    {getSampleSizeBadge(model.evaluatedPredictions)}
                  </div>

                  {/* Statistiche Principali */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                        Partite Valutate
                      </span>
                      <span className="text-lg font-black font-mono text-slate-200 mt-1 block">
                        {model.evaluatedPredictions}
                      </span>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                        Accuratezza 1X2
                      </span>
                      <span className="text-lg font-black font-mono text-emerald-400 mt-1 block">
                        {model.accuracy1X2.toFixed(1)}%
                      </span>
                      <span className="text-[8px] text-slate-500 block">
                        {model.correct1X2Count} / {model.evaluatedPredictions}
                      </span>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                        Acc. Ris. Esatto
                      </span>
                      <span className="text-lg font-black font-mono text-blue-400 mt-1 block">
                        {model.exactScoreAccuracy.toFixed(1)}%
                      </span>
                      <span className="text-[8px] text-slate-500 block">
                        {model.correctExactScoreCount} / {model.evaluatedPredictions}
                      </span>
                    </div>
                  </div>

                  {/* Metriche di Errore Numerico */}
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block border-b border-slate-800 pb-1">
                      Indicatori di Deviazione e Probabilità
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[9px] text-slate-500 block">Brier Score Medio</span>
                        <span className="text-sm font-bold font-mono text-slate-300">
                          {model.averageBrierScore.toFixed(4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Log Loss Medio</span>
                        <span className="text-sm font-bold font-mono text-emerald-400">
                          {model.averageLogLoss.toFixed(4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Prob. Esito Reale Media</span>
                        <span className="text-sm font-bold font-mono text-blue-400">
                          {model.averageProbabilityAssignedToActualOutcome.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metriche di Errore Gol */}
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block border-b border-slate-800 pb-1">
                      Errore Medio Gol (MAED - Mean Absolute Expected Deviation)
                    </span>
                    
                    <div className="grid grid-cols-3 gap-3 text-center sm:text-left">
                      <div>
                        <span className="text-[9px] text-slate-500 block">Gol Casa</span>
                        <span className="text-sm font-bold font-mono text-amber-500">
                          ±{model.averageHomeGoalsError.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Gol Ospiti</span>
                        <span className="text-sm font-bold font-mono text-amber-500">
                          ±{model.averageAwayGoalsError.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Gol Totali</span>
                        <span className="text-sm font-bold font-mono text-rose-500 font-extrabold">
                          ±{model.averageTotalGoalsError.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
                  <span>Modello ID: {model.modelId}</span>
                  <span>Evaluated At: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
