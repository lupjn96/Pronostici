# Football Prediction Lab - Progetto e Roadmap

Questo documento descrive l'architettura, le fasi evolutive e gli obiettivi futuri di **Football Prediction Lab**, un laboratorio avanzato per la simulazione e predizione dei risultati delle partite di calcio.

---

## Stato Attuale ed Evoluzione dell'Architettura

### Fase 1: Motore Matematico di Base (Completato)
- **Modello di Poisson Standard (v1.1.0)**: Algoritmo classico basato sulle distribuzioni di Poisson indipendenti per stimare le probabilità degli esiti 1-X-2, Under/Over e Goal/NoGoal.
- **Modello Poisson-Gamma Empirico (v0.1.0)**: Estensione bayesiana/empirica che modella l'incertezza sul parametro di intensità ($\lambda$) utilizzando la distribuzione Gamma basata sul volume dei dati storici disponibili (partite giocate).
- **Interfaccia Utente e Storico**: Form per l'inserimento manuale dei dati, calcolo interattivo e persistenza locale (`localStorage`) con gestione di esportazione/importazione e pulizia selettiva dei pronostici salvati.

### Fase 2: Football Data Engine Indipendente (Completato)
- **Separazione dei Livelli**: Creazione di un livello intermedio indipendente tra l'input (UI, file, database o API) e i modelli predittivi.
- **DataNormalizer**: Classe per la sanificazione automatica e il clipping di sicurezza dei dati per prevenire errori numerici (`NaN`, `Infinity`, valori negativi).
- **FeatureBuilder**: Componente di estrazione delle caratteristiche fondamentali (`MatchFeatures`), traducendo i dati grezzi in un formato astratto standardizzato.
- **FootballDataEngine**: Classe principale che centralizza il flusso di dati, orchestrando caricamento, normalizzazione, estrazione delle caratteristiche e validazione integrata.
- **Vantaggi**: Gli algoritmi futuri non leggono più i moduli grezzi, ma consumano esclusivamente le `MatchFeatures` fornite dall'Engine. Questo rende l'intero nucleo matematico isolato e pronto a integrazioni multiple senza modificare gli algoritmi di calcolo.

---

## Roadmap delle Fasi Future

### Fase 3: Integrazione di Fonti Esterne (API & Database)
- **Integrazione API Sportive**: Collegamento automatico a provider di dati (es. API-Football, Football-Data.org) per popolare automaticamente le medie storiche dei team in base al campionato selezionato.
- **Integrazione Database (Cloud SQL/PostgreSQL)**: Persistenza centralizzata delle partite giocate, campionati e statistiche di squadre storiche per consentire calcoli su grandi moli di dati.
- **Web Scraping & CSV Import**: Funzionalità avanzate per caricare file storici di statistiche in formato CSV o recuperare classifiche tramite scraping sicuro.

### Fase 4: Modellazione Matematica Avanzata
- **Metriche xG (Expected Goals)**: Supporto nativo per metriche di Expected Goals di alta precisione basate sui tiri, differenziando i gol reali dalla qualità delle occasioni create.
- **Modellazione Temporale (Decadimento del Tempo)**: Applicazione di pesi decrescenti nel tempo (time-decay) per dare maggiore importanza alle partite più recenti rispetto all'inizio del campionato.
- **Modelli Bivariati di Poisson**: Correzione per tener conto della correlazione tra i gol segnati dalla squadra di casa e quelli della squadra ospite (es. modello di Dixon-Coles per correggere la sotto-stima dei pareggi a bassi punteggi).

### Fase 5: Integrazione delle Quote e Value Betting
- **Confronto con le Quote dei Bookmaker**: Caricamento in tempo reale delle quote di mercato (1-X-2, Under/Over, Goal/NoGoal) tramite API o manuale.
- **Value Bet Finder**: Algoritmo automatico che identifica le "scommesse di valore" confrontando le probabilità stimate dai modelli interni del Lab con le probabilità implicite dei bookmaker:
  $$\text{Value} = (\text{Probabilità Stimata} \times \text{Quota}) - 100\%$$
- **Gestione del Bankroll (Criterio di Kelly)**: Integrazione di calcolatori Kelly per ottimizzare la gestione delle puntate in base al vantaggio percentuale calcolato.

---

## Linee Guida di Manutenzione del Codice
1. **Integrità Matematica**: Non alterare le formule distributive in `poissonEngine.ts` o `poissonGammaEngine.ts` senza validarle prima tramite la suite di test diagnostici.
2. **Astrazione dell'Engine**: Qualsiasi nuovo tipo di sorgente dati (CSV, API) deve essere implementato all'interno di `FootballDataEngine.ts` o ereditando la sua struttura, senza mai esporre dati non sanitizzati agli algoritmi.
3. **Validazione Continua**: Esegui regolarmente `npm run lint` e verifica la suite di diagnostici del modulo nella pagina delle Impostazioni prima di ogni rilascio.
