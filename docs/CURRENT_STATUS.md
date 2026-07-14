# CURRENT_STATUS.md

Questo documento descrive lo stato attuale di avanzamento tecnologico, stabilità e conformità del progetto **Pronostici** all'ultimo rilascio.

---

## 1. STATO DEI MODULI CORE

### A. Modelli Matematici e Statistici
*   **Poisson standard (v1.1.0)**: **Completato e Stabile**. Supporta griglia probabilistica bidimensionale (13x13) per l'estrazione accurata dei punteggi esatti.
*   **Dixon-Coles (v1.0.0)**: **Completato e Stabile**. Applica correttamente il fattore correttivo di interazione tra i gol per compensare la sottostima dei pareggi.
*   **Poisson-Gamma empirico (v0.1.0)**: **Completato e Stabile**. Implementa l'approccio empirico basato sulle frequenze storiche per stimare le forze offensive e difensive dei team.

### B. Motore di Backtesting
*   **Gestione Checkpoint**: **Completato**. Il motore salva la progressione della simulazione ad ogni batch, consentendo di riprendere esattamente dall'indice successivo all'ultimo match elaborato.
*   **Gestione della Pausa e Annullamento**: **Completato**.
    *   Quando viene richiesto un annullamento, i risultati calcolati nel batch in corso vengono salvati, i checkpoint aggiornati e lo stato del run impostato correttamente su `cancelled`.
    *   La pausa non blocca il thread principale della UI ed è in grado di essere ripresa istantaneamente.
*   **Gestione Errori e Fallback**: **Completato**. Eliminato qualsiasi fallback silenzioso al modello Poisson in caso di modello ID non trovato. Ora viene generato un errore esplicito e il run viene impostato su `failed` con log chiaro per l'utente.
*   **Accuratezza del Progresso**: **Completato**. Il progresso viene registrato e mostrato in tempo reale anche in caso di partite saltate per insufficienza di dati storici.

### C. Persistenza Locale (IndexedDB)
*   **Risoluzione Duplicati**: **Completato**. Utilizza chiavi primarie deterministiche (`runId_matchId_modelId_version`) con operazione `.put()` garantendo l'idempotenza assoluta e zero record duplicati in caso di ripresa del backtest.
*   **Stabilità e Prestazioni**: **Completato**. I batch di scrittura sono configurabili per evitare rallentamenti e sovraccarichi di memoria sul browser.

---

## 2. LIMITAZIONI ATTUALI

I seguenti moduli e funzionalità non sono attualmente implementati o integrati all'interno dell'applicazione:
- **Elo**: Non implementato (rating dinamico della forma dei team).
- **Time Decay avanzato**: Non implementato (funzione di decadimento temporale per pesare le partite recenti).
- **Ensemble**: Non implementato (modelli ibridi combinati).
- **Quote Analysis**: Non implementata (acquisizione e storicizzazione delle quote dei bookmaker).
- **Value Betting**: Non implementato (valutazione del valore atteso delle scommesse).
- **Machine Learning**: Non implementato (regressori e modelli predittivi avanzati).
- **AI Analyst**: Non implementato (assistente LLM integrato per l'analisi dei dati).

---

## 3. STATO DELLA COMPILAZIONE E DEL LINTER

*   **TypeScript / Compiler**: **Completato con Successo**. Nessun errore o warning sollevato da `tsc --noEmit`.
*   **Linter**: **Completato con Successo**. `npm run lint` si completa senza sollevare errori relativi a tipi, import o incoerenze sintattiche.
*   **Build di Produzione**: **Completato con Successo**. `npm run build` genera la distribuzione statica compilata e ottimizzata all'interno di `dist/`.
