import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  Check, 
  Trash2, 
  Download, 
  Eye, 
  Search, 
  Database, 
  ShieldAlert, 
  HelpCircle,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';
import { HistoricalMatch, HistoricalDataset } from '../dataCollector/HistoricalMatchTypes';
import { parseHistoricalCSV } from '../dataCollector/CSVParser';
import { validateHistoricalMatch, mapHeadersToIndices, createHistoricalMatchId, normalizedTeamKey } from '../dataCollector/HistoricalMatchValidator';
import { 
  saveDataset, 
  getDatasets, 
  getDatasetById,
  deleteDataset, 
  getAllMatches, 
  clearAllHistoricalData, 
  countMatches 
} from '../dataCollector/HistoricalMatchRepository';

interface ErrorLogItem {
  rowNumber: number;
  homeTeam: string;
  awayTeam: string;
  errors: string[];
  warnings: string[];
}

export default function DataCollectorDashboard() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'import' | 'datasets' | 'explore' | 'diagnostics'>('import');

  // Load state
  const [datasets, setDatasets] = useState<HistoricalDataset[]>([]);
  const [allMatches, setAllMatches] = useState<HistoricalMatch[]>([]);
  const [totalMatchesCount, setTotalMatchesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // File Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState<string>('');
  const [datasetSource, setDatasetSource] = useState<string>('CSV Import');
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Analysis results
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [analyzedData, setAnalyzedData] = useState<{
    totalRows: number;
    validMatches: HistoricalMatch[];
    invalidCount: number;
    duplicateCount: number;
    warningCount: number;
    errorLog: ErrorLogItem[];
  } | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Explore filters
  const [searchTeam, setSearchTeam] = useState<string>('');
  const [searchComp, setSearchComp] = useState<string>('');
  const [searchDate, setSearchDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 100;

  // Selected Dataset detail view
  const [viewingDataset, setViewingDataset] = useState<HistoricalDataset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all initial data from IndexedDB
  const refreshData = async () => {
    try {
      setLoading(true);
      const ds = await getDatasets();
      const count = await countMatches();
      const matches = await getAllMatches();
      setDatasets(ds);
      setTotalMatchesCount(count);
      setAllMatches(matches);
    } catch (err) {
      console.error('Errore durante il caricamento dei dati da IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleFileSelection = (file: File) => {
    setUploadError(null);
    setAnalyzedData(null);
    setImportSuccessMsg(null);

    // Limiti di sicurezza: max 50MB
    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError('Errore: Il file supera il limite massimo di 50 MB.');
      return;
    }

    setSelectedFile(file);
    // Imposta il nome provvisorio del dataset basato sul file
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    setDatasetName(baseName);
  };

  // Analyze CSV File
  const handleAnalyzeFile = () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        setAnalysisProgress(30);

        // Parsing CSV
        const parsed = parseHistoricalCSV(text);
        if (parsed.headers.length === 0) {
          setUploadError('Il file CSV sembra vuoto o non ha intestazioni valide.');
          setIsAnalyzing(false);
          return;
        }

        setAnalysisProgress(50);
        // Limite di righe: 100.000
        if (parsed.rows.length > 100000) {
          setUploadError('Errore: Il file CSV supera il limite di 100.000 righe.');
          setIsAnalyzing(false);
          return;
        }

        // Prepara l'anteprima delle prime 20 righe
        setPreviewHeaders(parsed.headers);
        setPreviewRows(parsed.rows.slice(0, 20));

        // Mappatura colonne
        const indices = mapHeadersToIndices(parsed.headers);
        const hasMandatory = indices['date'] !== -1 && 
                             indices['competition'] !== -1 && 
                             indices['homeTeam'] !== -1 && 
                             indices['awayTeam'] !== -1 && 
                             indices['homeGoals'] !== -1 && 
                             indices['awayGoals'] !== -1;

        if (!hasMandatory) {
          setUploadError('Il file CSV non contiene tutte le colonne obbligatorie (Date, Competition, HomeTeam, AwayTeam, FTHG, FTAG o i loro alias).');
          setIsAnalyzing(false);
          return;
        }

        setAnalysisProgress(70);

        // Prepara un set degli ID delle partite storiche già salvate nel sistema per il controllo dei duplicati
        const existingIds = new Set(allMatches.map(m => m.id));
        const currentFileIds = new Set<string>();

        const validMatches: HistoricalMatch[] = [];
        const errorLog: ErrorLogItem[] = [];
        let invalidCount = 0;
        let duplicateCount = 0;
        let warningCount = 0;

        const fakeDatasetId = `ds-${Date.now()}`;

        // Valida riga per riga
        for (let i = 0; i < parsed.rows.length; i++) {
          const rowData = parsed.rows[i];
          
          // Mappa la riga grezza usando gli indici rilevati
          const rowObj: Record<string, string> = {};
          for (const [key, idx] of Object.entries(indices)) {
            if (idx !== -1 && rowData[idx] !== undefined) {
              rowObj[key] = rowData[idx];
            }
          }

          // Valida la partita
          const res = validateHistoricalMatch(rowObj, fakeDatasetId, datasetSource);
          const rowNumber = i + 2; // +1 per 1-based, +1 per saltare l'header

          if (!res.isValid) {
            invalidCount++;
            errorLog.push({
              rowNumber,
              homeTeam: rowObj['homeTeam'] || 'Sconosciuta',
              awayTeam: rowObj['awayTeam'] || 'Sconosciuta',
              errors: res.errors,
              warnings: res.warnings
            });
          } else if (res.match) {
            const matchId = res.match.id;

            // Rilevamento duplicati (nel file corrente o nel DB locale)
            if (currentFileIds.has(matchId) || existingIds.has(matchId)) {
              duplicateCount++;
              errorLog.push({
                rowNumber,
                homeTeam: res.match.homeTeam,
                awayTeam: res.match.awayTeam,
                errors: ['Riga duplicata rilevata (stessa data, competizione, casa e trasferta)'],
                warnings: res.warnings
              });
            } else {
              currentFileIds.add(matchId);
              validMatches.push(res.match);
              if (res.warnings.length > 0) {
                warningCount += res.warnings.length;
                errorLog.push({
                  rowNumber,
                  homeTeam: res.match.homeTeam,
                  awayTeam: res.match.awayTeam,
                  errors: [],
                  warnings: res.warnings
                });
              }
            }
          }
        }

        setAnalysisProgress(100);
        setAnalyzedData({
          totalRows: parsed.rows.length,
          validMatches,
          invalidCount,
          duplicateCount,
          warningCount,
          errorLog
        });
      } catch (err: any) {
        setUploadError(`Errore imprevisto durante l'analisi del file: ${err.message}`);
      } finally {
        setIsAnalyzing(false);
      }
    };

    reader.onerror = () => {
      setUploadError('Errore durante la lettura fisica del file.');
      setIsAnalyzing(false);
    };

    reader.readAsText(selectedFile);
  };

  // Confirm Import Dataset to IndexedDB
  const handleImportDataset = async () => {
    if (!analyzedData || !selectedFile) return;

    try {
      const datasetId = `dataset-${Date.now()}`;
      const finalMatches = analyzedData.validMatches.map(m => ({
        ...m,
        datasetId,
        source: datasetSource
      }));

      const newDataset: HistoricalDataset = {
        id: datasetId,
        name: datasetName.trim() || selectedFile.name,
        source: datasetSource,
        importedAt: new Date().toISOString(),
        totalRows: analyzedData.totalRows,
        validRows: finalMatches.length,
        invalidRows: analyzedData.invalidCount,
        duplicateRows: analyzedData.duplicateCount,
        matches: finalMatches
      };

      await saveDataset(newDataset);
      setImportSuccessMsg(`Dataset "${newDataset.name}" importato con successo! ${finalMatches.length} partite storiche salvate.`);
      
      // Resetta stato dell'import
      setSelectedFile(null);
      setAnalyzedData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await refreshData();
    } catch (err: any) {
      setUploadError(`Impossibile salvare il dataset in IndexedDB: ${err.message}`);
    }
  };

  // Download error report CSV
  const handleDownloadErrorReport = () => {
    if (!analyzedData) return;

    let csvContent = '\uFEFFrowNumber,homeTeam,awayTeam,errors,warnings\n';
    for (const item of analyzedData.errorLog) {
      const home = `"${item.homeTeam.replace(/"/g, '""')}"`;
      const away = `"${item.awayTeam.replace(/"/g, '""')}"`;
      const errs = `"${item.errors.join('; ').replace(/"/g, '""')}"`;
      const warns = `"${item.warnings.join('; ').replace(/"/g, '""')}"`;
      csvContent += `${item.rowNumber},${home},${away},${errs},${warns}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-errori-${datasetName.toLowerCase().replace(/\s+/g, '-') || 'dataset'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Delete Dataset
  const handleDeleteDataset = async (id: string, name: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare definitivamente il dataset "${name}"? Verranno rimosse anche tutte le relative partite.`)) {
      try {
        await deleteDataset(id);
        if (viewingDataset?.id === id) {
          setViewingDataset(null);
        }
        await refreshData();
      } catch (err: any) {
        alert(`Errore nell'eliminazione: ${err.message}`);
      }
    }
  };

  // Export Dataset JSON
  const handleExportDatasetJSON = (dataset: HistoricalDataset) => {
    try {
      const dataStr = JSON.stringify(dataset, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export-dataset-${dataset.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Errore durante l'esportazione JSON: ${err.message}`);
    }
  };

  // Clear all data
  const handleClearAll = async () => {
    if (window.confirm('ATTENZIONE: Stai per eliminare TUTTI i dataset e TUTTE le partite storiche salvate. Questa azione è irreversibile. Confermi?')) {
      try {
        await clearAllHistoricalData();
        setViewingDataset(null);
        await refreshData();
      } catch (err: any) {
        alert(`Errore durante la pulizia: ${err.message}`);
      }
    }
  };

  // Filter explore matches
  const filteredMatches = useMemo(() => {
    let result = [...allMatches];

    if (searchTeam.trim()) {
      const term = normalizedTeamKey(searchTeam);
      result = result.filter(
        m => normalizedTeamKey(m.homeTeam).includes(term) || normalizedTeamKey(m.awayTeam).includes(term)
      );
    }

    if (searchComp.trim()) {
      const term = normalizedTeamKey(searchComp);
      result = result.filter(m => normalizedTeamKey(m.competition).includes(term));
    }

    if (searchDate) {
      result = result.filter(m => m.date === searchDate);
    }

    // Ordina per data discendente
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return result;
  }, [allMatches, searchTeam, searchComp, searchDate]);

  // Paginated Matches
  const paginatedMatches = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredMatches.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredMatches, currentPage]);

  const totalPages = Math.ceil(filteredMatches.length / rowsPerPage) || 1;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTeam, searchComp, searchDate]);

  // Diagnostics calculations
  const diagnosticsData = useMemo(() => {
    if (allMatches.length === 0) return null;

    const totalMatches = allMatches.length;
    const compsSet = new Set<string>();
    const teamsSet = new Set<string>();
    let matchesWithOdds = 0;
    let matchesWithXG = 0;
    let matchesComplete = 0;
    let minDate = allMatches[0].date;
    let maxDate = allMatches[0].date;

    const compCounts: Record<string, number> = {};
    const teamHomeCounts: Record<string, number> = {};
    const teamAwayCounts: Record<string, number> = {};
    const futureMatches: HistoricalMatch[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    for (const m of allMatches) {
      compsSet.add(m.competition);
      teamsSet.add(m.homeTeam);
      teamsSet.add(m.awayTeam);

      if (m.oddsHome !== undefined) matchesWithOdds++;
      if (m.homeXG !== undefined) matchesWithXG++;
      
      // Complete stats if we have shots, corners, yellow and red cards
      if (
        m.homeShots !== undefined && 
        m.homeCorners !== undefined && 
        m.homeYellowCards !== undefined &&
        m.homeRedCards !== undefined
      ) {
        matchesComplete++;
      }

      if (m.date < minDate) minDate = m.date;
      if (m.date > maxDate) maxDate = m.date;

      // Group counts for warnings
      compCounts[m.competition] = (compCounts[m.competition] || 0) + 1;
      teamHomeCounts[m.homeTeam] = (teamHomeCounts[m.homeTeam] || 0) + 1;
      teamAwayCounts[m.awayTeam] = (teamAwayCounts[m.awayTeam] || 0) + 1;

      if (m.date > todayStr) {
        futureMatches.push(m);
      }
    }

    const warnings: { type: 'warning' | 'info'; text: string }[] = [];

    if (totalMatches < 100) {
      warnings.push({ type: 'warning', text: `Il sistema contiene solo ${totalMatches} partite totali (raccomandato: almeno 100 per un backtesting valido).` });
    }

    for (const [comp, count] of Object.entries(compCounts)) {
      if (count < 30) {
        warnings.push({ type: 'info', text: `La competizione "${comp}" ha solo ${count} partite registrate (raccomandato: almeno 30 per stimare medie campionato attendibili).` });
      }
    }

    for (const team of Array.from(teamsSet)) {
      const homeC = teamHomeCounts[team] || 0;
      const awayC = teamAwayCounts[team] || 0;
      if (homeC < 5) {
        warnings.push({ type: 'info', text: `La squadra "${team}" ha solo ${homeC} partite in casa (consigliate almeno 5 per stime Poisson stabili).` });
      }
      if (awayC < 5) {
        warnings.push({ type: 'info', text: `La squadra "${team}" ha solo ${awayC} partite in trasferta (consigliate almeno 5 per stime Poisson stabili).` });
      }
    }

    if (futureMatches.length > 0) {
      warnings.push({ type: 'warning', text: `Rilevate ${futureMatches.length} partite con date future rispetto ad oggi.` });
    }

    return {
      totalMatches,
      totalCompetitions: compsSet.size,
      uniqueTeams: teamsSet.size,
      timeRange: `${minDate} / ${maxDate}`,
      pctOdds: (matchesWithOdds / totalMatches) * 100,
      pctXG: (matchesWithXG / totalMatches) * 100,
      pctComplete: (matchesComplete / totalMatches) * 100,
      warnings
    };
  }, [allMatches]);

  return (
    <div className="space-y-6">
      {/* Intestazione */}
      <div className="border-b border-slate-700 pb-5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-sans text-white">Historical Data Collector</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Importa archivi CSV storici, controlla la qualità dei dati e prepara i parametri del motore di calcolo.
          </p>
        </div>
        <div className="flex gap-2">
          {datasets.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all rounded-lg text-xs font-semibold cursor-pointer"
            >
              Svuota Archivio Storico
            </button>
          )}
        </div>
      </div>

      {/* Navigazione interna */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => { setActiveTab('import'); setViewingDataset(null); }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'import' && !viewingDataset
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4 shrink-0" />
          Importa CSV
        </button>
        <button
          onClick={() => { setActiveTab('datasets'); setViewingDataset(null); }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'datasets' || viewingDataset
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          Dataset Salvati ({datasets.length})
        </button>
        <button
          onClick={() => { setActiveTab('explore'); setViewingDataset(null); }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'explore'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Search className="w-4 h-4 shrink-0" />
          Esplora Partite ({totalMatchesCount})
        </button>
        <button
          onClick={() => { setActiveTab('diagnostics'); setViewingDataset(null); }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'diagnostics'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Diagnostica Dati
        </button>
      </div>

      {/* Informativa Sicurezza e Privacy */}
      <div className="p-4 rounded-xl border border-slate-700/40 bg-slate-800/10 text-slate-400 text-xs flex items-start gap-2.5 leading-relaxed">
        <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong>Sicurezza e Privacy locale:</strong> I dataset vengono salvati localmente su questo dispositivo tramite <strong>IndexedDB</strong> e non vengono inviati automaticamente a server esterni. L'elaborazione e i calcoli avvengono interamente all'interno del browser.
        </div>
      </div>

      {/* SEZIONE 1: IMPORT CSV */}
      {activeTab === 'import' && !viewingDataset && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Box Caricamento File */}
            <div className="lg:col-span-2 space-y-4">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-900/30 hover:bg-slate-900/50 p-8 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 min-h-[220px]"
              >
                <Upload className="w-10 h-10 text-slate-500" />
                <div className="text-slate-300 font-medium">Trascina qui il file CSV o clicca per sfogliare</div>
                <div className="text-slate-500 text-xs">Supporta file fino a 50MB (max 100.000 righe)</div>
                {selectedFile && (
                  <div className="px-3 py-1 bg-slate-800 text-emerald-400 font-mono text-xs rounded border border-slate-700 flex items-center gap-2 mt-2">
                    <FileText className="w-3.5 h-3.5" /> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {selectedFile && (
                <div className="p-5 rounded-2xl border border-slate-700 bg-slate-800/25 space-y-4">
                  <h4 className="font-semibold text-white text-sm">Metadati del Dataset</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nome Dataset *</label>
                      <input
                        type="text"
                        value={datasetName}
                        onChange={(e) => setDatasetName(e.target.value)}
                        placeholder="Es: Premier League 2024-2025"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fonte / Editore</label>
                      <input
                        type="text"
                        value={datasetSource}
                        onChange={(e) => setDatasetSource(e.target.value)}
                        placeholder="Es: Football-data.co.uk, Kaggle"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      onClick={handleAnalyzeFile}
                      disabled={isAnalyzing || !datasetName.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow transition-all cursor-pointer"
                    >
                      {isAnalyzing ? `Analisi in corso (${analysisProgress}%)...` : 'Analizza file'}
                    </button>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {importSuccessMsg && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Sidebar Colonne Supportate */}
            <div className="p-5 rounded-2xl border border-slate-700/60 bg-slate-900/40 text-slate-400 text-xs space-y-4">
              <h4 className="font-bold text-slate-300 text-sm">Formato CSV Richiesto</h4>
              <p className="leading-relaxed">
                Il parser rileva automaticamente il delimitatore (virgola, punto e virgola o tab) e le corrispondenze delle colonne (case-insensitive).
              </p>
              
              <div className="space-y-2">
                <span className="block font-semibold text-emerald-400">Colonne Obbligatorie:</span>
                <div className="flex flex-wrap gap-1">
                  {['Date', 'Competition', 'HomeTeam', 'AwayTeam', 'FTHG (Gol Casa)', 'FTAG (Gol Ospite)'].map(c => (
                    <span key={c} className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="block font-semibold text-slate-300">Colonne Opzionali Supportate:</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px]">
                  <div>• HTHG / HTAG (Gol PT)</div>
                  <div>• HS / AS (Tiri)</div>
                  <div>• HST / AST (Tiri in Porta)</div>
                  <div>• HC / AC (Angoli)</div>
                  <div>• HY / AY (Ammonizioni)</div>
                  <div>• HR / AR (Espulsioni)</div>
                  <div>• HomeXG / AwayXG (xG)</div>
                  <div>• OddsHome / OddsDraw / OddsAway</div>
                </div>
              </div>
            </div>
          </div>

          {/* Risultato Analisi e Anteprima */}
          {analyzedData && (
            <div className="space-y-6 pt-4 border-t border-slate-800">
              {/* Statistiche Riepilogative */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/10 text-center">
                  <span className="block text-[10px] text-slate-400">Righe Totali</span>
                  <span className="text-xl font-bold font-mono text-white">{analyzedData.totalRows}</span>
                </div>
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                  <span className="block text-[10px] text-emerald-400 font-medium">Partite Valide</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">{analyzedData.validMatches.length}</span>
                </div>
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                  <span className="block text-[10px] text-rose-400 font-medium">Scartate (Invalide)</span>
                  <span className="text-xl font-bold font-mono text-rose-400">{analyzedData.invalidCount}</span>
                </div>
                <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-center">
                  <span className="block text-[10px] text-yellow-400 font-medium">Righe Duplicate</span>
                  <span className="text-xl font-bold font-mono text-yellow-400">{analyzedData.duplicateCount}</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/10 text-center col-span-2 md:col-span-1">
                  <span className="block text-[10px] text-slate-400">Warning Rilevati</span>
                  <span className="text-xl font-bold font-mono text-amber-400">{analyzedData.warningCount}</span>
                </div>
              </div>

              {/* Azioni Principali */}
              <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">
                  Pronto per l'importazione. Puoi scaricare l'error log se ci sono stati scarti.
                </div>
                <div className="flex gap-2">
                  {analyzedData.errorLog.length > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Scarica report errori CSV
                    </button>
                  )}
                  <button
                    onClick={handleImportDataset}
                    disabled={analyzedData.validMatches.length === 0}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Importa dataset
                  </button>
                </div>
              </div>

              {/* Anteprima Tabella CSV */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-300">Anteprima delle prime 20 righe</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-300 font-medium border-b border-slate-800 font-mono text-[10px]">
                        {previewHeaders.map((h, idx) => (
                          <th key={idx} className="p-2.5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono text-[10px] text-slate-400">
                      {previewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/10">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dettagli Errori / Warning */}
              {analyzedData.errorLog.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-rose-400">Segnalazioni, Righe Scartate e Warning ({analyzedData.errorLog.length})</h4>
                  <div className="max-h-[300px] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 divide-y divide-slate-800/40">
                    {analyzedData.errorLog.slice(0, 100).map((log, idx) => (
                      <div key={idx} className="p-3 text-xs space-y-1 hover:bg-slate-900/20">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-500">Riga {log.rowNumber}</span>
                          <span className="text-slate-400 font-bold">{log.homeTeam} vs {log.awayTeam}</span>
                        </div>
                        {log.errors.map((e, eIdx) => (
                          <div key={eIdx} className="text-rose-400 flex items-start gap-1">
                            <span className="font-bold shrink-0">[ERRORE SCARTO]</span>
                            <span>{e}</span>
                          </div>
                        ))}
                        {log.warnings.map((w, wIdx) => (
                          <div key={wIdx} className="text-amber-400 flex items-start gap-1">
                            <span className="font-bold shrink-0">[WARNING]</span>
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {analyzedData.errorLog.length > 100 && (
                      <div className="p-3 text-center text-slate-500 text-xs font-mono">
                        ...e altri {analyzedData.errorLog.length - 100} record. Scarica il report CSV completo per esaminarli tutti.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SEZIONE 2: DATASET SALVATI (E DETTAGLI) */}
      {(activeTab === 'datasets' || viewingDataset) && (
        <div className="space-y-6">
          {viewingDataset ? (
            /* DETTAGLIO DATASET */
            <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setViewingDataset(null)}
                  className="text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Torna alla lista
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportDatasetJSON(viewingDataset)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Esporta JSON
                  </button>
                  <button
                    onClick={() => handleDeleteDataset(viewingDataset.id, viewingDataset.name)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Elimina
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{viewingDataset.name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Fonte: {viewingDataset.source} | Importato il: {new Date(viewingDataset.importedAt).toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 bg-slate-800/30 rounded-xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 font-medium">Partite Valide</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">{viewingDataset.validRows}</span>
                  </div>
                  <div className="p-3.5 bg-slate-800/30 rounded-xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 font-medium">Righe Scartate</span>
                    <span className="text-lg font-bold text-rose-400 font-mono">{viewingDataset.invalidRows}</span>
                  </div>
                  <div className="p-3.5 bg-slate-800/30 rounded-xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 font-medium">Duplicati Evitati</span>
                    <span className="text-lg font-bold text-yellow-400 font-mono">{viewingDataset.duplicateRows}</span>
                  </div>
                  <div className="p-3.5 bg-slate-800/30 rounded-xl border border-slate-800">
                    <span className="block text-[10px] text-slate-400 font-medium">Competizioni</span>
                    <span className="text-lg font-bold text-blue-400 font-mono">
                      {new Set(viewingDataset.matches.map(m => m.competition)).size}
                    </span>
                  </div>
                </div>

                {/* Partite del Dataset */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-sm font-semibold text-slate-300">Partite Storiche ({viewingDataset.matches.length})</h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/20 max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-300 font-medium border-b border-slate-800 text-[10px] font-mono">
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5">Competizione</th>
                          <th className="p-2.5">Casa</th>
                          <th className="p-2.5">Ospite</th>
                          <th className="p-2.5 text-center">Risultato</th>
                          <th className="p-2.5 text-center">xG (C-O)</th>
                          <th className="p-2.5 text-center">Quote (1-X-2)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-[11px] text-slate-400 font-mono">
                        {viewingDataset.matches.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/10">
                            <td className="p-2 whitespace-nowrap">{m.date}</td>
                            <td className="p-2 whitespace-nowrap text-slate-300">{m.competition}</td>
                            <td className="p-2 font-semibold text-white whitespace-nowrap">{m.homeTeam}</td>
                            <td className="p-2 font-semibold text-white whitespace-nowrap">{m.awayTeam}</td>
                            <td className="p-2 text-center font-bold text-emerald-400 whitespace-nowrap">{m.homeGoals} - {m.awayGoals}</td>
                            <td className="p-2 text-center text-slate-500 whitespace-nowrap">
                              {m.homeXG !== undefined && m.awayXG !== undefined ? `${m.homeXG.toFixed(2)} - ${m.awayXG.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-2 text-center text-blue-400 whitespace-nowrap">
                              {m.oddsHome !== undefined ? `${m.oddsHome.toFixed(2)} / ${m.oddsDraw?.toFixed(2)} / ${m.oddsAway?.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* LISTA DATASET */
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-10 text-slate-500 text-xs font-mono">Caricamento in corso...</div>
              ) : datasets.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs font-sans">
                  Nessun dataset storico importato nel sistema. Carica un file CSV per iniziare!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {datasets.map((ds) => {
                    const competitions = Array.from(new Set(ds.matches?.map(m => m.competition) || []));
                    const dates = (ds.matches?.map(m => m.date) || []).sort();
                    const minDate = dates[0] || '-';
                    const maxDate = dates[dates.length - 1] || '-';

                    return (
                      <div key={ds.id} className="p-5 rounded-2xl border border-slate-700/60 bg-slate-800/10 hover:border-slate-600 transition-all flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-white text-sm line-clamp-1">{ds.name}</h3>
                            <span className="font-mono text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full shrink-0 border border-slate-700">
                              {ds.validRows} partite
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 space-y-1">
                            <div><strong className="text-slate-300">Fonte:</strong> {ds.source}</div>
                            <div><strong className="text-slate-300">Importato:</strong> {new Date(ds.importedAt).toLocaleDateString()}</div>
                            <div><strong className="text-slate-300">Competizioni:</strong> {competitions.slice(0, 3).join(', ')}{competitions.length > 3 && '...'}</div>
                            <div><strong className="text-slate-300">Intervallo Date:</strong> {minDate} / {maxDate}</div>
                          </div>
                        </div>

                        <div className="flex gap-1.5 pt-2 border-t border-slate-800/60">
                          <button
                            onClick={async () => {
                              const detailed = await getDatasetById(ds.id);
                              if (detailed) setViewingDataset(detailed);
                            }}
                            className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Dettagli
                          </button>
                          <button
                            onClick={() => handleExportDatasetJSON(ds)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700 cursor-pointer"
                            title="Esporta JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDataset(ds.id, ds.name)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-lg transition-all cursor-pointer"
                            title="Elimina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SEZIONE 3: ESPLORA PARTITE */}
      {activeTab === 'explore' && (
        <div className="space-y-4">
          {/* Filtri */}
          <div className="p-4 rounded-2xl border border-slate-700 bg-slate-800/10 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cerca squadra (es: Inter, Arsenal)..."
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cerca competizione (es: Serie A, Premier)..."
                value={searchComp}
                onChange={(e) => setSearchComp(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Tabella Risultati */}
          {filteredMatches.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/10 border border-slate-800 text-slate-500 text-xs font-sans rounded-xl">
              Nessuna partita corrisponde ai criteri di ricerca impostati.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-300 font-medium border-b border-slate-800 text-[10px] font-mono">
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Competizione</th>
                      <th className="p-2.5">Casa</th>
                      <th className="p-2.5">Ospite</th>
                      <th className="p-2.5 text-center">Risultato</th>
                      <th className="p-2.5 text-center">xG (C-O)</th>
                      <th className="p-2.5 text-center">Quote (1-X-2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-[11px] text-slate-400 font-mono">
                    {paginatedMatches.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10">
                        <td className="p-2.5 whitespace-nowrap">{m.date}</td>
                        <td className="p-2.5 whitespace-nowrap text-slate-300">{m.competition}</td>
                        <td className="p-2.5 font-semibold text-white whitespace-nowrap">{m.homeTeam}</td>
                        <td className="p-2.5 font-semibold text-white whitespace-nowrap">{m.awayTeam}</td>
                        <td className="p-2.5 text-center font-bold text-emerald-400 whitespace-nowrap">{m.homeGoals} - {m.awayGoals}</td>
                        <td className="p-2.5 text-center text-slate-500 whitespace-nowrap">
                          {m.homeXG !== undefined && m.awayXG !== undefined ? `${m.homeXG.toFixed(2)} - ${m.awayXG.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2.5 text-center text-blue-400 whitespace-nowrap">
                          {m.oddsHome !== undefined ? `${m.oddsHome.toFixed(2)} / ${m.oddsDraw?.toFixed(2)} / ${m.oddsAway?.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginazione */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center bg-slate-900/30 p-3 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400">
                    Mostrati {paginatedMatches.length} di {filteredMatches.length} record (Pagina {currentPage} di {totalPages})
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-30 border border-slate-700/60 rounded text-slate-300 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-30 border border-slate-700/60 rounded text-slate-300 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SEZIONE 4: DIAGNOSTICA */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          {diagnosticsData ? (
            <div className="space-y-6">
              {/* Statistiche Chiave */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/10">
                  <span className="block text-[10px] text-slate-400">Totale Partite</span>
                  <span className="text-xl font-bold font-mono text-white">{diagnosticsData.totalMatches}</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/10">
                  <span className="block text-[10px] text-slate-400">Totale Competizioni</span>
                  <span className="text-xl font-bold font-mono text-white">{diagnosticsData.totalCompetitions}</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/10">
                  <span className="block text-[10px] text-slate-400">Squadre Uniche</span>
                  <span className="text-xl font-bold font-mono text-white">{diagnosticsData.uniqueTeams}</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/10">
                  <span className="block text-[10px] text-slate-400">Arco Temporale</span>
                  <span className="text-xs font-bold font-mono text-emerald-400 mt-1 block leading-none">{diagnosticsData.timeRange}</span>
                </div>
              </div>

              {/* Qualità e Copertura Dati */}
              <div className="p-5 rounded-2xl border border-slate-700 bg-slate-800/15 space-y-4">
                <h3 className="font-semibold text-white text-sm">Indicatori di Qualità del Dataset</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Quote */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Copertura Quote Quote (1X2)</span>
                      <span className="font-mono text-blue-400 font-semibold">{diagnosticsData.pctOdds.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${diagnosticsData.pctOdds}%` }} />
                    </div>
                  </div>

                  {/* xG */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Copertura Expected Goals (xG)</span>
                      <span className="font-mono text-emerald-400 font-semibold">{diagnosticsData.pctXG.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${diagnosticsData.pctXG}%` }} />
                    </div>
                  </div>

                  {/* Complete Stats */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Statistiche Partita Complete</span>
                      <span className="font-mono text-purple-400 font-semibold">{diagnosticsData.pctComplete.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${diagnosticsData.pctComplete}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings / Diagnostica Problemi */}
              <div className="space-y-3">
                <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  Riepilogo Anomalie e Warning di Campionamento
                </h3>
                
                {diagnosticsData.warnings.length === 0 ? (
                  <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4" /> I dati caricati non presentano anomalie strutturali, insufficienza campionaria o date non congrue.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {diagnosticsData.warnings.map((w, idx) => (
                      <div key={idx} className={`p-3 text-xs rounded-lg border flex items-start gap-2 ${
                        w.type === 'warning' 
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 shrink-0 ${w.type === 'warning' ? 'text-rose-400' : 'text-slate-400'}`} />
                        <span>{w.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs font-sans">
              Nessun dato storico caricato per eseguire la diagnostica. Importa un dataset CSV per iniziare!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
