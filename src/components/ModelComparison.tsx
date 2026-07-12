/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, CircleDot, HelpCircle, Code, Cpu, Layers, BrainCircuit, Activity } from 'lucide-react';

export default function ModelComparison() {
  const models = [
    {
      id: 'poisson',
      name: 'Poisson Standard v1.1.0',
      description: 'Stima i gol attesi basandosi sulle medie storiche separate di attacco e difesa casa/trasferta. Include diagnostiche avanzate della massa di probabilità della griglia.',
      status: 'attivo',
      type: 'Statistico Lineare',
      complexity: 'Bassa',
      strength: 'Semplice, richiede pochi parametri, eccellente per campionati stabili.',
      icon: CircleDot,
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'poisson_gamma',
      name: 'Poisson-Gamma Empirico v0.1.0',
      description: 'Modello Poisson-Gamma che rappresenta lambda come parametro incerto. La varianza iniziale è stimata empiricamente in funzione del numero di partite disponibili.',
      status: 'attivo',
      type: 'Miscela Poisson-Gamma',
      complexity: 'Alta',
      strength: 'Rappresenta l’incertezza dovuta alla quantità limitata di dati e produce una distribuzione predittiva più dispersa rispetto al Poisson standard.',
      icon: Code,
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'dixon_coles',
      name: 'Dixon-Coles',
      description: 'Migliora Poisson inserendo un fattore di dipendenza per i punteggi bassi (0-0, 1-0, 0-1, 1-1) e il fattore di decadimento temporale del peso delle partite.',
      status: 'in_arrivo',
      type: 'Statistico Avanzato',
      complexity: 'Media',
      strength: 'Risolve la sottostima dei pareggi e penalizza le partite troppo vecchie.',
      icon: Layers,
      color: 'border-slate-700/50 bg-slate-900/50 text-slate-400',
    },
    {
      id: 'elo',
      name: 'Modello ELO Dinamico',
      description: 'Assegna un punteggio di forza a ciascun team che si aggiorna dopo ogni partita in base al risultato effettivo e alla forza dell’avversario.',
      status: 'in_arrivo',
      type: 'Rating Dinamico',
      complexity: 'Bassa',
      strength: 'Riflette istantaneamente lo stato di forma corrente senza necessità di medie gol.',
      icon: Activity,
      color: 'border-slate-700/50 bg-slate-900/50 text-slate-400',
    },
    {
      id: 'monte_carlo',
      name: 'Simulatore Monte Carlo',
      description: 'Esegue migliaia di simulazioni di micro-eventi della partita (tiri, possesso, cartellini) per generare una distribuzione empirica dei gol.',
      status: 'in_arrivo',
      type: 'Simulativo',
      complexity: 'Molto Alta',
      strength: 'Perfetto per simulare coppe, turni a eliminazione diretta e mercati live complessi.',
      icon: HelpCircle,
      color: 'border-slate-700/50 bg-slate-900/50 text-slate-400',
    },
    {
      id: 'xgboost',
      name: 'XGBoost Regressor',
      description: 'Modello ad alberi decisionali potenziati dal gradiente che impara relazioni non lineari complesse (es: meteo, assenze, stanchezza, trend quote).',
      status: 'in_arrivo',
      type: 'Machine Learning',
      complexity: 'Alta',
      strength: 'Massima accuratezza predittiva quando sono disponibili centinaia di feature diverse.',
      icon: Cpu,
      color: 'border-slate-700/50 bg-slate-900/50 text-slate-400',
    },
    {
      id: 'random_forest',
      name: 'Random Forest Classifier',
      description: 'Insieme di alberi decisionali indipendenti che votano il risultato 1X2 basandosi sulle caratteristiche storiche dei match.',
      status: 'in_arrivo',
      type: 'Machine Learning',
      complexity: 'Media',
      strength: 'Estremamente robusto contro l’overfitting e facile da interpretare visivamente.',
      icon: Layers,
      color: 'border-slate-700/50 bg-slate-900/50 text-slate-400',
    },
    {
      id: 'neural_network',
      name: 'Rete Neurale Artificiale (ANN)',
      description: 'Rete profonda con strati densi per catturare interazioni ad altissima dimensionalità tra i dati dei giocatori e dei club.',
      status: 'in_arrivo',
      type: 'Deep Learning',
      complexity: 'Molto Alta',
      strength: 'Capacità teorica di approssimare qualsiasi funzione di probabilità calcistica.',
      icon: BrainCircuit,
      color: 'border-slate-700/50 bg-slate-900/50 text-slate-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-700 pb-5">
        <h2 className="text-2xl font-bold font-sans text-white">Confronto Modelli</h2>
        <p className="text-slate-400 mt-1 text-sm">
          Tutti i modelli implementano l’interfaccia TypeScript standard{' '}
          <code className="text-emerald-400 font-mono text-xs bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
            PredictionModel
          </code>{' '}
          per una scalabilità futura immediata.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {models.map((model) => {
          const Icon = model.icon;
          const isActive = model.status === 'attivo';
          return (
            <div
              key={model.id}
              className={`p-6 rounded-2xl border transition-all ${
                isActive
                  ? 'border-emerald-500/40 bg-slate-800/20 shadow-lg shadow-emerald-500/5'
                  : 'border-slate-700/50 bg-slate-800/10 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded border ${model.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base flex items-center gap-2">
                      {model.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wider bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700/40">
                        {model.type}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider bg-slate-900/80 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700/40">
                        Complessità: {model.complexity}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  {isActive ? (
                    <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-semibold tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ATTIVO
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-slate-800/50 text-slate-500 font-mono text-[11px] font-semibold tracking-wider px-2.5 py-1 rounded-full border border-slate-700/30">
                      IN ARRIVO
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-4 text-slate-300 text-sm leading-relaxed">
                {model.description}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col gap-2">
                <div className="flex items-start gap-2 text-xs">
                  <span className="font-semibold text-slate-400 shrink-0">Punto di forza:</span>
                  <span className="text-slate-300">{model.strength}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/20">
        <h4 className="font-sans font-semibold text-white mb-2 text-sm">
          Architettura Estensibile (PredictionModel Interface)
        </h4>
        <pre className="font-mono text-xs text-slate-400 bg-slate-900/80 p-4 rounded-lg overflow-x-auto border border-slate-700/50 leading-relaxed">
{`interface PredictionModel {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  calculate(input: ModelInput): PredictionResult;
}`}
        </pre>
      </div>
    </div>
  );
}
