import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Calendar,
  Layers,
  Database,
  BarChart2,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle,
  HelpCircle,
  XCircle
} from 'lucide-react';
import { availableModels } from '../modelRegistry';
import { getAllMatches } from '../dataCollector/HistoricalMatchRepository';
import { HistoricalMatch } from '../dataCollector/HistoricalMatchTypes';
import { BacktestOptions, BacktestRun, BacktestMatchResult } from '../backtesting/BacktestTypes';
import {
  saveBacktestRun,
  getBacktestRuns,
  getBacktestRunById,
  getBacktestResultsPage,
  countBacktestResults,
  deleteBacktestRun
} from '../backtesting/BacktestRepository';
import { runBacktest, validateBacktestOptions } from '../backtesting/BacktestEngine';
import { aggregateBacktestResults, rankBacktestModels } from '../backtesting/BacktestAggregator';

export default function BacktestingDashboard() {
  // Form state
  const [runName, setRunName] = useState('');
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(['poisson-standard']);
  const [minimumMatches, setMinimumMatches] = useState<number>(5);
  const [lastMatches, setLastMatches] = useState<number | undefined>(undefined);
  const [timeDecayEnabled, setTimeDecayEnabled] = useState(false);
  const [timeDecayRate, setTimeDecayRate] = useState<number>(0.005);
  const [batchSize, setBatchSize] = useState<number>(100);
  const [includeInsufficient, setIncludeInsufficient] = useState(true);

  // App UI state
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [allMatches, setAllMatches] = useState<HistoricalMatch[]>([]);
  const [savedRuns, setSavedRuns] = useState<BacktestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);
  
  // Running state
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunMetadata, setActiveRunMetadata] = useState<BacktestRun | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [processedMatches, setProcessedMatches] = useState(0);
  const [evaluatedPredictions, setEvaluatedPredictions] = useState(0);
  const [skippedMatches, setSkippedMatches] = useState(0);
  const [currentDate, setCurrentDate] = useState<string | undefined>(undefined);
  const [currentMatch, setCurrentMatch] = useState<string | undefined>(undefined);
  
  const [isPausedState, setIsPausedState] = useState(false);
  const [isCancelledState, setIsCancelledState] = useState(false);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedRemainingSecs, setEstimatedRemainingSecs] = useState<number | null>(null);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // References to keep callbacks current
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPausedState;
  }, [isPausedState]);

  useEffect(() => {
    isCancelledRef.current = isCancelledState;
  }, [isCancelledState]);

  // Details viewing page state
  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsPageSize] = useState(50); // paginazione max 100, usiamo 50 come default equilibrato
  const [detailsResults, setDetailsResults] = useState<BacktestMatchResult[]>([]);
  const [detailsTotalResults, setDetailsTotalResults] = useState(0);
  const [detailsModelFilter, setDetailsModelFilter] = useState('');
  const [detailsDateFilter, setDetailsDateFilter] = useState('');
  const [detailsTeamFilter, setDetailsTeamFilter] = useState('');

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const matches = await getAllMatches();
        setAllMatches(matches);
        const uniqueComps = Array.from(new Set(matches.map(m => m.competition))).sort();
        setCompetitions(uniqueComps);
        if (uniqueComps.length > 0) {
          setSelectedCompetition(uniqueComps[0]);
        }
        await refreshSavedRuns();
      } catch (err) {
        console.error('Errore durante caricamento iniziale backtest:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    loadData();
  }, []);

  // Timer effect for elapsed run time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeRunId && !isPausedState && !isCancelledState) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeRunId, isPausedState, isCancelledState]);

  const refreshSavedRuns = async () => {
    const runs = await getBacktestRuns();
    setSavedRuns(runs);
  };

  // Pre-calculations for form warning
  const selectedModelsCount = selectedModelIds.length;
  const filteredCandidatesCount = allMatches.filter(m => {
    if (m.competition !== selectedCompetition) return false;
    if (startDate && m.date < startDate) return false;
    if (endDate && m.date > endDate) return false;
    return true;
  }).length;
  const totalEstimations = filteredCandidatesCount * selectedModelsCount;

  const handleModelToggle = (id: string) => {
    if (selectedModelIds.includes(id)) {
      if (selectedModelIds.length > 1) {
        setSelectedModelIds(selectedModelIds.filter(mId => mId !== id));
      }
    } else {
      if (selectedModelIds.length < 5) {
        setSelectedModelIds([...selectedModelIds, id]);
      }
    }
  };

  const handleCreateBacktest = async () => {
    setFormErrors([]);

    const options: BacktestOptions = {
      competition: selectedCompetition,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      modelIds: selectedModelIds,
      minimumMatches,
      lastMatches,
      timeDecayEnabled,
      timeDecayRate,
      batchSize,
      includeInsufficientDataMatches: includeInsufficient
    };

    const errors = validateBacktestOptions(options);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    const runId = `run_${Date.now()}`;
    const newRun: BacktestRun = {
      id: runId,
      name: runName.trim() || `Backtest ${selectedCompetition} - ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      status: 'idle',
      options,
      totalCandidateMatches: filteredCandidatesCount,
      processedMatches: 0,
      evaluatedPredictions: 0,
      skippedMatches: 0,
      lastProcessedMatchIndex: -1
    };

    try {
      await saveBacktestRun(newRun);
      await startBacktestExecution(runId);
    } catch (err: any) {
      setFormErrors([`Impossibile salvare il run di backtest: ${err.message}`]);
    }
  };

  const startBacktestExecution = async (runId: string) => {
    setIsPausedState(false);
    setIsCancelledState(false);
    setActiveRunId(runId);
    setRunStartTime(Date.now());
    setElapsedSeconds(0);
    setEstimatedRemainingSecs(null);
    setProgressPercent(0);
    setProcessedMatches(0);
    setEvaluatedPredictions(0);
    setSkippedMatches(0);
    setCurrentDate(undefined);
    setCurrentMatch(undefined);

    try {
      const resultRun = await runBacktest(runId, {
        isPaused: () => isPausedRef.current,
        isCancelled: () => isCancelledRef.current,
        onProgress: (prog) => {
          setProgressPercent(prog.progressPercent);
          setProcessedMatches(prog.processedMatches);
          setEvaluatedPredictions(prog.evaluatedPredictions);
          setSkippedMatches(prog.skippedMatches);
          setCurrentDate(prog.currentDate);
          setCurrentMatch(prog.currentMatch);

          // Calcolo stima del tempo (Sezione 18)
          if (prog.processedMatches >= 20 && runStartTime) {
            const elapsedMs = Date.now() - runStartTime;
            const avgMs = elapsedMs / prog.processedMatches;
            const remaining = prog.totalCandidateMatches - prog.processedMatches;
            const estRemainingMs = avgMs * remaining;
            setEstimatedRemainingSecs(Math.round(estRemainingMs / 1000));
          }
        },
        onBatchCompleted: async (_, updatedRun) => {
          setActiveRunMetadata(updatedRun);
          await refreshSavedRuns();
        }
      });

      setActiveRunMetadata(resultRun);
      setActiveRunId(null);
      await refreshSavedRuns();
      
      // Apri automaticamente i dettagli del run completato
      const finalRun = await getBacktestRunById(runId);
      if (finalRun) {
        setSelectedRun(finalRun);
        setDetailsPage(1);
        await loadDetailsResults(finalRun.id);
      }
    } catch (err: any) {
      console.error('Errore durante l\'esecuzione del backtest:', err);
      setActiveRunId(null);
      await refreshSavedRuns();
    }
  };

  const handlePause = () => {
    setIsPausedState(true);
  };

  const handleResume = () => {
    setIsPausedState(false);
  };

  const handleCancel = () => {
    setIsCancelledState(true);
  };

  const handleResumeInterruptedRun = async (runId: string) => {
    const run = await getBacktestRunById(runId);
    if (!run) return;
    
    // Ripristiniamo lo stato parziale salvato
    setProcessedMatches(run.processedMatches);
    setEvaluatedPredictions(run.evaluatedPredictions);
    setSkippedMatches(run.skippedMatches);
    setProgressPercent(run.totalCandidateMatches > 0 ? Math.round((run.processedMatches / run.totalCandidateMatches) * 100) : 0);
    
    await startBacktestExecution(runId);
  };

  const handleOpenRun = async (run: BacktestRun) => {
    setSelectedRun(run);
    setDetailsPage(1);
    setDetailsModelFilter('');
    setDetailsDateFilter('');
    setDetailsTeamFilter('');
    await loadDetailsResults(run.id, 1, '', '', '');
  };

  const loadDetailsResults = async (
    runId: string,
    page: number = 1,
    modelId: string = '',
    date: string = '',
    team: string = ''
  ) => {
    const filters = { modelId, date, team };
    const resultsPage = await getBacktestResultsPage(runId, page, detailsPageSize, filters);
    const total = await countBacktestResults(runId, filters);
    
    setDetailsResults(resultsPage);
    setDetailsTotalResults(total);
  };

  const handleFilterChange = async (
    modelId: string,
    date: string,
    team: string
  ) => {
    setDetailsModelFilter(modelId);
    setDetailsDateFilter(date);
    setDetailsTeamFilter(team);
    setDetailsPage(1);
    if (selectedRun) {
      await loadDetailsResults(selectedRun.id, 1, modelId, date, team);
    }
  };

  const handlePageChange = async (newPage: number) => {
    setDetailsPage(newPage);
    if (selectedRun) {
      await loadDetailsResults(selectedRun.id, newPage, detailsModelFilter, detailsDateFilter, detailsTeamFilter);
    }
  };

  const handleDeleteRun = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo run di backtest e tutti i suoi risultati associati?')) {
      await deleteBacktestRun(id);
      if (selectedRun?.id === id) {
        setSelectedRun(null);
      }
      await refreshSavedRuns();
    }
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatEstTime = (secs: number | null) => {
    if (secs === null) return 'Calcolo in corso...';
    if (secs < 60) return `${secs} s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <span className="ml-3 text-slate-400 font-sans">Inizializzazione modulo Backtesting...</span>
      </div>
    );
  }

  // Calcolo statistiche modellarie per classifica (Sezione 15-16)
  let rankedSummaries = selectedRun ? rankBacktestModels(aggregateBacktestResults(detailsResults)) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 font-sans">
      {/* Intestazione */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Chronological Backtesting Engine</h1>
          <p className="text-slate-500 mt-1">Simula pronostici storici rispettando rigorosamente l’ordine temporale.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="h-3 w-3" />
            Nessun Data Leakage Garantito
          </span>
        </div>
      </div>

      {/* Sezione Avviso Statistico Generale (Sezione 22) */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 flex gap-3 text-sm text-amber-900">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Sicurezza Statistica:</strong> Il backtesting valuta la qualità statistica delle previsioni storiche. Non garantisce risultati futuri né profitti nelle scommesse.
        </p>
      </div>

      {/* Monitor di Progresso Attivo (Sezione 10) */}
      {activeRunId && (
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              <h2 className="text-lg font-semibold tracking-wide text-emerald-400">Backtest in corso...</h2>
            </div>
            <div className="flex items-center gap-2">
              {isPausedState ? (
                <button
                  onClick={handleResume}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                >
                  <Play className="h-3.5 w-3.5" /> Riprendi
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                >
                  <Pause className="h-3.5 w-3.5" /> Pausa
                </button>
              )}
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              >
                <XCircle className="h-3.5 w-3.5" /> Annulla
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Progresso globale</span>
              <span className="font-mono text-emerald-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-slate-800/50 p-3 rounded-lg">
              <div className="text-xs text-slate-400">Partite elaborate</div>
              <div className="text-lg font-mono font-bold text-white">{processedMatches}</div>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-lg">
              <div className="text-xs text-slate-400">Risultati valutati</div>
              <div className="text-lg font-mono font-bold text-emerald-400">{evaluatedPredictions}</div>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-lg">
              <div className="text-xs text-slate-400">Partite saltate</div>
              <div className="text-lg font-mono font-bold text-amber-400">{skippedMatches}</div>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-lg">
              <div className="text-xs text-slate-400">Tempo trascorso</div>
              <div className="text-lg font-mono font-bold text-slate-200">{formatSeconds(elapsedSeconds)}</div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Data corrente: <strong className="text-slate-200">{currentDate || 'N/D'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Stima tempo residuo: <strong className="text-slate-200">{formatEstTime(estimatedRemainingSecs)}</strong></span>
            </div>
            {currentMatch && (
              <div className="flex items-center gap-1.5 sm:col-span-2">
                <span>Partita: <strong className="text-slate-200">{currentMatch}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pannello Opzioni di Avvio */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Nuovo Backtest</h2>
          </div>

          {formErrors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 space-y-1">
              {formErrors.map((err, i) => (
                <div key={i} className="flex gap-1">
                  <span className="text-rose-500">•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4 text-sm">
            {/* Nome Run */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Nome del run (opzionale)</label>
              <input
                type="text"
                placeholder="es: Backtest Serie A 2026"
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
              />
            </div>

            {/* Competizione */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 font-bold text-slate-900">Competizione *</label>
              <select
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
              >
                {competitions.length === 0 ? (
                  <option value="">Carica file CSV nello storico prima</option>
                ) : (
                  competitions.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))
                )}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Data iniziale</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Data finale</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition text-xs"
                />
              </div>
            </div>

            {/* Modelli */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Modelli da valutare (max 5)</label>
              <div className="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50">
                {availableModels.map(model => {
                  const checked = selectedModelIds.includes(model.id);
                  return (
                    <label key={model.id} className="flex items-center gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && selectedModelIds.length >= 5}
                        onChange={() => handleModelToggle(model.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
                      />
                      <div>
                        <span className="font-semibold text-xs block text-slate-950">{model.name}</span>
                        <span className="text-[10px] text-slate-500 line-clamp-1">{model.description}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Minimum Matches */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Partite minime per squadra *</label>
              <input
                type="number"
                min="1"
                value={minimumMatches}
                onChange={(e) => setMinimumMatches(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
              />
            </div>

            {/* Last Matches */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Ultime partite da considerare (opzionale)</label>
              <input
                type="number"
                placeholder="Tutte"
                value={lastMatches === undefined ? '' : lastMatches}
                onChange={(e) => setLastMatches(e.target.value === '' ? undefined : parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
              />
            </div>

            {/* Time Decay */}
            <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Decadimento temporale (Time Decay)</span>
                <input
                  type="checkbox"
                  checked={timeDecayEnabled}
                  onChange={(e) => setTimeDecayEnabled(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
                />
              </div>
              {timeDecayEnabled && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="block text-[10px] font-medium text-slate-500">Tasso di decadimento (Rate)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={timeDecayRate}
                    onChange={(e) => setTimeDecayRate(parseFloat(e.target.value) || 0.005)}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Batch size e insufficient values */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">Batch Size (max 500)</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.min(500, Math.max(1, parseInt(e.target.value) || 100)))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-slate-900 bg-slate-50 text-xs"
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeInsufficient}
                    onChange={(e) => setIncludeInsufficient(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
                  />
                  <span className="text-[10px] font-medium text-slate-600">Includi record skipped</span>
                </label>
              </div>
            </div>

            {/* Stima preliminare e warning dimensioni (Sezione 21) */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                <div className="text-slate-500 flex justify-between">
                  <span>Partite candidate:</span>
                  <span className="font-mono text-slate-900 font-semibold">{filteredCandidatesCount}</span>
                </div>
                <div className="text-slate-500 flex justify-between">
                  <span>Modelli attivi:</span>
                  <span className="font-mono text-slate-900 font-semibold">{selectedModelsCount}</span>
                </div>
                <div className="text-slate-900 font-bold flex justify-between border-t border-slate-200 pt-1">
                  <span>Valutazioni totali:</span>
                  <span className="font-mono">{totalEstimations}</span>
                </div>
              </div>

              {totalEstimations > 30000 && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs leading-relaxed flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <p>
                    “Il backtest è molto esteso e potrebbe richiedere diversi minuti su dispositivi mobili.”
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateBacktest}
                disabled={!!activeRunId || competitions.length === 0 || totalEstimations === 0}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition text-xs flex items-center justify-center gap-1.5"
              >
                <Play className="h-4 w-4" />
                Avvia Backtest
              </button>
            </div>
          </div>
        </div>

        {/* Elenco dei Run Salvati (Sezione 17.D) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Database className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Run Salvati</h2>
            </div>

            {savedRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <BarChart2 className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm">Nessun run di backtest eseguito o salvato.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold uppercase">
                      <th className="py-2.5 px-3">Nome / Competizione</th>
                      <th className="py-2.5 px-3">Modelli</th>
                      <th className="py-2.5 px-3">Stato / Partite</th>
                      <th className="py-2.5 px-3">Data Creazione</th>
                      <th className="py-2.5 px-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {savedRuns.map(run => {
                      const isCompleted = run.status === 'completed';
                      const isRunning = run.status === 'running' || run.status === 'paused';
                      const isCancelled = run.status === 'cancelled';
                      const isFailed = run.status === 'failed';
                      
                      return (
                        <tr key={run.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900 text-xs">{run.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{run.options.competition}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono block w-fit">
                              {run.options.modelIds.length} m.
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                isCompleted ? 'bg-emerald-500' :
                                isRunning ? 'bg-amber-500' :
                                isCancelled ? 'bg-slate-400' : 'bg-rose-500'
                              }`}></span>
                              <span className="text-xs uppercase font-semibold tracking-wider text-[10px]">
                                {run.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              {run.processedMatches} / {run.totalCandidateMatches} ({run.evaluatedPredictions} val, {run.skippedMatches} sk)
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500 font-mono">
                            {new Date(run.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 text-right space-x-1.5">
                            <button
                              onClick={() => handleOpenRun(run)}
                              className="inline-flex items-center justify-center p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                              title="Apri Dettagli"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {!isCompleted && !isRunning && (
                              <button
                                onClick={() => handleResumeInterruptedRun(run.id)}
                                className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition"
                                title="Riprendi Run"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteRun(run.id)}
                              disabled={activeRunId === run.id}
                              className="inline-flex items-center justify-center p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition disabled:opacity-50"
                              title="Elimina"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visualizzazione dei Dettagli del Run Selezionato (Sezione 17.E) */}
      {selectedRun && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
            <div>
              <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Risultati Analizzati</div>
              <h2 className="text-xl font-bold text-slate-900">{selectedRun.name}</h2>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Competizione: {selectedRun.options.competition} | Creato: {new Date(selectedRun.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => setSelectedRun(null)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold text-slate-700 transition"
            >
              Chiudi dettagli
            </button>
          </div>

          {/* Classifica Preliminare dei Modelli (Sezione 16) */}
          <div className="space-y-4">
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-4">
              <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2 mb-2">
                <BarChart2 className="h-5 w-5 text-emerald-600" />
                Classifica preliminare del backtest
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                I risultati del backtest dipendono dalla qualità dei dati, dal periodo analizzato e dai parametri selezionati. Non garantiscono profitti futuri.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                    <th className="py-2.5 px-3">Modello / Versione</th>
                    <th className="py-2.5 px-3 text-right">Previsioni</th>
                    <th className="py-2.5 px-3 text-right">Accuratezza 1X2</th>
                    <th className="py-2.5 px-3 text-right">Risultato Esatto</th>
                    <th className="py-2.5 px-3 text-right">Brier Score</th>
                    <th className="py-2.5 px-3 text-right">Log Loss</th>
                    <th className="py-2.5 px-3 text-right">Prob Esito Reale</th>
                    <th className="py-2.5 px-3 text-right">Err. Gol Casa</th>
                    <th className="py-2.5 px-3 text-right">Err. Gol Ospiti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {rankedSummaries.map((summary, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{summary.modelName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">v{summary.modelVersion}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {summary.evaluatedPredictions}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {summary.accuracy1X2.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-700">
                        {summary.exactScoreAccuracy.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-900">
                        {summary.averageBrierScore.toFixed(3)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 font-bold">
                        {summary.averageLogLoss.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {(summary.averageProbabilityAssignedToActualOutcome * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {summary.averageHomeGoalsError.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {summary.averageAwayGoalsError.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risultati partita per partita con Filtri e Paginazione (Sezione 17.E) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Previsioni Singole Dettagliate</h3>
            
            {/* Filtri */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Filtra per Modello</label>
                <select
                  value={detailsModelFilter}
                  onChange={(e) => handleFilterChange(e.target.value, detailsDateFilter, detailsTeamFilter)}
                  className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 bg-slate-50"
                >
                  <option value="">Tutti i modelli</option>
                  {selectedRun.options.modelIds.map(id => {
                    const model = availableModels.find(m => m.id === id);
                    return <option key={id} value={id}>{model?.name || id}</option>;
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Filtra per Squadra</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="es: Inter, Roma..."
                    value={detailsTeamFilter}
                    onChange={(e) => handleFilterChange(detailsModelFilter, detailsDateFilter, e.target.value)}
                    className="w-full text-xs px-2 py-1.5 pl-7 rounded border border-slate-200 bg-slate-50 focus:outline-none"
                  />
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Filtra per Data</label>
                <input
                  type="date"
                  value={detailsDateFilter}
                  onChange={(e) => handleFilterChange(detailsModelFilter, e.target.value, detailsTeamFilter)}
                  className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            {/* Tabella dei Risultati */}
            {detailsResults.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">Nessun risultato corrisponde ai criteri impostati.</div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-semibold uppercase bg-slate-50">
                        <th className="py-2 px-2.5">Data / Squadre</th>
                        <th className="py-2 px-2.5">Modello</th>
                        <th className="py-2 px-2.5 text-center">Risultato Reale</th>
                        <th className="py-2 px-2.5 text-center">Esito Previsto</th>
                        <th className="py-2 px-2.5 text-right">Medie Storiche C/F</th>
                        <th className="py-2 px-2.5 text-right">Attesi Casa/Trasferta</th>
                        <th className="py-2 px-2.5 text-right">Log Loss</th>
                        <th className="py-2 px-2.5 text-right">Brier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                      {detailsResults.map((result) => {
                        const isIncorrect = !result.correct1X2;
                        return (
                          <tr key={result.id} className={`hover:bg-slate-50/50 transition ${result.skipped ? 'opacity-60 bg-amber-50/20' : ''}`}>
                            <td className="py-2 px-2.5">
                              <div className="text-[10px] text-slate-400 font-mono">{result.date}</div>
                              <div className="font-semibold text-slate-900 text-xs">
                                {result.homeTeam} <span className="text-slate-400 font-normal">vs</span> {result.awayTeam}
                              </div>
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="font-medium text-[11px] text-slate-800">{result.modelName}</div>
                              <div className="text-[9px] text-slate-400 font-mono">v{result.modelVersion}</div>
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              {result.skipped ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                  SKIPPED
                                </span>
                              ) : (
                                <div className="font-mono font-bold text-slate-950">
                                  {result.actualHomeGoals} - {result.actualAwayGoals}
                                  <span className="text-[10px] text-slate-400 ml-1 font-normal">({result.actualOutcome})</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              {result.skipped ? (
                                <span className="text-[10px] text-slate-400 block line-clamp-2 max-w-[150px] font-mono leading-tight">
                                  {result.skipReason}
                                </span>
                              ) : (
                                <div>
                                  <span className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                                    isIncorrect ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                  }`}>
                                    {result.predictedOutcome}
                                  </span>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {Math.round(result.probHomeWin)}% - {Math.round(result.probDraw)}% - {Math.round(result.probAwayWin)}%
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono text-[10px] text-slate-500">
                              {result.homeHistoricalMatches} casa / {result.awayHistoricalMatches} trasferta
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                              {result.skipped ? '-' : `${result.homeExpectedGoals.toFixed(2)} vs ${result.awayExpectedGoals.toFixed(2)}`}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                              {result.skipped ? '-' : result.logLoss.toFixed(4)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono text-slate-500">
                              {result.skipped ? '-' : result.brierScore.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginazione */}
                {detailsTotalResults > detailsPageSize && (
                  <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-slate-500">
                      Mostrati <strong className="text-slate-900">{detailsResults.length}</strong> di <strong className="text-slate-900">{detailsTotalResults}</strong> risultati
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePageChange(detailsPage - 1)}
                        disabled={detailsPage === 1}
                        className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-slate-700">Pagina {detailsPage} di {Math.ceil(detailsTotalResults / detailsPageSize)}</span>
                      <button
                        onClick={() => handlePageChange(detailsPage + 1)}
                        disabled={detailsPage >= Math.ceil(detailsTotalResults / detailsPageSize)}
                        className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
