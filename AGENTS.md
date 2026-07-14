# AGENTS.md

Benvenuto! Questo file è la guida di riferimento obbligatoria per qualsiasi Agente AI o sviluppatore che collabora sul progetto **Pronostici**. Ogni modifica futura deve rispettare rigorosamente le linee guida e le convenzioni stabilite in questo documento.

---

## 1. DESCRIZIONE COMPLETA DEL PROGETTO

**Pronostici** è un'applicazione web (SPA full-client) realizzata in **React**, **TypeScript** e **Tailwind CSS**, progettata per il calcolo e il backtesting di previsioni calcistiche basate su modelli statistici e matematici. 

L'obiettivo dell'applicazione è consentire agli utenti di:
1. Calcolare la probabilità dei risultati (1X2, Over/Under, punteggio esatto) per singole partite inserendo dati storici o caricando dataset.
2. Eseguire backtesting storici cronologici accurati per valutare la performance e l'accuratezza dei diversi algoritmi statistici nel tempo (evitando il data leakage).
3. Analizzare e classificare i modelli matematici attraverso metriche di errore e precisione statistica standardizzate:
   - **Accuracy 1X2**
   - **Brier Score**
   - **Log Loss**
   - **Goal Error** (errore medio sui gol)

*Nota: ROI, Quote Analysis e Value Betting non sono attualmente supportati e saranno introdotti successivamente.*

---

## 2. ARCHITETTURA DEL SISTEMA

L'architettura è interamente client-side per garantire privacy, reattività e assenza di costi di infrastruttura server. Utilizza i seguenti componenti chiave:

*   **UI Layer (React + Tailwind CSS + Lucide Icons)**: Componenti funzionali puliti basati su stati React per un'esperienza d'uso fluida e reattiva.
*   **Data Layer (IndexedDB)**: Persistenza locale per dataset storici, partite caricate, configurazioni e risultati di backtesting. Gestito tramite API asincrone Promise-based native per memorizzare in sicurezza i dati nel browser dell'utente.
*   **Mathematical Models Engine**: Moduli matematici isolati e deterministici (Poisson, Dixon-Coles, Poisson-Gamma empirico, ecc.) che ricevono feature standardizzate e restituiscono distribuzioni probabilistiche complete.
*   **Backtesting Engine**: Un motore asincrono batch-based in grado di riprendere da checkpoint, gestire pause, annullamenti e salvataggi incrementali consistenti su IndexedDB.
*   **Performance Engine**: Calcola metriche di accuratezza e score statistici (Log Loss, Brier Score, errore sui gol) confrontando i pronostici generati con i risultati reali delle partite.

---

## 3. FLUSSO DEI DATI (DATA FLOW)

Il flusso dei dati segue un percorso unidirezionale e rigoroso:

```
[File CSV/JSON o Input Manuale]
              │
              ▼
    [HistoricalMatch] (Salvataggio in IndexedDB)
              │
              ▼
[HistoricalFeatureCalculator] (Calcolo medie, pesi)
              │
              ▼
        [ModelInput] (Parametri puliti pronti per l'analisi)
              │
              ▼
     [FootballDataEngine] (Validazione e calcolo feature finali)
              │
              ▼
        [MatchFeatures] (Parametri standardizzati del match)
              │
              ▼
 [PredictionModel.calculate()] (Esecuzione Poisson / Dixon-Coles / Poisson-Gamma)
              │
              ▼
       [PredictionResult] (Probabilità 1X2, Gol Attesi, Punteggi Esatti)
              │
              ▼
   [PerformanceEngine] (Valutazione Brier Score, Log Loss, Errore Gol)
              │
              ▼
    [BacktestMatchResult] (Salvataggio incrementale in IndexedDB)
```

---

## 4. REGOLE DI SVILUPPO E CONVENZIONI TYPESCRIPT

Ogni agente o sviluppatore deve attenersi alle seguenti regole:

*   **Digitazione Rigorosa**: Non usare mai `any`. Tutti gli input, output e stati devono avere interfacce o tipi TypeScript definiti in `src/types.ts` o `src/backtesting/BacktestTypes.ts`.
*   **Import Ordinati**: Posizionare gli import in cima al file. Utilizzare sempre import nominati (`import { x } from 'y'`) e mai import distrutturati o stellati per moduli interni. Non usare `import type` per gli enum.
*   **Enum Standard**: Utilizzare solo `enum` standard (es. `export enum MatchOutcome`) e non usare `const enum`.
*   **Nessun Effetto Collaterale nei Componenti**: Evitare re-render infiniti. Non aggiornare lo stato direttamente nel corpo dei componenti. Stabilizzare o memorizzare le dipendenze degli `useEffect`.
*   **Isolamento delle Formule**: Non modificare mai le formule matematiche o le distribuzioni statistiche senza previa autorizzazione esplicita.

---

## 5. FILE PRINCIPALI DEL PROGETTO

*   `src/types.ts`: Contiene i tipi e le interfacce globali del dominio (PredictionModel, MatchFeatures, ModelInput, ecc.).
*   `src/backtesting/BacktestTypes.ts`: Tipi specifici del motore di backtesting (BacktestRun, BacktestMatchResult, BacktestModelSummary).
*   `src/backtesting/BacktestEngine.ts`: Il cuore del motore di backtesting cronologico multi-modello.
*   `src/backtesting/BacktestRepository.ts`: Gestore delle query IndexedDB per i run e i risultati del backtest.
*   `src/backtesting/BacktestAggregator.ts`: Aggrega e ordina i risultati per generare report e classifiche dei modelli.
*   `src/modelRegistry.ts`: Registro centralizzato dei modelli predittivi disponibili nel sistema.
*   `src/poissonEngine.ts`: Motore predittivo basato sulla distribuzione di Poisson standard.
*   `src/dixonColesEngine.ts`: Motore basato sul modello Dixon-Coles con correzione di dipendenza a bassi gol.
*   `src/poissonGammaEngine.ts`: Motore basato sul modello empirico Poisson-Gamma per la stima delle forze dei team.

---

## 6. FILE DA NON MODIFICARE SENZA AUTORIZZAZIONE ESPLICITA

I seguenti moduli contengono la logica matematica e statistica fondamentale. È **STRICTLY FORBIDDEN** modificarli senza autorizzazione formale e test estesi:

1.  `src/poissonEngine.ts`
2.  `src/dixonColesEngine.ts`
3.  `src/poissonGammaEngine.ts`
4.  Qualsiasi file contenente formule probabilistiche o algoritmi di stima dei gol attesi (Expected Goals).

---

## 7. PROCEDURA OBBLIGATORIA PER OGNI FUTURO AGENTE AI

Prima di avviare qualsiasi sotto-attività o modifica del codice, l'Agente AI deve:

1.  **Leggere questo file (`AGENTS.md`)** e tutti i documenti nella directory `docs/`.
2.  **Verificare la coerenza sintattica** eseguendo `npm run lint` (che esegue `tsc --noEmit`).
3.  **Non introdurre mai fallback silenziosi**: in caso di ID non validi o configurazioni errate, lanciare sempre errori espliciti in modo che il motore possa fallire in sicurezza e mostrare l'errore all'utente.
4.  **Eseguire sempre la build locale** con `npm run build` prima di completare il proprio turno per garantire che non vi siano problemi di compilazione o di bundling.

---

## 8. ROADMAP TECNICA PREVISTA

*   **Fase 1 (Completata)**: Stabilizzazione del Backtesting Engine, rimozione dei fallback silenziosi, correzione della ripresa da checkpoint e gestione robusta di pausa/annullamento.
*   **Fase 2**: Integrazione dell'algoritmo Elo per tracciare lo stato di forma dinamico dei team.
*   **Fase 3**: Introduzione del decadimento temporale avanzato per pesare maggiormente i match più recenti.
*   **Fase 4**: Sviluppo del modulo di Quote Analysis e Value Betting per l'analisi dei mercati reali.
*   **Fase 5**: Creazione di un AI Analyst integrato per interpretare i risultati statistici del backtest.
