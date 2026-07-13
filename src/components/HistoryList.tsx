/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { SavedPrediction } from '../types';
import { Trash2, Eye, Calendar, ShieldAlert, Award, Search, Sparkles, PlusCircle, AlertTriangle, Check, CheckCircle } from 'lucide-react';

interface HistoryListProps {
  predictions: SavedPrediction[];
  onDelete: (id: string) => void;
  onOpen: (prediction: SavedPrediction) => void;
  onClearAll?: () => void;
  onSaveResult: (id: string, homeGoals: number, awayGoals: number) => void;
  onRemoveResult: (id: string) => void;
}

export default function HistoryList({ predictions, onDelete, onOpen, onClearAll, onSaveResult, onRemoveResult }: HistoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Stati per la gestione del risultato reale
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [activePredForResult, setActivePredForResult] = useState<SavedPrediction | null>(null);
  const [homeGoalsInput, setHomeGoalsInput] = useState('');
  const [awayGoalsInput, setAwayGoalsInput] = useState('');
  const [modalError, setModalError] = useState('');

  // Conferme per modifica e rimozione
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [pendingPredForAction, setPendingPredForAction] = useState<SavedPrediction | null>(null);

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
      <div className="border-b border-slate-700 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-sans text-white">Storico Previsioni</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Sfoglia e ricarica i calcoli salvati localmente sul tuo dispositivo.
          </p>
        </div>
        {predictions.length > 0 && (
          <button
            onClick={() => setShowClearAllConfirm(true)}
            className="py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 rounded-lg transition-all flex items-center justify-center gap-2 text-xs border border-rose-500/20 font-semibold cursor-pointer shrink-0 self-start md:self-auto min-h-[40px]"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>Elimina tutte le prove</span>
          </button>
        )}
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
                className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/30 transition-all flex flex-col gap-4"
              >
                {/* Parte Superiore: Dati Principali */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
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
                        Solidità
                      </span>
                      <span className="font-mono font-bold text-slate-200 text-sm flex items-center gap-1 justify-center">
                        <Award className="w-3.5 h-3.5 text-emerald-400" /> {formatComma(pred.result.uncertainty.solidityIndex ?? (pred.result.uncertainty as any).reliability ?? 0, 0)}%
                      </span>
                    </div>
                  </div>

                  {/* Parte destra: Pulsanti azione */}
                  <div className="flex items-center gap-2 border-t border-slate-700/50 pt-4 md:pt-0 md:border-t-0 md:pl-4 justify-end shrink-0 w-full md:w-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(pred);
                      }}
                      className="flex-1 md:flex-none py-3 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-lg transition-all flex items-center justify-center gap-2 text-xs border border-slate-700 cursor-pointer min-h-[44px]"
                      title="Vedi Analisi"
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>Apri</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(pred.id);
                      }}
                      className="flex-1 md:flex-none py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 rounded-lg transition-all flex items-center justify-center gap-2 text-xs border border-rose-500/20 cursor-pointer min-h-[44px]"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>Elimina</span>
                    </button>
                  </div>
                </div>

                {/* Parte Inferiore: Risultato Reale e Valutazione Performance */}
                <div className="mt-2 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                  {pred.actualResult && pred.evaluation ? (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-slate-300">
                          Risultato Reale: <span className="font-mono text-emerald-400 font-extrabold bg-slate-900 px-2.5 py-1 rounded border border-slate-800 text-sm ml-1">{pred.actualResult.homeGoals} - {pred.actualResult.awayGoals}</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-semibold ${
                          pred.evaluation.correct1X2 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {pred.evaluation.correct1X2 ? 'Esito Corretto ✓' : 'Esito Errato ✗'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-semibold ${
                          pred.evaluation.correctExactScore ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900/60 text-slate-500 border border-slate-800/80'
                        }`}>
                          {pred.evaluation.correctExactScore ? 'Ris. Esatto ✓' : 'Ris. Esatto ✗'}
                        </span>
                        <span className="font-mono text-slate-500 text-[10px] hidden lg:inline">
                          (Log Loss: {pred.evaluation.logLoss.toFixed(4)} | Brier: {pred.evaluation.brierScore.toFixed(4)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => {
                            setPendingPredForAction(pred);
                            setShowEditConfirmModal(true);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 py-1.5 px-2.5 hover:bg-blue-500/10 rounded-md transition-all cursor-pointer border border-transparent hover:border-blue-500/10"
                        >
                          Modifica risultato reale
                        </button>
                        <span className="text-slate-800">|</span>
                        <button
                          onClick={() => {
                            setPendingPredForAction(pred);
                            setShowRemoveConfirmModal(true);
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 py-1.5 px-2.5 hover:bg-rose-500/10 rounded-md transition-all cursor-pointer border border-transparent hover:border-rose-500/10"
                        >
                          Rimuovi risultato reale
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-500">Nessun risultato reale registrato per questa previsione.</span>
                      <button
                        onClick={() => {
                          setActivePredForResult(pred);
                          setHomeGoalsInput('');
                          setAwayGoalsInput('');
                          setModalError('');
                          setIsResultModalOpen(true);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 py-1.5 px-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition-all hover:bg-emerald-500/20 cursor-pointer self-end sm:self-auto"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Inserisci risultato reale
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 8. MODAL INSERIMENTO / MODIFICA RISULTATO */}
      {isResultModalOpen && activePredForResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="result-input-modal">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5" id="result-input-content">
            <div className="flex items-center gap-3 text-emerald-400 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Inserisci risultato reale</h3>
                <p className="text-xs text-slate-400">Inserisci i gol finali per valutare le prestazioni del modello</p>
              </div>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const h = homeGoalsInput.trim();
                const a = awayGoalsInput.trim();

                if (h === '' || a === '') {
                  setModalError('I valori dei gol sono obbligatori.');
                  return;
                }

                const homeGoalsVal = Number(h);
                const awayGoalsVal = Number(a);

                if (isNaN(homeGoalsVal) || !isFinite(homeGoalsVal) || homeGoalsVal < 0 || homeGoalsVal > 30 || !Number.isInteger(homeGoalsVal)) {
                  setModalError('I gol della squadra in casa devono essere un intero compreso tra 0 e 30.');
                  return;
                }

                if (isNaN(awayGoalsVal) || !isFinite(awayGoalsVal) || awayGoalsVal < 0 || awayGoalsVal > 30 || !Number.isInteger(awayGoalsVal)) {
                  setModalError('I gol della squadra ospite devono essere un intero compreso tra 0 e 30.');
                  return;
                }

                onSaveResult(activePredForResult.id, homeGoalsVal, awayGoalsVal);
                setIsResultModalOpen(false);
                setActivePredForResult(null);
                setHomeGoalsInput('');
                setAwayGoalsInput('');
                setModalError('');
              }}
              className="space-y-4"
            >
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Box con i nomi delle squadre */}
              <div className="grid grid-cols-2 gap-4 text-center pb-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 block truncate">{activePredForResult.input.homeTeam}</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    required
                    value={homeGoalsInput}
                    onChange={(e) => {
                      setHomeGoalsInput(e.target.value);
                      setModalError('');
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 text-center text-xl font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 block truncate">{activePredForResult.input.awayTeam}</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    required
                    value={awayGoalsInput}
                    onChange={(e) => {
                      setAwayGoalsInput(e.target.value);
                      setModalError('');
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 text-center text-xl font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsResultModalOpen(false);
                    setActivePredForResult(null);
                    setHomeGoalsInput('');
                    setAwayGoalsInput('');
                    setModalError('');
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-600/10 cursor-pointer"
                >
                  Salva e valuta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL CONFERMA MODIFICA RISULTATO */}
      {showEditConfirmModal && pendingPredForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="edit-confirmation-modal">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5" id="edit-confirmation-content">
            <div className="flex items-center gap-3 text-blue-400">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Modifica risultato</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Modificando il risultato verrà ricalcolata la valutazione del modello.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditConfirmModal(false);
                  setPendingPredForAction(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const pred = pendingPredForAction;
                  setShowEditConfirmModal(false);
                  setPendingPredForAction(null);
                  if (pred) {
                    setActivePredForResult(pred);
                    setHomeGoalsInput(pred.actualResult ? String(pred.actualResult.homeGoals) : '');
                    setAwayGoalsInput(pred.actualResult ? String(pred.actualResult.awayGoals) : '');
                    setModalError('');
                    setIsResultModalOpen(true);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-blue-600/10 cursor-pointer"
              >
                Procedi con la modifica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL CONFERMA RIMOZIONE RISULTATO */}
      {showRemoveConfirmModal && pendingPredForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="remove-result-confirmation-modal">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5" id="remove-result-confirmation-content">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Rimuovi risultato reale</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Sei sicuro di voler rimuovere il risultato reale e la valutazione da questo pronostico? Il pronostico originario non verrà cancellato.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRemoveConfirmModal(false);
                  setPendingPredForAction(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const pred = pendingPredForAction;
                  setShowRemoveConfirmModal(false);
                  setPendingPredForAction(null);
                  if (pred) {
                    onRemoveResult(pred.id);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                Rimuovi risultato reale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal di conferma eliminazione singola */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="delete-confirmation-modal">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5" id="delete-confirmation-content">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Elimina pronostico</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Vuoi davvero eliminare questo pronostico? L’operazione non può essere annullata.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteId) {
                    onDelete(deleteId);
                    setDeleteId(null);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                Elimina definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal di conferma eliminazione totale */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="clear-all-confirmation-modal">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5" id="clear-all-confirmation-content">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Elimina tutti i pronostici</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Stai per eliminare tutti i pronostici salvati. Questa operazione non può essere annullata.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAll) {
                    onClearAll();
                  }
                  setShowClearAllConfirm(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                Elimina definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
