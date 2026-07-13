# Football Prediction Lab - Progetto e Roadmap

Questo documento descrive l'architettura, le fasi evolutive e gli obiettivi futuri di **Football Prediction Lab**, un laboratorio avanzato per la simulazione e predizione dei risultati delle partite di calcio.

---

## Stato Attuale ed Evoluzione dell'Architettura

### Fase 1: Motore Matematico di Base (Completato)
- **Modello di Poisson Standard (v1.1.0)**: Algoritmo classico basato sulle distribuzioni di Poisson indipendenti per stimare le probabilità degli esiti 1-X-2, Under/Over e Goal/NoGoal.
- **Modello Poisson-Gamma Empirico (v0.1.0)**: Estensione empirica che modella l'incertezza sul parametro di intensità ($\lambda$) utilizzando la distribuzione Gamma basata sul volume dei dati storici disponibili (partite giocate).
- **Interfaccia Utente e Storico**: Form per l'inserimento manuale dei dati, calcolo interattivo e persistenza locale (`localStorage`) con gestione di esportazione/importazione e pulizia selettiva dei pronostici salvati.

### Fase 2: Football Data Engine Indipendente (Completato)
- **Separazione dei Livelli**: Creazione di un livello intermedio indipendente tra l'input (UI, file, database o API) e i modelli predittivi.
- **DataNormalizer**: Classe per la sanificazione automatica e il clipping di sicurezza dei dati per prevenire errori numerici (`NaN`, `Infinity`, valori negativi).
- **FeatureBuilder**: Componente di estrazione delle caratteristiche fondamentali (`MatchFeatures`), traducendo i dati grezzi in un formato astratto standardizzato.
- **FootballDataEngine**: Classe principale che centralizza il flusso di dati, orchestrando caricamento, normalizzazione, estrazione delle caratteristiche e validazione integrata.
- **Vantaggi**: Gli algoritmi futuri non leggono più i moduli grezzi, ma consumano esclusivamente le `MatchFeatures` fornite dall'Engine. Questo rende l'intero nucleo matematico isolato e pronto a integrazioni multiple senza modificare gli algoritmi di calcolo.

### Fase 3: Modello Predittivo Dixon-Coles v1.0.0 (Completato)
- **Modello Dixon-Coles v1.0.0**: Implementazione del modello statistico correttivo bivariato Dixon-Coles.
- **Parametro di Dipendenza**: Utilizzo del parametro di dipendenza $\rho$ (rho = -0.08) per correggere la sotto-stima dei pareggi e degli incontri con bassi punteggi.
- **Fattore Correttivo tau()**: Introduzione della funzione di correzione $\tau$ applicata ai risultati esatti 0-0, 1-0, 0-1, 1-1, mentre i risultati ad alto punteggio mantengono la logica di Poisson classica.
- **Integrità e Validazione**: Aggiunta di una suite di test specifica in `dixonColes.validation.ts` integrata nella pagina diagnostica di sistema per garantire che le probabilità sommino al 100%, la massa di probabilità sia corretta e stabile, e che le deviazioni sui punteggi alti rispetto a Poisson siano trascurabili.

### Fase 4: Historical Football Data Collector (Completato)
- **Importazione e Parsing CSV**: Parser CSV nativo estremamente robusto a carattere-per-carattere in grado di riconoscere virgole, punti e virgole, tab, BOM UTF-8, stringhe con virgolette nidificate e con normalizzazione delle virgole decimali italiane.
- **Alias Colonne e Case-Insensitivity**: Riconoscimento flessibile delle intestazioni di colonna tramite un motore di alias intelligente per identificare data, competizione, squadre, gol, tiri, angoli, cartellini, xG e quote.
- **Validazione Rigorosa e Prevenzione Errori**: Meccanismo a due livelli (errori bloccanti per i campi obbligatori; warning con declassamento a `undefined` per i campi opzionali non validi) per garantire un caricamento pulito.
- **Persistenza Avanzata con IndexedDB**: Repository asincrono completo per salvare in modo performante datasets e partite storiche su database IndexedDB locale nel browser, bypassando i limiti di localStorage.
- **Calcolatore delle Feature Storiche e Antileakage**: Estrattore statistico puro per calcolare le medie gol della squadra in casa, squadra ospite e medie campionato nel passato, escludendo rigorosamente eventi futuri rispetto alla data del match simulato per evitare data leakage. Supporto opzionale per decadimento temporale (Time Decay) e finestre mobili (Rolling Windows).
- **Test Diagnostici Completi**: Suite di test (TEST A - I) integrata in `DataCollector.validation.ts` per convalidare tutti i flussi e accessibile direttamente dall'interfaccia delle Impostazioni.

### Fase 5: Chronological Backtesting Engine (Completato)
- **Motore Cronologico**: Simulazione ordinata temporalmente per valutare le performance storiche reali senza retroazione o leakage.
- **Protezione Data Leakage**: Esclusione automatica e rigorosa di qualsiasi dato o match successivo alla data della partita analizzata.
- **Esecuzione Multi-Modello**: Esecuzione simultanea fino a 5 modelli con salvataggio delle metriche e isolamento degli errori (se un modello fallisce su una partita, gli altri continuano).
- **Salvataggio Incrementale**: Scrittura a blocchi asincrona (tramite `setTimeout`) su IndexedDB (DB_VERSION 3) che previene colli di bottiglia prestazionali e consente pausa, ripresa e annullamento.
- **Pausa, Ripresa e Annullamento**: Controlli interattivi fluidi dal dashboard per gestire sessioni di backtest estese in totale flessibilità.
- **Aggregazione Metriche Avanzata**: Calcolo rigoroso di Brier Score, Log Loss, accuratezza 1-X-2, accuratezza del punteggio esatto, probabilità assegnata all'esito reale e deviazione quadratica media dei gol (casa/trasferta).
- **Classifica Preliminare del Backtest**: Algoritmo di ranking dei modelli basato su Log Loss decrescente, Brier Score, accuratezza 1-X-2 ed efficacia statistica generale, con disclaimer statistico di sicurezza.

---

## Roadmap delle Fasi Future

### Fase 6: Ottimizzazioni e Calibrazioni Matematiche Avanzate
- **Ottimizzazione Automatica di rho**: Calcolo del parametro ottimale $\rho$ bivariato per Dixon-Coles basato sullo storico caricato.
- **Modello ELO Dinamico**: Implementazione del ranking Elo per le squadre basato su coefficienti aggiornati match-by-match.
- **Walk-Forward Optimization**: Metodologia di calibrazione dei pesi temporali e dei parametri del modello con finestre mobili cumulative e storiche.

### Fase 7: Integrazione di Fonti Esterne Automatizzate (API & Scraping)
- **Integrazione API Sportive**: Collegamento automatico a provider di dati (es. API-Football, Football-Data.org) per popolare automaticamente le medie storiche dei team in base al campionato selezionato.
- **Web Scraping & Live Quotes**: Funzionalità avanzate per recuperare classifiche e quote di mercato in tempo reale tramite scraping o widget integrati.

### Fase 8: Machine Learning & Ensemble Engine
- **Metriche xG (Expected Goals)**: Supporto nativo per metriche di Expected Goals di alta precisione basate sui tiri, differenziando i gol reali dalla qualità delle occasioni create.
- **Ensemble Engine**: Integrazione di classificatori di Machine Learning e reti neurali leggeri per combinare i modelli Poisson, Dixon-Coles ed Elo in un unico previsore combinato.

### Fase 9: Integrazione delle Quote, Value Betting e ROI
- **Confronto con le Quote dei Bookmaker**: Caricamento in tempo reale delle quote di mercato (1-X-2, Under/Over, Goal/NoGoal) tramite API o manuale.
- **Value Bet Finder e Calcolo ROI**: Algoritmo automatico che identifica le "scommesse di valore" e simula il ROI reale sul bankroll storico basato su criteri matematici rigorosi.
- **Gestione del Bankroll (Criterio di Kelly)**: Integrazione di calcolatori Kelly per ottimizzare la gestione delle puntate in base al vantaggio percentuale calcolato.

---

## Linee Guida di Manutenzione del Codice
1. **Integrità Matematica**: Non alterare le formule distributive in `poissonEngine.ts` o `poissonGammaEngine.ts` senza validarle prima tramite la suite di test diagnostici.
2. **Astrazione dell'Engine**: Qualsiasi nuovo tipo di sorgente dati (CSV, API) deve essere implementato all'interno di `FootballDataEngine.ts` o ereditando la sua struttura, senza mai esporre dati non sanitizzati agli algoritmi.
3. **Validazione Continua**: Esegui regolarmente `npm run lint` e verifica la suite di diagnostici del modulo nella pagina delle Impostazioni prima di ogni rilascio.
