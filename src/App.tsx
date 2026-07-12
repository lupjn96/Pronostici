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

import { ModelInput, PredictionResult, SavedPrediction } from './types';
import { poissonModel } from './poissonEngine';
import { Sparkles, Calculator, ChevronLeft, ShieldAlert, CheckCircle } from 'lucide-react';

export default function App() {
  const [section, setSection] = useState<string>('dashboard');
  const [history, setHistory] = useState<SavedPrediction[]>([]);
  
  // Stati per la nuova previsione attiva
  const [activeInput, setActiveInput] = useState<ModelInput | undefined>(undefined);
  const [activeResult, setActiveResult] = useState<PredictionResult | null>(null);
  const [predictionView, setPredictionView] = useState<'form' | 'results'>('form');

  // Stato per notifica toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Caricamento storico iniziale da localStorage
  useEffect(() => {
    const cachedHistory = localStorage.getItem('football_lab_history');
    if (cachedHistory) {
      try {
        setHistory(JSON.parse(cachedHistory));
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
  const handleCalculate = (input: ModelInput) => {
    try {
      const result = poissonModel.calculate(input);
      setActiveInput(input);
      setActiveResult(result);
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

      showToast('Previsione calcolata e salvata nello storico!');
    } catch (err) {
      console.error(err);
      showToast('Errore durante il calcolo della previsione', 'error');
    }
  };

  // Eliminazione di una singola previsione
  const handleDeletePrediction = (id: string) => {
    const updatedHistory = history.filter((p) => p.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('football_lab_history', JSON.stringify(updatedHistory));
    showToast('Studio eliminato con successo!');
  };

  // Pulizia totale storico
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('football_lab_history');
    showToast('Tutto lo storico è stato cancellato definitivamente!');
  };

  // Importazione dati JSON esterni
  const handleImportHistory = (imported: SavedPrediction[]): boolean => {
    // Validazione base della struttura dati
    const isValid = imported.every((item) => {
      return (
        item.id &&
        item.dateTime &&
        item.input?.homeTeam &&
        item.input?.awayTeam &&
        item.result?.probHomeWin !== undefined
      );
    });

    if (isValid) {
      const merged = [...imported, ...history];
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
    }
    return false;
  };

  // Apertura di una previsione salvata dallo storico o dalla dashboard
  const handleOpenSaved = (saved: SavedPrediction) => {
    setActiveInput(saved.input);
    setActiveResult(saved.result);
    setPredictionView('results');
    setSection('prediction');
    showToast(`Caricato studio: ${saved.input.homeTeam} vs ${saved.input.awayTeam}`);
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
      homeAdvantage: 12
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
            Poisson v1.0
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
          />
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
