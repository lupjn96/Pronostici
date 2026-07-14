# CHANGELOG.md

Questo documento tiene traccia di tutti i rilasci, aggiornamenti, miglioramenti e correzioni apportate al progetto **Pronostici**.

---

## [1.0.0] - 2026-07-14

### Aggiunto
*   Aggiunta e documentata l'interfaccia `BacktestModelSummary` in `BacktestTypes.ts` per l'aggregazione efficiente dei dati statistici.
*   Introdotto il file `AGENTS.md` nella directory root del progetto come manuale di riferimento obbligatorio per Agenti AI e sviluppatori esterni.
*   Creata la directory `docs/` con manuali tecnici completi: `ARCHITECTURE.md`, `CURRENT_STATUS.md`, `ROADMAP.md`, `MODELS.md`, `BACKTESTING.md`, e `CHANGELOG.md`.

### Modificato e Corretto (Stabilizzazione Backtesting Engine)
*   **Gestione Versionamento**: Rimosso completamente l'uso improprio di `model.modelVersion` sul tipo `PredictionModel`. Ora la versione viene risolta in modo deterministico e tipato tramite la funzione di utilità `getModelVersion(model.id)`.
*   **Gestione Fallback Silenziosi**: Aggiornato `getModelById` in `modelRegistry.ts` per lanciare un errore esplicito e bloccante in caso di ID modello sconosciuto. Questo elimina il fallback silenzioso a Poisson, migliorando la trasparenza e la stabilità delle analisi.
*   **Gestione Annullamento del Backtest**: Ora, quando un run viene annullato:
    1. Viene eseguito immediatamente il salvataggio incrementale di tutti i risultati provvisori presenti nel batch corrente.
    2. Viene aggiornato e salvato il checkpoint con l'esatto indice dell'ultimo match elaborato.
    3. Soltanto dopo viene impostato lo stato del run a `'cancelled'`.
*   **Robustezza Checkpoint**: Ora il checkpoint viene sempre salvato alla fine di ogni batch anche se `batchResults` è vuoto (es. in caso di match già elaborati o saltati per dati insufficienti), garantendo la corretta sincronizzazione temporale e di avanzamento.
*   **Passaggio Risultati Salvati**: Modificato il richiamo a `onBatchCompleted` per passare i risultati realmente salvati nel database IndexedDB anziché un array vuoto statico.
*   **Correzione Warning Linter**: Corretti tutti i warning di confronto non-overlapping in `Backtest.validation.ts` e importata correttamente la funzione `checkPauseAndCancel` per i test automatici di pausa e annullamento.
