import { HistoricalMatch, HistoricalDataset } from './HistoricalMatchTypes';
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
 * Implementa una transazione atomica per garantire coerenza.
 */
export async function saveDataset(dataset: HistoricalDataset): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['historical_datasets', 'historical_matches'], 'readwrite');
    const datasetStore = transaction.objectStore('historical_datasets');
    const matchStore = transaction.objectStore('historical_matches');

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    // Salva i dati del dataset (escludendo le partite dall'oggetto dataset principale se vogliamo,
    // o lasciandole, ma salvandole separatamente nello store dedicato)
    const datasetMeta = { ...dataset };
    datasetStore.put(datasetMeta);

    // Salva le singole partite
    for (const match of dataset.matches) {
      matchStore.put(match);
    }
  });
}

/**
 * Recupera tutti i dataset (metadati) salvati.
 */
export async function getDatasets(): Promise<HistoricalDataset[]> {
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
 * Recupera un dataset specifico per ID.
 */
export async function getDatasetById(id: string): Promise<HistoricalDataset | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['historical_datasets', 'historical_matches'], 'readonly');
    const datasetStore = transaction.objectStore('historical_datasets');
    const matchStore = transaction.objectStore('historical_matches');

    const datasetRequest = datasetStore.get(id);

    datasetRequest.onsuccess = () => {
      const dataset = datasetRequest.result as HistoricalDataset;
      if (!dataset) {
        resolve(null);
        return;
      }

      // Prende le partite del dataset dall'indice
      const index = matchStore.index('datasetId');
      const matchesRequest = index.getAll(id);

      matchesRequest.onsuccess = () => {
        dataset.matches = matchesRequest.result || [];
        resolve(dataset);
      };
      matchesRequest.onerror = () => reject(matchesRequest.error);
    };

    datasetRequest.onerror = () => reject(datasetRequest.error);
  });
}

/**
 * Elimina un dataset specifico e tutte le partite ad esso collegate.
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
        cursor.delete();
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
