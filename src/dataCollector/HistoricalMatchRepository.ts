import { HistoricalMatch, HistoricalDataset, HistoricalDatasetMetadata } from './HistoricalMatchTypes';
import { normalizedTeamKey } from './HistoricalMatchValidator';

const DB_NAME = 'football_prediction_lab';
const DB_VERSION = 1;

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
      if (!db.objectStoreNames.contains('historical_datasets')) {
        db.createObjectStore('historical_datasets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('historical_matches')) {
        const matchStore = db.createObjectStore('historical_matches', { keyPath: 'id' });
        matchStore.createIndex('datasetId', 'datasetId', { unique: false });
        matchStore.createIndex('competition', 'competition', { unique: false });
        matchStore.createIndex('homeTeam', 'homeTeam', { unique: false });
        matchStore.createIndex('awayTeam', 'awayTeam', { unique: false });
      }
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
 */
export async function getMatchesPage(filters: MatchesPageFilters): Promise<HistoricalMatch[]> {
  const db = await openDB();
  const { page, pageSize, team, competition, date } = filters;
  
  const normTeam = team ? normalizedTeamKey(team) : '';
  const normComp = competition ? competition.toLowerCase().trim() : '';
  const targetDate = date ? date.trim() : '';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    const results: HistoricalMatch[] = [];
    const request = store.openCursor();

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const match = cursor.value as HistoricalMatch;
        let keep = true;

        if (normTeam) {
          const homeNorm = normalizedTeamKey(match.homeTeam);
          const awayNorm = normalizedTeamKey(match.awayTeam);
          if (!homeNorm.includes(normTeam) && !awayNorm.includes(normTeam)) {
            keep = false;
          }
        }

        if (keep && normComp) {
          const compLower = match.competition.toLowerCase();
          if (!compLower.includes(normComp)) {
            keep = false;
          }
        }

        if (keep && targetDate) {
          if (match.date !== targetDate) {
            keep = false;
          }
        }

        if (keep) {
          results.push(match);
        }

        cursor.continue();
      } else {
        // Ordina per data decrescente
        results.sort((a, b) => b.date.localeCompare(a.date));
        
        // Paginazione
        const startIndex = (page - 1) * pageSize;
        const paginated = results.slice(startIndex, startIndex + pageSize);
        resolve(paginated);
      }
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
  const normComp = competition ? competition.toLowerCase().trim() : '';
  const targetDate = date ? date.trim() : '';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('historical_matches', 'readonly');
    const store = transaction.objectStore('historical_matches');
    let count = 0;
    const request = store.openCursor();

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const match = cursor.value as HistoricalMatch;
        let keep = true;

        if (normTeam) {
          const homeNorm = normalizedTeamKey(match.homeTeam);
          const awayNorm = normalizedTeamKey(match.awayTeam);
          if (!homeNorm.includes(normTeam) && !awayNorm.includes(normTeam)) {
            keep = false;
          }
        }

        if (keep && normComp) {
          const compLower = match.competition.toLowerCase();
          if (!compLower.includes(normComp)) {
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
