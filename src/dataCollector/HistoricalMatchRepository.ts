import { HistoricalMatch, HistoricalDataset, HistoricalDatasetMetadata, HistoricalDiagnostics } from './HistoricalMatchTypes';
import { normalizedTeamKey } from './HistoricalMatchValidator';

const DB_NAME = 'football_prediction_lab';
const DB_VERSION = 2;

/**
 * Apre una connessione al database IndexedDB in modo asincrono.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non è supportato in questo ambiente.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction!;

      if (!db.objectStoreNames.contains('historical_datasets')) {
        db.createObjectStore('historical_datasets', { keyPath: 'id' });
      }

      let matchStore: IDBObjectStore;
      if (!db.objectStoreNames.contains('historical_matches')) {
        matchStore = db.createObjectStore('historical_matches', { keyPath: 'id' });
      } else {
        matchStore = transaction.objectStore('historical_matches');
      }

      // Crea indici se non esistono
      if (!matchStore.indexNames.contains('datasetId')) {
        matchStore.createIndex('datasetId', 'datasetId', { unique: false });
      }
      if (!matchStore.indexNames.contains('competition')) {
        matchStore.createIndex('competition', 'competition', { unique: false });
      }
      if (!matchStore.indexNames.contains('homeTeam')) {
        matchStore.createIndex('homeTeam', 'homeTeam', { unique: false });
      }
      if (!matchStore.indexNames.contains('awayTeam')) {
        matchStore.createIndex('awayTeam', 'awayTeam', { unique: false });
      }
      if (!matchStore.indexNames.contains('date')) {
        matchStore.createIndex('date', 'date', { unique: false });
      }
      if (!matchStore.indexNames.contains('competitionKey')) {
        matchStore.createIndex('competitionKey', 'competitionKey', { unique: false });
      }
      if (!matchStore.indexNames.contains('homeTeamKey')) {
        matchStore.createIndex('homeTeamKey', 'homeTeamKey', { unique: false });
      }
      if (!matchStore.indexNames.contains('awayTeamKey')) {
        matchStore.createIndex('awayTeamKey', 'awayTeamKey', { unique: false });
      }

      // Migrazione automatica dei vecchi record
      const cursorReq = matchStore.openCursor();
      cursorReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          const match = cursor.value;
          let updated = false;
          if (!match.competitionKey) {
            match.competitionKey = normalizedTeamKey(match.competition);
            updated = true;
          }
          if (!match.homeTeamKey) {
            match.homeTeamKey = normalizedTeamKey(match.homeTeam);
            updated = true;
          }
          if (!match.awayTeamKey) {
            match.awayTeamKey = normalizedTeamKey(match.awayTeam);
            updated = true;
          }
          if (updated) {
            cursor.update(match);
          }
          cursor.continue();
        }
      };
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva un dataset e tutte le sue partite associate.
 * Implementa una transazione atomica per garantire coerenza e prevenire sovrascritture di duplicati globali.
 * Restituisce il conteggio reale di partite salvate e duplicati saltati.
 */
export async function saveDataset(dataset: HistoricalDataset): Promise<{ savedMatches: number; skippedDuplicates: number }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['historical_datasets', 'historical_matches'], 'readwrite');
    const datasetStore = transaction.objectStore('historical_datasets');
    const matchStore = transaction.objectStore('historical_matches');

    let savedMatches = 0;
    let skippedDuplicates = 0;
    let pendingCount = dataset.matches.length;

    transaction.onerror = () => reject(transaction.error);

    const checkDone = () => {
      pendingCount--;
      if (pendingCount === 0) {
        // Ora aggiorniamo i metadati finali del dataset
        const finalDuplicateRows = dataset.duplicateRows + skippedDuplicates;
        const finalValidRows = savedMatches;

        const datasetMeta: HistoricalDatasetMetadata = {
          id: dataset.id,
          name: dataset.name,
          source: dataset.source,
          importedAt: dataset.importedAt,
          totalRows: dataset.totalRows,
          validRows: finalValidRows,
          invalidRows: dataset.invalidRows,
          duplicateRows: finalDuplicateRows
        };
        datasetStore.put(datasetMeta);
      }
    };

    if (pendingCount === 0) {
      const datasetMeta: HistoricalDatasetMetadata = {
        id: dataset.id,
        name: dataset.name,
        source: dataset.source,
        importedAt: dataset.importedAt,
        totalRows: dataset.totalRows,
        validRows: 0,
        invalidRows: dataset.invalidRows,
        duplicateRows: dataset.duplicateRows
      };
      datasetStore.put(datasetMeta);
      resolve({ savedMatches: 0, skippedDuplicates: 0 });
      return;
    }

    // Salva le singole partite verificando preventivamente se l'id esiste già nel DB globale
    for (const match of dataset.matches) {
      const getReq = matchStore.get(match.id);
      getReq.onsuccess = (e) => {
        const existing = getReq.result;
        if (existing) {
          skippedDuplicates++;
          checkDone();
        } else {
          const addReq = matchStore.add(match);
          addReq.onsuccess = () => {
            savedMatches++;
            checkDone();
          };
          addReq.onerror = (err) => {
            // Previene che l'errore annulli l'intera transazione
            err.preventDefault();
            err.stopPropagation();
            skippedDuplicates++;
            checkDone();
          };
        }
      };
      getReq.onerror = () => {
        skippedDuplicates++;
        checkDone();
      };
    }

    transaction.oncomplete = () => {
      resolve({ savedMatches, skippedDuplicates });
    };
  });
}

/**
 * Recupera tutti i dataset (metadati) salvati.
 */
export async function getDatasets(): Promise<HistoricalDatasetMetadata[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_datasets', 'readonly');
    const store = transaction.objectStore('historical_datasets');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera un dataset specifico per ID ricostruendolo con le sue partite associate.
 */
export async function getDatasetById(id: string): Promise<HistoricalDataset | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['historical_datasets', 'historical_matches'], 'readonly');
    const datasetStore = transaction.objectStore('historical_datasets');
    const matchStore = transaction.objectStore('historical_matches');

    const datasetRequest = datasetStore.get(id);

    datasetRequest.onsuccess = () => {
      const meta = datasetRequest.result as HistoricalDatasetMetadata;
      if (!meta) {
        resolve(null);
        return;
      }

      // Prende le partite del dataset dall'indice
      const index = matchStore.index('datasetId');
      const matchesRequest = index.getAll(id);

      matchesRequest.onsuccess = () => {
        const dataset: HistoricalDataset = {
          ...meta,
          matches: matchesRequest.result || []
        };
        resolve(dataset);
      };
      matchesRequest.onerror = () => reject(matchesRequest.error);
    };

    datasetRequest.onerror = () => reject(datasetRequest.error);
  });
}

/**
 * Elimina un dataset specifico e tutte le partite ad esso collegate in modo sicuro e preciso.
 */
export async function deleteDataset(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['historical_datasets', 'historical_matches'], 'readwrite');
    const datasetStore = transaction.objectStore('historical_datasets');
    const matchStore = transaction.objectStore('historical_matches');

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    // Elimina il dataset
    datasetStore.delete(id);

    // Trova ed elimina tutte le partite con datasetId === id
    const index = matchStore.index('datasetId');
    const request = index.openCursor(IDBKeyRange.only(id));

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const match = cursor.value as HistoricalMatch;
        if (match && match.datasetId === id) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  });
}

/**
 * Recupera tutte le partite storiche caricate nel sistema.
 */
export async function getAllMatches(): Promise<HistoricalMatch[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera le partite storiche filtrate per competizione.
 */
export async function getMatchesByCompetition(competition: string): Promise<HistoricalMatch[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    const index = store.index('competition');
    const request = index.getAll(IDBKeyRange.only(competition));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera le partite storiche filtrate per squadra (sia casa che trasferta).
 */
export async function getMatchesByTeam(team: string): Promise<HistoricalMatch[]> {
  const db = await openDB();
  const targetNorm = normalizedTeamKey(team);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    
    // Per completezza e sicurezza nell'interrogazione IndexedDB che non supporta query OR complesse natively,
    // usiamo un cursore per leggere tutte le partite e filtrarle in memoria, che per dataset normali è istantaneo,
    // oppure facciamo l'unione di interrogazioni su indici. La scansione completa delle partite è pulita ed efficiente.
    const request = store.openCursor();
    const results: HistoricalMatch[] = [];

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const match = cursor.value as HistoricalMatch;
        if (normalizedTeamKey(match.homeTeam) === targetNorm || normalizedTeamKey(match.awayTeam) === targetNorm) {
          results.push(match);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Cancella l'intero database storico.
 */
export async function clearAllHistoricalData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['historical_datasets', 'historical_matches'], 'readwrite');
    const datasetStore = transaction.objectStore('historical_datasets');
    const matchStore = transaction.objectStore('historical_matches');

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    datasetStore.clear();
    matchStore.clear();
  });
}

/**
 * Conta il numero complessivo di partite storiche salvate.
 */
export async function countMatches(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface MatchesPageFilters {
  page: number;
  pageSize: number;
  team?: string;
  competition?: string;
  date?: string;
}

/**
 * Recupera una pagina di partite storiche filtrate.
 * Utilizza indici e cursori per limitare al minimo la lettura dei record da IndexedDB.
 */
export async function getMatchesPage(filters: MatchesPageFilters): Promise<HistoricalMatch[]> {
  const db = await openDB();
  const { page, pageSize, team, competition, date } = filters;
  
  const normTeam = team ? normalizedTeamKey(team) : '';
  const normComp = competition ? normalizedTeamKey(competition) : '';
  const targetDate = date ? date.trim() : '';

  const startIndex = (page - 1) * pageSize;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    
    let request: IDBRequest<IDBCursorWithValue | null>;
    if (store.indexNames.contains('date')) {
      const index = store.index('date');
      request = index.openCursor(null, 'prev');
    } else {
      request = store.openCursor(null, 'prev');
    }

    const results: HistoricalMatch[] = [];
    let matchedCount = 0;

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(results);
        return;
      }

      const match = cursor.value as HistoricalMatch;
      let keep = true;

      if (normTeam) {
        const homeNorm = match.homeTeamKey || normalizedTeamKey(match.homeTeam);
        const awayNorm = match.awayTeamKey || normalizedTeamKey(match.awayTeam);
        if (!homeNorm.includes(normTeam) && !awayNorm.includes(normTeam)) {
          keep = false;
        }
      }

      if (keep && normComp) {
        const compNorm = match.competitionKey || normalizedTeamKey(match.competition);
        if (!compNorm.includes(normComp)) {
          keep = false;
        }
      }

      if (keep && targetDate) {
        if (match.date !== targetDate) {
          keep = false;
        }
      }

      if (keep) {
        if (matchedCount >= startIndex) {
          results.push(match);
          if (results.length === pageSize) {
            resolve(results);
            return;
          }
        }
        matchedCount++;
      }

      cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Conta il numero di partite storiche filtrate.
 */
export async function countFilteredMatches(filters: Omit<MatchesPageFilters, 'page' | 'pageSize'>): Promise<number> {
  const db = await openDB();
  const { team, competition, date } = filters;
  
  const normTeam = team ? normalizedTeamKey(team) : '';
  const normComp = competition ? normalizedTeamKey(competition) : '';
  const targetDate = date ? date.trim() : '';

  // Se non ci sono filtri, restituisce direttamente count() velocissimo
  if (!normTeam && !normComp && !targetDate) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('historical_matches', 'readonly');
      const store = transaction.objectStore('historical_matches');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    
    let request: IDBRequest<IDBCursorWithValue | null>;
    if (store.indexNames.contains('date')) {
      const index = store.index('date');
      request = index.openCursor();
    } else {
      request = store.openCursor();
    }

    let count = 0;

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const match = cursor.value as HistoricalMatch;
        let keep = true;

        if (normTeam) {
          const homeNorm = match.homeTeamKey || normalizedTeamKey(match.homeTeam);
          const awayNorm = match.awayTeamKey || normalizedTeamKey(match.awayTeam);
          if (!homeNorm.includes(normTeam) && !awayNorm.includes(normTeam)) {
            keep = false;
          }
        }

        if (keep && normComp) {
          const compNorm = match.competitionKey || normalizedTeamKey(match.competition);
          if (!compNorm.includes(normComp)) {
            keep = false;
          }
        }

        if (keep && targetDate) {
          if (match.date !== targetDate) {
            keep = false;
          }
        }

        if (keep) {
          count++;
        }

        cursor.continue();
      } else {
        resolve(count);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Calcola i metadati di diagnostica per i dati storici senza caricare l'intero array in memoria.
 */
export async function getHistoricalDiagnostics(): Promise<HistoricalDiagnostics | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    
    const request = store.openCursor();
    
    let totalMatches = 0;
    const compsSet = new Set<string>();
    const teamsSet = new Set<string>();
    let matchesWithOdds = 0;
    let matchesWithXG = 0;
    let matchesComplete = 0;
    let minDate = '';
    let maxDate = '';

    const compCounts: Record<string, number> = {};
    const teamHomeCounts: Record<string, number> = {};
    const teamAwayCounts: Record<string, number> = {};
    let futureMatchesCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const m = cursor.value as HistoricalMatch;
        totalMatches++;
        compsSet.add(m.competition);
        teamsSet.add(m.homeTeam);
        teamsSet.add(m.awayTeam);

        if (m.oddsHome !== undefined) matchesWithOdds++;
        if (m.homeXG !== undefined) matchesWithXG++;
        
        if (
          m.homeShots !== undefined && 
          m.homeCorners !== undefined && 
          m.homeYellowCards !== undefined &&
          m.homeRedCards !== undefined
        ) {
          matchesComplete++;
        }

        if (!minDate || m.date < minDate) minDate = m.date;
        if (!maxDate || m.date > maxDate) maxDate = m.date;

        compCounts[m.competition] = (compCounts[m.competition] || 0) + 1;
        teamHomeCounts[m.homeTeam] = (teamHomeCounts[m.homeTeam] || 0) + 1;
        teamAwayCounts[m.awayTeam] = (teamAwayCounts[m.awayTeam] || 0) + 1;

        if (m.date > todayStr) {
          futureMatchesCount++;
        }

        cursor.continue();
      } else {
        if (totalMatches === 0) {
          resolve(null);
          return;
        }

        const warnings: { type: 'warning' | 'info'; text: string }[] = [];

        if (totalMatches < 100) {
          warnings.push({ type: 'warning', text: `Il sistema contiene solo ${totalMatches} partite totali (raccomandato: almeno 100 per un backtesting valido).` });
        }

        for (const [comp, count] of Object.entries(compCounts)) {
          if (count < 30) {
            warnings.push({ type: 'info', text: `La competizione "${comp}" ha solo ${count} partite registrate (raccomandato: almeno 30 per stima di medie campionato attendibili).` });
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

        if (futureMatchesCount > 0) {
          warnings.push({ type: 'warning', text: `Rilevate ${futureMatchesCount} partite con date future rispetto ad oggi.` });
        }

        resolve({
          totalMatches,
          totalCompetitions: compsSet.size,
          uniqueTeams: teamsSet.size,
          timeRange: `${minDate} / ${maxDate}`,
          pctOdds: (matchesWithOdds / totalMatches) * 100,
          pctXG: (matchesWithXG / totalMatches) * 100,
          pctComplete: (matchesComplete / totalMatches) * 100,
          warnings
        });
      }
    };

    request.onerror = () => reject(request.error);
  });
}
