import { openDB } from '../dataCollector/HistoricalMatchRepository';
import { BacktestRun, BacktestMatchResult } from './BacktestTypes';
import { normalizedTeamKey } from '../dataCollector/HistoricalMatchValidator';

/**
 * Salva i metadati di un run di backtest.
 */
export async function saveBacktestRun(run: BacktestRun): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('backtest_runs', 'readwrite');
    const store = transaction.objectStore('backtest_runs');
    
    const request = store.put(run);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva in modo incrementale una lista di singoli risultati.
 */
export async function saveBacktestResults(results: BacktestMatchResult[]): Promise<void> {
  if (results.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('backtest_results', 'readwrite');
    const store = transaction.objectStore('backtest_results');

    let index = 0;
    function putNext() {
      if (index >= results.length) {
        resolve();
        return;
      }
      const item = results[index++];
      const req = store.put(item);
      req.onsuccess = putNext;
      req.onerror = () => reject(req.error);
    }
    putNext();
  });
}

/**
 * Recupera l'elenco di tutti i backtest salvati (ordinati per data creazione decrescente).
 */
export async function getBacktestRuns(): Promise<BacktestRun[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('backtest_runs', 'readonly');
    const store = transaction.objectStore('backtest_runs');
    const request = store.getAll();

    request.onsuccess = () => {
      const runs = request.result as BacktestRun[];
      runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(runs);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera un run per ID.
 */
export async function getBacktestRunById(id: string): Promise<BacktestRun | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('backtest_runs', 'readonly');
    const store = transaction.objectStore('backtest_runs');
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera i risultati di un backtest con filtri e paginazione utilizzando indici e cursori.
 */
export async function getBacktestResultsPage(
  runId: string,
  page: number,
  pageSize: number,
  filters?: { modelId?: string; date?: string; team?: string }
): Promise<BacktestMatchResult[]> {
  const db = await openDB();
  
  const targetModelId = filters?.modelId || '';
  const targetDate = filters?.date || '';
  const normTeam = filters?.team ? normalizedTeamKey(filters.team) : '';

  const startIndex = (page - 1) * pageSize;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('backtest_results', 'readonly');
    const store = transaction.objectStore('backtest_results');
    const index = store.index('runId');

    // Apri cursore limitando solo al runId specificato
    const request = index.openCursor(IDBKeyRange.only(runId));
    const results: BacktestMatchResult[] = [];
    let matchedCount = 0;

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(results);
        return;
      }

      const match = cursor.value as BacktestMatchResult;
      let keep = true;

      if (targetModelId && match.modelId !== targetModelId) {
        keep = false;
      }

      if (keep && targetDate && match.date !== targetDate) {
        keep = false;
      }

      if (keep && normTeam) {
        const homeNorm = normalizedTeamKey(match.homeTeam);
        const awayNorm = normalizedTeamKey(match.awayTeam);
        if (!homeNorm.includes(normTeam) && !awayNorm.includes(normTeam)) {
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
 * Conta i risultati di un run di backtest, eventualmente filtrati.
 */
export async function countBacktestResults(
  runId: string,
  filters?: { modelId?: string; date?: string; team?: string }
): Promise<number> {
  const db = await openDB();
  
  const targetModelId = filters?.modelId || '';
  const targetDate = filters?.date || '';
  const normTeam = filters?.team ? normalizedTeamKey(filters.team) : '';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('backtest_results', 'readonly');
    const store = transaction.objectStore('backtest_results');
    const index = store.index('runId');

    const request = index.openCursor(IDBKeyRange.only(runId));
    let count = 0;

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(count);
        return;
      }

      const match = cursor.value as BacktestMatchResult;
      let keep = true;

      if (targetModelId && match.modelId !== targetModelId) {
        keep = false;
      }

      if (keep && targetDate && match.date !== targetDate) {
        keep = false;
      }

      if (keep && normTeam) {
        const homeNorm = normalizedTeamKey(match.homeTeam);
        const awayNorm = normalizedTeamKey(match.awayTeam);
        if (!homeNorm.includes(normTeam) && !awayNorm.includes(normTeam)) {
          keep = false;
        }
      }

      if (keep) {
        count++;
      }

      cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Elimina un run di backtest e a cascata tutti i suoi risultati salvati.
 */
export async function deleteBacktestRun(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['backtest_runs', 'backtest_results'], 'readwrite');
    const runsStore = transaction.objectStore('backtest_runs');
    const resultsStore = transaction.objectStore('backtest_results');

    // 1. Elimina il record del run
    runsStore.delete(id);

    // 2. Elimina i risultati associati via cursore sull'indice runId
    const index = resultsStore.index('runId');
    const request = index.openCursor(IDBKeyRange.only(id));

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Pulisce tutti i backtest salvati e tutti i risultati.
 */
export async function clearAllBacktests(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['backtest_runs', 'backtest_results'], 'readwrite');
    const runsStore = transaction.objectStore('backtest_runs');
    const resultsStore = transaction.objectStore('backtest_results');

    runsStore.clear();
    resultsStore.clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
