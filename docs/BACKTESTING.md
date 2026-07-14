# BACKTESTING.md

Questo documento illustra il funzionamento pratico, le metriche statistiche e l'architettura operativa del motore di backtesting in **Pronostici**.

---

## 1. INTRODUZIONE AL BACKTESTING CRONOLOGICO

Il backtesting simula storicamente le performance dei modelli predittivi su una serie di partite reali già disputate in passato. 
Per garantire che il backtest sia scientificamente accurato, il motore adotta un approccio **strettamente cronologico**:
1. Ordina deterministicamente tutte le partite candidate per data e ora.
2. Per ogni partita, isola e utilizza esclusivamente dati storici precedenti alla data della partita stessa per evitare il **data leakage**.
3. Calcola i parametri statistici ed esegue il pronostico.
4. Confronta il pronostico con l'esito reale e assegna le metriche di accuratezza.

---

## 2. PARAMETRI DI CONFIGURAZIONE DEL BACKTEST

*   **Competizione**: La lega calcistica su cui eseguire la simulazione (es. Serie A, Premier League).
*   **Intervallo Temporale (Data Inizio / Fine)**: Filtra le partite su cui formulare previsioni.
*   **Modelli Predittivi**: È possibile selezionare più modelli contemporaneamente per eseguire un confronto testa-testa parallelo.
*   **Minimum Matches (Partite Minime)**: Il numero minimo di partite storiche necessarie per ciascun team prima di consentire al modello di formulare una previsione. Se i dati sono inferiori, il match viene catalogato come "skipped" (o inserito con dati insufficienti se l'opzione apposita è abilitata).
*   **Last Matches (Finestra Temporale)**: Determina se calcolare le statistiche sull'intero storico del campionato o solo sugli ultimi $N$ match giocati.
*   **Batch Size (Dimensione Batch)**: Numero di partite elaborate in ciascun blocco di esecuzione prima di persistere i risultati su IndexedDB e salvare il checkpoint.

---

## 3. METRICHE STATISTICHE DI PERFORMANCE EVALUATION

Il motore calcola ed aggrega esclusivamente metriche di performance statistica:

### A. Accuratezza 1X2 (%)
La percentuale di partite in cui il segno con la probabilità più alta (Home Win, Draw, o Away Win) coincide con il risultato finale reale del match.

### B. Brier Score
Misura l'accuratezza delle probabilità assegnate ai tre possibili esiti (1-X-2). Calcola l'errore quadratico medio tra le probabilità stimate e il risultato reale (vettore binario di verità):

$$BS = \frac{1}{N} \sum_{i=1}^N \sum_{j=1}^C (p_{ij} - o_{ij})^2$$

Dove $p_{ij}$ è la probabilità stimata per l'esito $j$ e $o_{ij}$ è 1 se l'esito $j$ si è verificato, altrimenti 0. Un valore vicino a **0** indica un modello perfetto.

### C. Log Loss (Perdita Logaritmica)
Assegna una forte penalità a previsioni errate formulate con alta confidenza. Calcola l'opposto del logaritmo naturale della probabilità assegnata all'esito che si è effettivamente verificato:

$$LL = -\ln(p_{\text{esito reale}})$$

### D. Errore Assoluto Medio dei Gol (Goal Error)
La differenza media in valore assoluto tra i gol reali segnati e i gol attesi stimati dal modello per il team di casa, ospite e complessivi.

---

## 4. COSA NON FA ANCORA IL MOTORE DI BACKTESTING

Attualmente, il motore di backtesting **non include** e **non calcola** metriche di tipo finanziario o di mercato. Di conseguenza, le seguenti funzionalità non fanno ancora parte del motore:
- **ROI / Yield / Drawdown** (Rendimento degli investimenti)
- **Quote Analysis** (Caricamento e analisi delle quote storiche dei bookmaker)
- **Value Betting** (Calcolo del valore atteso rispetto alle quote di mercato)

Queste funzionalità saranno sviluppate e integrate in una fase successiva.
