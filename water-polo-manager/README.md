# Water Polo Manager

Gestionale di pallanuoto giocabile nel browser. Sei il presidente di una piccola società in **Serie C** e devi costruire una dinastia: promozioni, coppe nazionali, coppe europee. Tutto in italiano.

## Cosa c'è nel gioco

- **Creazione della società**: nome, abbreviazione, città, colori, stemma (forma, motivo, simbolo), piscina, anno di fondazione, tifosi, obiettivo e difficoltà (Facile, Normale, Difficile, Leggenda). La rosa iniziale è davvero debole (overall 25-50, nessun campione nascosto).
- **Mondo completo**: 126 società italiane (A1 14, A2 2×12, B 4×12, C 4×10 con gironi geografici) e 40 club esteri, ~3.700 pallanuotisti inventati, allenatori, staff, sponsor.
- **Regolamenti configurabili** (salvati nella carriera, non cablati nel codice): gironi, punti, promozioni e retrocessioni dirette, playoff scudetto, playoff promozione, playout, Coppa Italia con teste di serie, Supercoppa, LEN Champions League (gironi + Final Four), Euro Cup e Challenger Cup (andata e ritorno), finestre di mercato, licenza nazionale.
- **Motore partita** possesso per possesso, deterministico (seed salvato): sprint, contropiedi, palle perse, espulsioni temporanee, superiorità e inferiorità numerica, rigori, tre falli gravi, brutalità, infortuni, fatica, cambi, time-out, rigori finali e confronti andata/ritorno. Le probabilità dipendono da caratteristiche dei giocatori in acqua, posizione e mano preferita, energia, morale, forma, affiatamento, allenatore, tattiche e familiarità con esse, fattore campo e importanza della partita.
- **Cronaca**: risultato immediato, simulazione veloce o cronaca interattiva con cambi, tattiche e time-out durante la gara; tabellino con voti, migliore in acqua e statistiche complete.
- **Tattiche**: 8 sistemi offensivi e 7 difensivi con vantaggi e svantaggi reali, superiorità (4-2/3-3, circolazione, strategia, tiratori designati) e inferiorità (stili, marcatura speciale). Le tattiche avanzate si sbloccano con la capacità organizzativa (allenatore, vice, centro di allenamento, intelligenza tattica della rosa, esperienza della società) e vanno imparate (familiarità).
- **Giocatori**: 31 caratteristiche (tecniche, fisiche, mentali, da portiere), overall pesato per ruolo, potenziale stimato dagli osservatori, personalità, crescita e declino con l'età, allenamento individuale, infortuni, squalifiche, morale, richieste di minutaggio, promesse.
- **Mercato**: ricerca, osservati, osservatori in missione, offerte e controfferte, trattativa dell'ingaggio, prestiti, svincoli, rinnovi, offerte dei club AI per i tuoi giocatori. I giocatori da categoria superiore scendono malvolentieri.
- **Economia**: sponsor con obiettivi, bonus e malus; biglietti e abbonamenti con prezzi regolabili; merchandising; scuola nuoto; contributi; premi; stipendi settimanali, staff, piscina, trasferte, manutenzione, interessi; fido bancario, prestiti, investimenti del presidente; stipendi arretrati, penalizzazioni, giocatori in mora e fallimento.
- **Strutture** (7, livelli 1-5) con effetti concreti e **livello di sviluppo della società** che sblocca i livelli più alti.
- **Settore giovanile** con ingresso annuale di ragazzi: qualità legata al vivaio e al responsabile; raramente nasce un fuoriclasse.
- **AI delle società**: mercato, rinnovi entro budget, esoneri e nuovi allenatori, staff, strutture, mecenati e crisi societarie, scelte tattiche in base a rosa e avversario.
- **Eventi e decisioni presidenziali** con conseguenze reali (il miglior giocatore vuole andarsene, sponsor che si ritira, allenatore sotto pressione, offerta di acquisizione, guasti alla piscina, contestazioni, stipendi arretrati, tornei estivi…).
- **Ciclo stagionale**: mercato estivo, precampionato, campionato, mercato invernale, playoff e playout, verdetti, premi, invecchiamento, ritiri, nuova stagione. Storia del club, albo d'oro, leggende.
- **Salvataggi** automatici in IndexedDB: più carriere, carica, rinomina, elimina, esporta/importa su file. Il gioco riparte da dove l'avevi lasciato anche dopo la chiusura del browser.

## Architettura

```
src/engine/            logica di gioco, senza React (testabile in Node)
  types.ts             tipi del dominio (tutto serializzabile)
  rng.ts               generatore deterministico con stato salvato
  data/                nomi, città, regolamenti e difficoltà
  player/              caratteristiche, overall, generazione, sviluppo, valore
  club/                società, formazioni, strutture, gestione
  staff/ tactics/      allenatori, staff, tattiche e capacità organizzativa
  match/               motore partita, cronaca, setup e applicazione dei risultati
  competition/         calendari, classifiche, eliminazione diretta, postseason
  economy/ transfer/   finanze, sponsor, contratti, mercato
  ai/ events/          AI delle società, eventi casuali
  season/              ciclo giornaliero/settimanale, fine e inizio stagione
  world/               generazione del mondo e interrogazioni
src/store/game.ts      stato dell'app (zustand) e salvataggio automatico
src/db/saves.ts        persistenza IndexedDB
src/ui/                interfaccia React + Tailwind
src/test/              test del motore e simulazioni multi-stagione
```

## Sviluppo

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # test del motore (calibrazione, tattiche, 5 stagioni complete)
npm run build        # build in dist/
npm run build:site   # build in ../public/pallanuoto (pubblicata dal sito Netlify)
```

Requisiti: Node 20+.
