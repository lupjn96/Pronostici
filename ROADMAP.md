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

---

## Roadmap delle Fasi Future

### Fase 5: Integrazione di Fonti Esterne Automatizzate (API & Scraping)
- **Integrazione API Sportive**: Collegamento automatico a provider di dati (es. API-Football, Football-Data.org) per popolare automaticamente le medie storiche dei team in base al campionato selezionato.
- **Web Scraping & Live Quotes**: Funzionalità avanzate per recuperare classifiche e quote di mercato in tempo reale tramite scraping o widget integrati.

### Fase 6: Modellazione Matematica Avanzata & Machine Learning
- **Metriche xG (Expected Goals)**: Supporto nativo per metriche di Expected Goals di alta precisione basate sui tiri, differenziando i gol reali dalla qualità delle occasioni create.
- **Ensemble Engine**: Integrazione di classificatori di Machine Learning e reti neurali leggeri per combinare i modelli Poisson, Dixon-Coles ed Elo in un unico previsore combinato.

### Fase 7: Integrazione delle Quote e Value Betting
- **Confronto con le Quote dei Bookmaker**: Caricamento in tempo reale delle quote di mercato (1-X-2, Under/Over, Goal/NoGoal) tramite API o manuale.
- **Value Bet Finder**: Algoritmo automatico che identifica le "scommesse di valore" confrontando le probabilità stimate dai modelli interni del Lab con le probabilità implicite dei bookmaker:
  $$\text{Value} = (\text{Probabilità Stimata} \times \text{Quota}) - 100\%$$
- **Gestione del Bankroll (Criterio di Kelly)**: Integrazione di calcolatori Kelly per ottimizzare la gestione delle puntate in base al vantaggio percentuale calcolato.

---

## Linee Guida di Manutenzione del Codice
1. **Integrità Matematica**: Non alterare le formule distributive in `poissonEngine.ts` o `poissonGammaEngine.ts` senza validarle prima tramite la suite di test diagnostici.
2. **Astrazione dell'Engine**: Qualsiasi nuovo tipo di sorgente dati (CSV, API) deve essere implementato all'interno di `FootballDataEngine.ts` o ereditando la sua struttura, senza mai esporre dati non sanitizzati agli algoritmi.
3. **Validazione Continua**: Esegui regolarmente `npm run lint` e verifica la suite di diagnostici del modulo nella pagina delle Impostazioni prima di ogni rilascio.
