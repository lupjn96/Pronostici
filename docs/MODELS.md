# MODELS.md

Questo documento illustra la teoria matematica, la formulazione statistica e i dettagli di implementazione dei modelli predittivi inclusi nell'applicazione **Pronostici**.

---

## 1. MODELLO DI POISSON STANDARD

Il modello di Poisson standard assume che i gol segnati dalla squadra di casa ($X$) e dalla squadra ospite ($Y$) siano variabili casuali indipendenti che seguono una distribuzione di Poisson con parametri $\lambda$ (gol attesi casa) e $\mu$ (gol attesi ospite):

$$P(X = x) = \frac{\lambda^x e^{-\lambda}}{x!}, \quad P(Y = y) = \frac{\mu^y e^{-\mu}}{y!}$$

### Calcolo di $\lambda$ e $\mu$:
1.  **Attacco Casa ($Att_H$)**: Gol fatti in casa dal team ospitante divisi per la media del campionato dei gol fatti in casa.
2.  **Difesa Ospite ($Def_A$)**: Gol subiti fuori casa dal team ospite divisi per la media del campionato dei gol subiti fuori casa.
3.  **Forza Attacco Casa Corretta**:
    $$\lambda = Att_H \times Def_A \times \text{Media Gol Fatti Casa dal Campionato}$$
4.  La stessa formula speculare viene utilizzata per calcolare i gol attesi della squadra ospite ($\mu$).

---

## 2. MODELLO DI DIXON-COLES

Il modello di Dixon-Coles (pubblicato nel 1997 da Mark Dixon e Stuart Coles) risolve un limite noto del modello di Poisson standard: l'indipendenza tra i gol delle due squadre. Storicamente, a bassi punteggi (es. 0-0, 1-0, 0-1, 1-1), esiste una forte dipendenza dovuta a fattori tattici e psicologici.

Dixon-Coles introduce una funzione di correzione $\tau_{x,y}(\lambda, \mu, \rho)$ che modifica la probabilità congiunta per i punteggi più bassi:

$$P(X = x, Y = y) = \tau_{x,y} \times \frac{\lambda^x e^{-\lambda}}{x!} \times \frac{\mu^y e^{-\mu}}{y!}$$

La funzione $\tau_{x,y}$ è così definita:

$$\tau_{x,y} = \begin{cases} 
1 - \lambda \mu \rho & \text{se } x = 0, y = 0 \\
1 + \lambda \rho & \text{se } x = 0, y = 1 \\
1 + \mu \rho & \text{se } x = 1, y = 0 \\
1 - \rho & \text{se } x = 1, y = 1 \\
1 & \text{altrimenti}
\end{cases}$$

Dove $\rho$ rappresenta il parametro di associazione (correlazione) tra i gol delle due squadre.

---

## 3. MODELLO POISSON-GAMMA

Il modello Poisson-Gamma è un approccio Bayesiano in cui si assume che i parametri di attacco e difesa non siano costanti, ma siano essi stessi variabili casuali che seguono una distribuzione coniugata Gamma.

La distribuzione Gamma funge da "prior" per catturare l'incertezza sulla reale forza di una squadra. Man mano che vengono disputate nuove partite, la distribuzione dei parametri viene aggiornata integrando le nuove osservazioni (i gol effettivamente segnati o subiti), riducendo l'incertezza e stabilizzando le stime anche in presenza di dataset storici ridotti o di fluttuazioni temporanee.

### Vantaggi:
*   Minore sensibilità alle anomalie statistiche temporanee.
*   Eccellente convergenza probabilistica anche per campionati con dati storici limitati o frammentati.
