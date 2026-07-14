# ARCHITECTURE.md

Questo documento descrive dettagliatamente l'architettura tecnica e le scelte di design dell'applicazione **Pronostici**.

---

## 1. VISIONE D'INSIEME (HIGH-LEVEL OVERVIEW)

L'applicazione è interamente strutturata come una **Single Page Application (SPA)** client-side. Tutte le computazioni matematiche, la gestione dei dati e il backtesting avvengono nel browser dell'utente senza fare affidamento su API server esterne o database remoti.

### Vantaggi di questa architettura:
1. **Velocità**: Nessuna latenza di rete durante l'elaborazione dei modelli o il salvataggio dei risultati.
2. **Privacy dei Dati**: I dataset caricati dall'utente e i run di backtest rimangono esclusivamente sul dispositivo locale.
3. **Costo Zero**: L'app può essere servita come contenuto statico da qualsiasi CDN, eliminando la necessità di database SQL o server di computazione dedicati.

---

## 2. MODULARITÀ E COMPONENTI CHIAVE

L'applicazione è suddivisa in tre macro-aree coerenti:

### A. Core Mathematical Engines
Questi motori si occupano di trasformare le feature storiche di una partita (media gol fatti/subiti, accoppiamenti testa-testa) in distribuzioni di probabilità.
*   **Poisson standard**: Stima i gol indipendenti delle due squadre.
*   **Dixon-Coles**: Aggiunge un parametro di dipendenza (tau) per correggere la sottostima dei pareggi a basso punteggio (es. 0-0, 1-1).
*   **Poisson-Gamma empirico**: Stima empiricamente le forze offensive e difensive dei team.

### B. Storage & Data Persistence (IndexedDB)
IndexedDB viene utilizzato come database locale nel browser per ospitare e storicizzare in modo sicuro e persistente i dati dell'utente tra diverse sessioni di navigazione. Lo schema di memorizzazione locale include:
*   `historical_matches`: Contiene l'intero storico delle partite reali caricate per competizione.
*   `backtest_runs`: Metadati, parametri di configurazione e progresso dei run di backtesting.
*   `backtest_results`: I singoli pronostici generati dal backtest storicizzati e pronti per l'aggregazione statistica.

### C. Execution & Backtesting Engine
Il motore di backtesting simula in ordine rigorosamente cronologico lo svolgimento di una serie di partite storiche. Per ogni partita nel periodo selezionato:
1. Isola i dati storici a una data strettamente precedente alla partita corrente per evitare **data leakage**.
2. Estrae le feature tramite `HistoricalFeatureCalculator`.
3. Richiede i pronostici ai modelli attivi.
4. Valuta la qualità dei pronostici rispetto al risultato reale.
5. Salva i dati in IndexedDB a blocchi (batching) e aggiorna i checkpoint di ripresa.

---

## 3. PREVENZIONE DEL DATA LEAKAGE (DATA ISOLATION)

Il data leakage è la minaccia principale in qualsiasi sistema di backtesting predittivo. Nel nostro motore, l'isolamento è garantito nel modo seguente:

```typescript
// Protezione data leakage: passa soltanto le partite con data STRETTAMENTE precedente alla partita valutata
const historicalBefore = allCompMatches.filter(m => m.date < currentMatch.date);
```

Questo assicura che il motore utilizzi esclusivamente dati con data precedente alla partita oggetto di pronostico. Nessuna statistica o informazione futura (come i gol segnati nel match stesso o in partite successive) viene accidentalmente introdotta nei parametri del modello durante la formulazione del pronostico.

---

## 4. DESIGN PATTERNS APPLICATI

*   **Registry Pattern (`src/modelRegistry.ts`)**: Consente la registrazione e la risoluzione dinamica dei modelli statistici tramite un ID unico.
*   **Repository Pattern (`src/backtesting/BacktestRepository.ts`)**: Separa l'accesso fisico e transazionale a IndexedDB dalla logica di esecuzione del backtest.
*   **Observer/Callback Pattern**: Il motore di backtesting notifica in tempo reale l'avanzamento, le pause e i checkpoint alla UI tramite callback non-bloccanti (`onProgress`, `onBatchCompleted`).
