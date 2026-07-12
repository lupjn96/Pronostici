/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ShieldAlert, TrendingUp, HelpCircle, ArrowRight, Info, Check } from 'lucide-react';
import { ModelInput, PredictionResult } from '../types';

interface PredictionResultsProps {
  input: ModelInput;
  result: PredictionResult;
}

export default function PredictionResults({ input, result }: PredictionResultsProps) {
  const [selectedCell, setSelectedCell] = useState<{ h: number; a: number; prob: number } | null>(null);

  // Helper per formattare con la virgola italiana
  const fmt = (val: number, decimals: number = 2) => {
    if (isNaN(val)) return '0,00';
    return val.toFixed(decimals).replace('.', ',');
  };

  const topScore = result.exactScores[0];
  const classificationText = result.uncertainty.classification.toLowerCase();

  // Trova il massimo valore nella matrice per calcolare l'opacità dell'heatmap
  const maxProb = Math.max(...result.scoreMatrix.flat(), 0.01);

  return (
    <div className="space-y-6">
      {/* Intestazione Match e xG */}
      <div className="p-6 rounded-2xl bg-slate-800/20 border border-slate-700/50 flex flex-col gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex justify-between items-start">
          <div className="space-y-1 w-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">
                Analisi di Poisson ({input.matchesPlayed} match analizzati)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PROCESSED
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div className="text-left flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white truncate">{input.homeTeam}</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">CASA</span>
              </div>
              
              <div className="text-center font-sans font-black text-slate-600 text-lg px-2.5 py-1 bg-slate-900 rounded border border-slate-800">
                VS
              </div>

              <div className="text-right flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white truncate">{input.awayTeam}</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase">OSPITE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Display dei Gol Attesi (xG) */}
        <div className="grid grid-cols-2 gap-4 border-t border-slate-700/50 pt-4">
          <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Gol Attesi Casa (xG)
            </span>
            <span className="text-3xl font-black font-mono text-emerald-400">
              {fmt(result.homeExpectedGoals)}
            </span>
            {input.homeAdvantage !== 0 && (
              <span className="block text-[9px] text-slate-500 font-mono mt-1">
                (Inc. vantaggio casa {input.homeAdvantage > 0 ? '+' : ''}{input.homeAdvantage}%)
              </span>
            )}
          </div>

          <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Gol Attesi Ospite (xG)
            </span>
            <span className="text-3xl font-black font-mono text-emerald-400">
              {fmt(result.awayExpectedGoals)}
            </span>
          </div>
        </div>
      </div>

      {/* Probabilità 1-X-2 */}
      <div className="bg-slate-800/20 border border-slate-700/50 rounded-2xl p-6 flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h4 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Probabilità 1-X-2</h4>
            
            <div className="flex items-center gap-12 mt-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{fmt(result.probHomeWin)}%</div>
                <div className="text-[10px] uppercase text-emerald-400 font-bold">Casa (1)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{fmt(result.probDraw)}%</div>
                <div className="text-[10px] uppercase text-slate-400 font-bold">Pareggio (X)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{fmt(result.probAwayWin)}%</div>
                <div className="text-[10px] uppercase text-rose-400 font-bold">Ospite (2)</div>
              </div>
            </div>
          </div>

          <div className="text-right bg-slate-900/80 p-3 rounded-lg border border-slate-700">
            <p className="text-[10px] text-slate-500 uppercase">Gol Attesi (xG)</p>
            <p className="text-xl font-mono text-white">{fmt(result.homeExpectedGoals)} — {fmt(result.awayExpectedGoals)}</p>
          </div>
        </div>

        {/* Triple horizontal bar */}
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
          <div
            style={{ width: `${result.probHomeWin}%` }}
            className="bg-emerald-400 transition-all duration-500 h-full"
            title={`Vittoria Casa: ${fmt(result.probHomeWin)}%`}
          />
          <div
            style={{ width: `${result.probDraw}%` }}
            className="bg-slate-400 transition-all duration-500 h-full"
            title={`Pareggio: ${fmt(result.probDraw)}%`}
          />
          <div
            style={{ width: `${result.probAwayWin}%` }}
            className="bg-rose-400 transition-all duration-500 h-full"
            title={`Vittoria Ospite: ${fmt(result.probAwayWin)}%`}
          />
        </div>
      </div>

      {/* Mercati Alternativi */}
      <div className="bg-slate-800/20 border border-slate-700/50 rounded-2xl p-6">
        <h4 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-4">Mercati Alternativi</h4>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'UNDER 2.5', value: result.under25, color: 'text-amber-400' },
            { label: 'OVER 1.5', value: result.over15, color: 'text-emerald-400' },
            { label: 'OVER 2.5', value: result.over25, color: 'text-emerald-400' },
            { label: 'OVER 3.5', value: result.over35, color: 'text-emerald-400' },
            { label: 'GOAL (GG)', value: result.goal, color: 'text-emerald-400' },
            { label: 'NO GOAL (NG)', value: result.noGoal, color: 'text-amber-400' },
          ].map((market) => (
            <div key={market.label} className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-700/50 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                {market.label}
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-base font-bold font-mono text-white">
                  {fmt(market.value)}%
                </span>
                <span className={`text-[10px] font-bold font-mono ${market.color}`}>
                  {(market.value > 50) ? 'PROBABILE' : 'MENO PROB.'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 Risultati Esatti */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-5 shadow-xl">
          <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-4 tracking-wider">Risultati Esatti Top 5</h4>
          <div className="space-y-2">
            {result.exactScores.slice(0, 5).map((item, index) => {
              const barColor = index === 0 ? 'bg-emerald-400' : index === 1 ? 'bg-emerald-500' : index === 2 ? 'bg-emerald-600' : 'bg-emerald-700';
              return (
                <div key={item.score} className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded border border-slate-800/40">
                  <span className="text-sm font-mono font-bold text-white w-10">{item.score}</span>
                  <div className="flex-1 mx-4 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${(item.probability / topScore.probability) * 100}%` }}></div>
                  </div>
                  <span className="text-xs font-mono text-slate-300 w-12 text-right">{fmt(item.probability)}%</span>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl mt-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">Sintesi Risultato</p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                result.uncertainty.classification === 'Bassa Incertezza'
                  ? 'bg-emerald-400 text-emerald-950'
                  : result.uncertainty.classification === 'Incertezza Moderata'
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-rose-400 text-rose-950'
              }`}>
                {result.uncertainty.classification}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              “Il risultato più probabile è <span className="font-bold text-white">{topScore.score}</span> con probabilità <span className="font-bold text-white">{fmt(topScore.probability)}%</span>, ma la distribuzione complessiva resta <span className="text-emerald-400 font-bold">{classificationText}</span>.”
            </p>
          </div>
        </div>

        {/* Incertezza & Solidità */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-4 tracking-wider">Incertezza & Solidità</h4>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span>Qualità dei Dati (basata sulle partite)</span>
                  <span className="font-mono text-white font-bold">{fmt(result.uncertainty.dataQuality, 0)}/100</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    style={{ width: `${result.uncertainty.dataQuality}%` }}
                    className="h-full bg-blue-500 rounded-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span>Entropia degli esiti 1-X-2</span>
                  <span className="font-mono text-white font-bold">{fmt(result.uncertainty.uncertaintyIndex, 1)}/100</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    style={{ width: `${result.uncertainty.uncertaintyIndex}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-normal mt-1">
                  Misura quanto le probabilità sono distribuite tra vittoria casa, pareggio e vittoria ospite. Non include ancora l’incertezza sui parametri del modello.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                Indice preliminare di solidità
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                {fmt(result.uncertainty.solidityIndex ?? (result.uncertainty as any).reliability ?? 0, 0)}%
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal mb-1">
              Indicatore euristico basato sulla quantità dei dati e sulla concentrazione della previsione. Non rappresenta ancora una validazione statistica del modello.
            </p>
            <p className="text-[9px] text-slate-500 leading-normal font-mono">
              Basato su {input.matchesPlayed} partite analizzate. Entropia normalizzata: {fmt(result.uncertainty.entropy, 2)}.
            </p>
          </div>
        </div>
      </div>

      {/* Sezione Incertezza dei parametri (Epistemica) - Solo per Poisson-Gamma Empirico */}
      {result.modelId === 'poisson-gamma' && result.parameterUncertainty && (
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-700 pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Incertezza dei Parametri & Analisi Epistemica</h4>
              <p className="text-xs text-slate-400 mt-1">
                Il modello tratta i gol attesi come parametri incerti. L’indice epistemico misura quanto la stima di lambda dipende dalla quantità limitata di dati.
              </p>
            </div>
            {result.totalUncertaintyIndex !== undefined && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-right">
                <span className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider">Incertezza Totale</span>
                <span className="text-xl font-black font-mono text-emerald-400">{fmt(result.totalUncertaintyIndex, 1)}%</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Squadra Casa */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block border-b border-slate-800 pb-1.5">
                {input.homeTeam} (Casa)
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Media λ (Mean)</span>
                  <span className="font-mono font-bold text-white">{fmt(result.parameterUncertainty.homeLambdaMean, 3)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Dev. Standard λ</span>
                  <span className="font-mono font-bold text-emerald-400">± {fmt(result.parameterUncertainty.homeLambdaStdDev, 3)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Gamma Shape (α)</span>
                  <span className="font-mono text-slate-300">{fmt(result.parameterUncertainty.homeShape, 2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Gamma Rate (β)</span>
                  <span className="font-mono text-slate-300">{fmt(result.parameterUncertainty.homeRate, 2)}</span>
                </div>
              </div>
            </div>

            {/* Squadra Ospite */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block border-b border-slate-800 pb-1.5">
                {input.awayTeam} (Ospite)
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Media λ (Mean)</span>
                  <span className="font-mono font-bold text-white">{fmt(result.parameterUncertainty.awayLambdaMean, 3)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Dev. Standard λ</span>
                  <span className="font-mono font-bold text-emerald-400">± {fmt(result.parameterUncertainty.awayLambdaStdDev, 3)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Gamma Shape (α)</span>
                  <span className="font-mono text-slate-300">{fmt(result.parameterUncertainty.awayShape, 2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Gamma Rate (β)</span>
                  <span className="font-mono text-slate-300">{fmt(result.parameterUncertainty.awayRate, 2)}</span>
                </div>
              </div>
            </div>

            {/* Indice Epistemico */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block border-b border-slate-800 pb-1.5">
                  Incertezza Epistemica
                </span>
                <p className="text-[10px] text-slate-400 leading-normal mt-2">
                  La deviazione standard rispetto alla media indica l'incertezza residua sulla stima del parametro λ.
                </p>
              </div>
              <div className="bg-slate-900 p-3 rounded border border-slate-800/80 flex items-center justify-between mt-3">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Indice Epistemico</span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {fmt(result.parameterUncertainty.epistemicIndex, 1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-slate-300 space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-[10px]">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Nota scientifica</span>
            </div>
            <div className="space-y-2 leading-relaxed text-slate-300">
              <p>Questa versione implementa un modello Poisson-Gamma empirico.</p>
              <p>L'incertezza di λ viene stimata utilizzando il numero di partite disponibili.</p>
              <p>Non viene ancora effettuato un vero aggiornamento bayesiano della distribuzione a posteriori basato sui gol osservati.</p>
              <p>Questa implementazione rappresenta il primo passo verso il futuro modello Poisson-Gamma Bayesiano completo.</p>
            </div>
          </div>
        </div>
      )}

      {/* Matrice dei Risultati Esatti (Heatmap 7x7) */}
      <div className="p-5 rounded-xl border border-slate-700 bg-slate-800/40">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-400" /> Matrice Risultati Esatti (Heatmap)
          </h4>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            Tocca una cella per i dettagli
          </span>
        </div>

        {/* Matrice */}
        <div className="overflow-x-auto">
          <div className="min-w-[340px] select-none">
            {/* Riga Header: Gol Ospite */}
            <div className="grid grid-cols-8 gap-1 mb-1 text-center font-mono text-[10px] text-slate-500">
              <div className="text-slate-600 font-bold flex items-center justify-center">C \ O</div>
              {[0, 1, 2, 3, 4, 5, 6].map((a) => (
                <div key={a} className="font-bold py-1 bg-slate-900 rounded border border-slate-800">
                  {a}
                </div>
              ))}
            </div>

            {/* Righe Matrice */}
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <div key={h} className="grid grid-cols-8 gap-1 mb-1">
                {/* Colonna Header: Gol Casa */}
                <div className="font-mono text-[10px] text-slate-500 bg-slate-900 rounded flex items-center justify-center font-bold border border-slate-800">
                  {h}
                </div>

                {/* Celle */}
                {[0, 1, 2, 3, 4, 5, 6].map((a) => {
                  const prob = result.scoreMatrix[h][a];
                  const intensity = prob / maxProb;
                  return (
                    <button
                      key={`${h}-${a}`}
                      onClick={() => setSelectedCell({ h, a, prob })}
                      style={{
                        backgroundColor: `rgba(16, 185, 129, ${0.05 + intensity * 0.7})`,
                      }}
                      className={`h-9 rounded flex flex-col items-center justify-center border transition-all text-[10px] font-mono cursor-pointer ${
                        selectedCell?.h === h && selectedCell?.a === a
                          ? 'border-white ring-2 ring-emerald-400/50 scale-105 z-10'
                          : 'border-slate-800/10 hover:border-slate-600'
                      }`}
                      title={`${h}-${a}: ${fmt(prob)}%`}
                    >
                      <span className="font-bold text-white text-[9px]">{h}-{a}</span>
                      <span className="text-slate-200 text-[8px] opacity-80">{fmt(prob, 1)}%</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Visualizzazione Cella Selezionata */}
        {selectedCell && (
          <div className="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-500 mr-2">Esito selezionato:</span>
              <strong className="text-white text-sm mr-2">{selectedCell.h} - {selectedCell.a}</strong>
              <span className="text-slate-400">({selectedCell.h > selectedCell.a ? 'Vittoria Casa' : selectedCell.h === selectedCell.a ? 'Pareggio' : 'Vittoria Ospite'})</span>
            </div>
            <div className="text-emerald-400 font-bold text-sm">
              {fmt(selectedCell.prob)}%
            </div>
          </div>
        )}
      </div>

      {/* Informazioni modello */}
      <div className="p-5 rounded-2xl border border-slate-700 bg-slate-800/20 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400" /> Informazioni Modello e Diagnostica
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/60">
            <span className="block text-[9px] text-slate-500 uppercase font-mono mb-1">Nome Modello</span>
            <span className="text-xs font-bold text-white block truncate">{result.modelName || 'Poisson standard'}</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/60">
            <span className="block text-[9px] text-slate-500 uppercase font-mono mb-1">Versione</span>
            <span className="text-xs font-mono font-bold text-emerald-400 block">{result.modelVersion || '1.0.0'}</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/60">
            <span className="block text-[9px] text-slate-500 uppercase font-mono mb-1">Limite Calcolo</span>
            <span className="text-xs font-mono font-bold text-white block">{result.calculationDiagnostics?.calculationLimit ?? 12} gol</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/60">
            <span className="block text-[9px] text-slate-500 uppercase font-mono mb-1">Massa Coperta</span>
            <span className="text-xs font-mono font-bold text-emerald-400 block">
              {result.calculationDiagnostics ? (result.calculationDiagnostics.gridProbabilityMass * 100).toFixed(6) : '99,999999'}%
            </span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 col-span-2 md:col-span-1">
            <span className="block text-[9px] text-slate-500 uppercase font-mono mb-1">Massa Residua</span>
            <span className="text-xs font-mono font-bold text-amber-500 block">
              {result.calculationDiagnostics ? (result.calculationDiagnostics.residualProbabilityMass * 100).toFixed(6) : '0,000000'}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
