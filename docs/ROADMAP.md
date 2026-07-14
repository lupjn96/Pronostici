# ROADMAP.md

Questo documento delinea il piano di sviluppo a medio e lungo termine per l'evoluzione del sistema di calcolo e backtesting **Pronostici**.

---

## PIANO DI EVOLUZIONE DEI MODULI FUTURI

```
┌─────────────────────────────────────────────────────────┐
│              FASE 1: STABILIZZAZIONE CORE               │  (COMPLETATA)
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│             FASE 2: FORMA DINAMICA (ELO)                │  (PROSSIMO OBIETTIVO)
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│            FASE 3: TIME DECAY E PESI TEMPO              │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│            FASE 4: ENSEMBLE E COMBINAZIONI              │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│            FASE 5: VALUE BETTING & QUOTE                │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│         FASE 6: MACHINE LEARNING & AI ANALYST           │
└─────────────────────────────────────────────────────────┘
```

---

## DETTAGLIO DELLE FASI E DEI MODULI

### 1. Sistema di Rating ELO (Forma Dinamica)
*   **Obiettivo**: Calcolare un punteggio di forza relativo (Elo) per ciascun team che si aggiorna dopo ogni partita in base al risultato reale e all'aspettativa statistica.
*   **Impatto**: Permetterà ai modelli Poisson e Dixon-Coles di pesare non solo i gol storici, ma lo stato di forma dinamico e lo storico degli scontri diretti recenti.

### 2. Time Decay (Decadimento Temporale dei Pesi)
*   **Obiettivo**: Introdurre una funzione di decadimento esponenziale $e^{-\lambda \cdot t}$ per assegnare maggior peso alle partite giocate recentemente rispetto a quelle dell'inizio della stagione o di anni passati.
*   **Impatto**: Stima molto più precisa delle medie dei gol che tiene conto dei cambi di modulo, infortuni o sessioni di calciomercato.

### 3. Modelli Ensemble (Metodi di Combinazione)
*   **Obiettivo**: Creare un modello ibrido (Ensemble) in grado di combinare le distribuzioni probabilistiche di Poisson, Dixon-Coles e Poisson-Gamma con pesi ottimizzati tramite ottimizzatori matematici locali.
*   **Impatto**: Riduzione dei singoli bias di modello e incremento della resilienza complessiva dei pronostici in fase di backtesting.

### 4. Value Betting & Quote Analysis (Analisi della Profittabilità)
*   **Obiettivo**: Integrare il caricamento di quote di mercato storiche (1X2, Under/Over) e calcolare il valore atteso della scommessa (Expected Value, EV) tramite la formula:
    $$EV = (Probabilità \times Quota) - 1$$
*   **Impatto**: Consente di simulare vere e proprie strategie di scommessa e calcolare metriche finanziarie reali (ROI, Yield, drawdown) durante il backtesting.

### 5. Machine Learning Integration
*   **Obiettivo**: Implementare regressori locali (es. Regressione Logistica o alberi di decisione leggeri tramite librerie JS matematiche) in grado di combinare feature complesse (possesso palla storico, tiri in porta, Expected Goals reali).
*   **Impatto**: Passaggio da modelli puramente basati sui gol a modelli basati sulle reali performance di gioco dei team.

### 6. AI Analyst (Modulo Generativo)
*   **Obiettivo**: Integrare un assistente basato su LLM (come la famiglia Gemini) per interpretare i risultati aggregati del backtest, individuare debolezze di configurazione e suggerire ottimizzazioni delle opzioni (es. suggerire una variazione ottimale del `batchSize` o del `minimumMatches` in base alla competizione selezionata).
