/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import PredictionForm from './components/PredictionForm';
import PredictionResults from './components/PredictionResults';
import HistoryList from './components/HistoryList';
import ModelComparison from './components/ModelComparison';
import Settings from './components/Settings';
import { PerformanceDashboard } from './components/PerformanceDashboard';

import { ModelInput, PredictionResult, SavedPrediction, ActualMatchResult, MODEL_VERSION } from './types';
import { getOutcome, evaluatePrediction } from './performance/PerformanceEngine';
import { migrateSavedPrediction } from './poissonEngine';
import { getModelById } from './modelRegistry';
import { FootballDataEngine } from './data/FootballDataEngine';
import { Sparkles, Calculator, ChevronLeft, ShieldAlert, CheckCircle } from 'lucide-react';

export default function App() {
  const [section, setSection] = useState<string>('dashboard');
  const [history, setHistory] = useState<SavedPrediction[]>([]);
  
  // Stati per la nuova previsione attiva
  const [activeInput, setActiveInput] = useState<ModelInput | undefined>(undefined);
  const [activeResult, setActiveResult] = useState<PredictionResult | null>(null);
  const [activeModelId, setActiveModelId] = useState<string>('poisson-standard');
  const [predictionView, setPredictionView] = useState<'form' | 'results'>('form');
  const [activePredictionId, setActivePredictionId] = useState<string | null>(null);

  // Stato per notifica toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Caricamento storico iniziale da localStorage
  useEffect(() => {
    const cachedHistory = localStorage.getItem('football_lab_history');
    if (cachedHistory) {
      try {
        const parsed = JSON.parse(cachedHistory);
        if (Array.isArray(parsed)) {
          const migrated = parsed.map(pred => {
            try {
              return migrateSavedPrediction(pred);
            } catch (e) {
              console.error('Errore di migrazione di un record', e);
              return null;
            }
          }).filter((item): item is SavedPrediction => item !== null);
          setHistory(migrated);
        }
      } catch (e) {
        console.error('Errore nel caricamento dello storico', e);
      }
    }
  }, []);

  // Mostra una notifica temporanea toast
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Calcolo ed salvataggio della previsione
  const handleCalculate = (input: ModelInput, modelId: string = 'poisson-standard') => {
    try {
      const model = getModelById(modelId);
      const engine = new FootballDataEngine();
      engine.loadManualInput(input);
      
      const validation = engine.validate();
      if (!validation.isValid) {
        const firstErrorKey = Object.keys(validation.errors)[0];
        const errorMessage = validation.errors[firstErrorKey];
        showToast(errorMessage || 'Dati di input non validi', 'error');
        return;
      }

      const features = engine.getFeatures();
      if (!features) {
        throw new Error('Errore nel caricamento delle feature dal Football Data Engine');
      }
      const result = model.calculate(features);
      setActiveInput(input);
      setActiveResult(result);
      setActiveModelId(modelId);
      setPredictionView('results');

      // Crea un record per lo storico
      const newSaved: SavedPrediction = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9),
        dateTime: new Date().toISOString(),
        input,
        result
      };

      const updatedHistory = [newSaved, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('football_lab_history', JSON.stringify(updatedHistory));
      setActivePredictionId(newSaved.id);

      showToast(`Previsione calcolata con ${model.name}!`);
    } catch (err) {
      console.error(err);
      showToast('Errore durante il calcolo della previsione', 'error');
    }
  };

  // Eliminazione di una singola previsione
  const handleDeletePrediction = (id: string) => {
    setHistory(previousHistory => {
      const updatedHistory = previousHistory.filter(item => item.id !== id);
      localStorage.setItem('football_lab_history', JSON.stringify(updatedHistory));
      return updatedHistory;
    });

    if (activePredictionId === id) {
      setActiveResult(null);
      setActiveInput(undefined);
      setPredictionView('form');
      setActivePredictionId(null);
    }

    showToast('Pronostico eliminato con successo.');
  };

  // Pulizia totale storico
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('football_lab_history');
    
    // Chiudi eventuali pronostici attualmente aperti
    setActiveResult(null);
    setActiveInput(undefined);
    setPredictionView('form');
    setActivePredictionId(null);

    showToast('Tutti i pronostici sono stati eliminati.');
  };

  // Salva un risultato reale ed effettua la valutazione delle prestazioni del modello
  const handleSaveResult = (id: string, homeGoals: number, awayGoals: number) => {
    setHistory(previousHistory => {
      const updatedHistory = previousHistory.map(pred => {
        if (pred.id === id) {
          const actualResult: ActualMatchResult = {
            homeGoals,
            awayGoals,
            outcome: getOutcome(homeGoals, awayGoals),
            recordedAt: new Date().toISOString()
          };
          const evaluation = evaluatePrediction(pred, actualResult);
          return {
            ...pred,
            actualResult,
            evaluation
          };
        }
        return pred;
      });
      localStorage.setItem('football_lab_history', JSON.stringify(updatedHistory));
      return updatedHistory;
    });
    showToast('Risultato registrato e modello valutato.');
  };

  // Rimuove un risultato reale e la valutazione associata
  const handleRemoveResult = (id: string) => {
    setHistory(previousHistory => {
      const updatedHistory = previousHistory.map(pred => {
        if (pred.id === id) {
          const { actualResult, evaluation, ...rest } = pred;
          return rest;
        }
        return pred;
      });
      localStorage.setItem('football_lab_history', JSON.stringify(updatedHistory));
      return updatedHistory;
    });
    showToast('Risultato rimosso.');
  };

  // Importazione dati JSON esterni
  const handleImportHistory = (imported: any[]): boolean => {
    if (!Array.isArray(imported)) return false;

    try {
      const migrated = imported.map((item) => {
        try {
          return migrateSavedPrediction(item);
        } catch (e) {
          console.error('Errore nella migrazione dell’importazione', e);
          return null;
        }
      }).filter((item): item is SavedPrediction => item !== null);

      if (migrated.length === 0) return false;

      const merged = [...migrated, ...history];
      // Rimuoviamo duplicati ID
      const uniqueMap = new Map();
      merged.forEach((item) => uniqueMap.set(item.id, item));
      const uniqueList = Array.from(uniqueMap.values());
      
      // Ordina per data decrescente
      uniqueList.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

      setHistory(uniqueList);
      localStorage.setItem('football_lab_history', JSON.stringify(uniqueList));
      showToast('Importazione completata con successo!');
      return true;
    } catch (err) {
      console.error('Errore generico durante importazione', err);
      return false;
    }
  };

  // Apertura di una previsione salvata dallo storico o dalla dashboard
  const handleOpenSaved = (saved: SavedPrediction) => {
    try {
      const migrated = migrateSavedPrediction(saved);
      setActiveInput(migrated.input);
      setActiveResult(migrated.result);
      setActiveModelId(migrated.result.modelId || 'poisson-standard');
      setActivePredictionId(migrated.id);
      setPredictionView('results');
      setSection('prediction');
      showToast(`Caricato studio: ${migrated.input.homeTeam} vs ${migrated.input.awayTeam}`);
    } catch (e) {
      console.error('Errore durante caricamento record', e);
      showToast('Impossibile aprire il record: dati non validi', 'error');
    }
  };

  // Precompila con dati Demo (andando alla scheda Previsione, lasciandola in modalità form)
  const handleRunDemoPrecompilato = () => {
    const demoInput: ModelInput = {
      homeTeam: 'Milan',
      awayTeam: 'Napoli',
      homeScoredAvg: 1.85,
      homeConcededAvg: 1.10,
      awayScoredAvg: 1.50,
      awayConcededAvg: 1.20,
      leagueHomeScoredAvg: 1.40,
      leagueAwayScoredAvg: 1.10,
      matchesPlayed: 12,
      homeAdvantage: 0
    };
    setActiveInput(demoInput);
    setActiveResult(null); // non calcoliamo automaticamente!
    setPredictionView('form');
    setSection('prediction');
    showToast('Dati demo caricati! Premi "Calcola previsione" per procedere.');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col md:flex-row font-sans selection:bg-emerald-500 selection:text-slate-950 pb-20 md:pb-0">
      
      {/* Barra di Navigazione Responsiva */}
      <Navigation currentSection={section} setSection={setSection} />

      {/* Area Principale del Contenuto */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Intestazione Mobile-Only */}
        <div className="md:hidden flex items-center justify-between border-b border-slate-700/60 pb-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <ShieldAlert className="w-5 h-5 shrink-0" />
            </div>
            <h1 className="font-sans font-bold text-base tracking-tight text-white">
              FP Lab
            </h1>
          </div>
          <span className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
            Poisson v{MODEL_VERSION}
          </span>
        </div>

        {/* Render delle sezioni */}
        {section === 'dashboard' && (
          <Dashboard
            predictions={history}
            onNavigate={setSection}
            onOpenPrediction={handleOpenSaved}
            onRunDemo={handleRunDemoPrecompilato}
          />
        )}

        {section === 'prediction' && (
          <div className="space-y-6">
            <div className="border-b border-slate-700 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold font-sans text-white">Nuova Previsione</h2>
                <p className="text-slate-400 mt-1 text-sm">
                  Compila i dati statistici storici dei due club e avvia il calcolatore di Poisson.
                </p>
              </div>

              {predictionView === 'results' && (
                <button
                  onClick={() => setPredictionView('form')}
                  className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-lg border border-slate-700/60 flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Modifica Dati Input
                </button>
              )}
            </div>

            {predictionView === 'form' ? (
              <PredictionForm
                onCalculate={handleCalculate}
                initialInput={activeInput}
                initialModelId={activeModelId}
              />
            ) : (
              activeInput && activeResult && (
                <PredictionResults
                  input={activeInput}
                  result={activeResult}
                />
              )
            )}
          </div>
        )}

        {section === 'history' && (
          <HistoryList
            predictions={history}
            onDelete={handleDeletePrediction}
            onOpen={handleOpenSaved}
            onClearAll={handleClearHistory}
            onSaveResult={handleSaveResult}
            onRemoveResult={handleRemoveResult}
          />
        )}

        {section === 'performance' && (
          <PerformanceDashboard predictions={history} />
        )}

        {section === 'models' && <ModelComparison />}

        {section === 'settings' && (
          <Settings
            onClearHistory={handleClearHistory}
            onImportHistory={handleImportHistory}
            historyCount={history.length}
          />
        )}

      </main>

      {/* Sistema Toast Notifiche */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 backdrop-blur-md ${
            toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : toast.type === 'info'
              ? 'bg-slate-800/90 border-slate-700 text-slate-200'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {toast.type === 'error' ? (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-xs font-semibold tracking-wide font-sans">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
