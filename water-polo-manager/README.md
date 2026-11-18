# Water Polo Manager — The Road to Glory

![Water Polo Manager](brand/logo-mark-512.png)

Gestionale di pallanuoto giocabile nel browser. Sei il presidente di una piccola società in **Serie C** e devi costruire una dinastia: promozioni, coppe nazionali, coppe europee. Tutto in italiano.

## Cosa c'è nel gioco

- **Creazione della società**: nome, abbreviazione, città, colori, stemma (forma, motivo, simbolo), piscina, anno di fondazione, tifosi, obiettivo e difficoltà (Facile, Normale, Difficile, Leggenda). La rosa iniziale è davvero debole (overall 25-50, nessun campione nascosto).
- **Società reali**: tutte le squadre sono club veri. Serie A1 (14, da Pro Recco a Roma Vis Nova), Serie A2 (girone Nord e Sud da 12), Serie B (4 gironi da 10) e Serie C (4 gironi geografici da 10, la tua società compresa), più 40 club europei reali per le coppe LEN (Ferencváros, Novi Beograd, Jug Dubrovnik, Barceloneta, Olympiacos…). Gli elenchi sono in `src/engine/data/realClubs.ts`: la composizione di A1/A2 segue la stagione 2025/26, quella di B e C è indicativa e si modifica lì. I giocatori, gli allenatori e gli stemmi sono invece inventati.
- **Giocatori reali**: 36 società (tutte le 14 di Serie A1, 8 di A2, 2 di B e 12 club europei) schierano i loro giocatori veri, con nome, nazionalità, ruolo, numero di calottina e, dove disponibile, anno di nascita, ricavati dalla sezione "Rosa" più recente delle loro voci su Wikipedia (`src/engine/data/realPlayers.ts`, con la fonte di ogni rosa). Le caratteristiche tecniche sono stimate dal gioco: chi ha una propria voce enciclopedica (nazionali, olimpionici) parte più forte. Per le società senza una rosa pubblica (quasi tutta la B e la C) e per il tuo club appena fondato i giocatori sono generati.
- **Rose da 15 in ogni categoria**, senza limite di stranieri: ogni squadra, dalla A1 alla C, tessera esattamente 15 giocatori (2 portieri, 2 centroboa, 2 difensori, 2 centrovasca, 2 mancini, 3 ali, 2 universali). Le società AI restano sempre a quota 15; tu non puoi superare il limite e prima di ogni partita ufficiale la lista deve essere in regola (con il pulsante «Completa la rosa» per i casi urgenti). Il limite è una regola del mondo (`rosterSize`), modificabile.
- **Ruoli della pallanuoto**: portiere, centroboa (BOA), difensore/marcatore del centroboa (DIF), centrovasca (CV), mancino (MAN, sempre di sinistro), ala, universale. In acqua si gioca con le posizioni numerate 1-6 (1 ala destra, 2 lato destro, 3 centrovasca, 4 lato sinistro, 5 ala sinistra, 6 centroboa); i mancini rendono meglio a destra e in difesa il centroboa avversario è marcato da chi ha le migliori doti difensive.
- **Regolamenti configurabili** (salvati nella carriera, non cablati nel codice): gironi, punti, promozioni e retrocessioni dirette, playoff scudetto, playoff promozione, playout, Coppa Italia con teste di serie, Supercoppa, LEN Champions League (gironi + Final Four), Euro Cup e Challenger Cup (andata e ritorno), finestre di mercato, licenza nazionale.
- **Motore partita** possesso per possesso, deterministico (seed salvato): sprint, contropiedi, palle perse, espulsioni temporanee, superiorità e inferiorità numerica, rigori, tre falli gravi, brutalità, infortuni, fatica, cambi, time-out, rigori finali e confronti andata/ritorno. Le probabilità dipendono da caratteristiche dei giocatori in acqua, posizione e mano preferita, energia, morale, forma, affiatamento, allenatore, tattiche e familiarità con esse, fattore campo e importanza della partita.
- **Minutaggio dei panchinari**: dalla Formazione scegli quanti minuti deve giocare ogni riserva (o lasci il consigliato, basato su quanto si aspetta il giocatore). L'allenatore li fa entrare e uscire a gioco fermo anche quando simuli la partita; chi gioca molto meno di quanto si aspetta si scontenta.
- **Risultati realistici**: come nella pallanuoto vera la qualità decide quasi sempre. Con grandi differenze di forza il favorito vince quasi sempre (le prime di un girone con le ultime: oltre il 95%), mentre tra squadre vicine in classifica l'esito è aperto e la più debole può spuntarla (a 2-4 punti di forza di distanza vince circa una volta su tre). Il peso della qualità è regolato da `SKILL_LINEAR`, `SKILL_CONVEX` e `DAY_FORM_SD` (forma del giorno) in `src/engine/match/engine.ts`; la forza delle società è distribuita in modo che ogni girone abbia squadre forti, medie e deboli.
- **Carriere già salvate**: all'apertura vengono aggiornate da sole (versione 4): le società inventate prendono l'identità di società reali della stessa categoria, quelle con una rosa pubblica schierano i giocatori veri (con la forza di squadra di prima; gli inventati sostituiti si ritirano), le forze di A2, B e C vengono rimescolate e allargate per avere gironi con squadre forti e deboli; la tua squadra e i tuoi giocatori restano come sono; le regole su risultati, infortuni, eventi e stranieri valgono subito perché sono nel motore di gioco.
- **Eventi imprevisti rari**: i guasti alla piscina e il caro energia sono rari (ogni diversi anni, quasi mai con impianti recenti) e non si susseguono; i guasti sono di tipo diverso (pompa, filtri, perdite, riscaldamento).
- **Cronaca**: risultato immediato, simulazione veloce o cronaca interattiva con cambi, tattiche e time-out durante la gara; tabellino con voti, migliore in acqua e statistiche complete.
- **Tattiche**: 8 sistemi offensivi e 7 difensivi con vantaggi e svantaggi reali, superiorità (4-2/3-3, circolazione, strategia, tiratori designati) e inferiorità (stili, marcatura speciale). Le tattiche avanzate si sbloccano con la capacità organizzativa (allenatore, vice, centro di allenamento, intelligenza tattica della rosa, esperienza della società) e vanno imparate (familiarità).
- **Giocatori**: 31 caratteristiche (tecniche, fisiche, mentali, da portiere), overall pesato per ruolo, potenziale stimato dagli osservatori, personalità, crescita e declino con l'età, allenamento individuale, infortuni rari e per lo più brevi (come nella pallanuoto vera), recupero fisico rapido, squalifiche, morale, richieste di minutaggio, promesse.
- **Mercato**: ricerca, osservati, osservatori in missione, offerte e controfferte, trattativa dell'ingaggio, prestiti, svincoli, rinnovi, offerte dei club AI per i tuoi giocatori. I giocatori da categoria superiore scendono malvolentieri.
- **Economia**: sponsor con obiettivi, bonus e malus; biglietti e abbonamenti con prezzi regolabili; merchandising; scuola nuoto; contributi; premi; stipendi settimanali, staff, piscina, trasferte, manutenzione, interessi; fido bancario, prestiti, investimenti del presidente; stipendi arretrati, penalizzazioni, giocatori in mora e fallimento.
- **Strutture** (7, livelli 1-5) con effetti concreti e **livello di sviluppo della società** che sblocca i livelli più alti.
- **Settore giovanile** con ingresso annuale di ragazzi: qualità legata al vivaio e al responsabile; raramente nasce un fuoriclasse.
- **AI delle società**: mercato, rinnovi entro budget, esoneri e nuovi allenatori, staff, strutture, mecenati e crisi societarie, scelte tattiche in base a rosa e avversario.
- **Eventi e decisioni presidenziali** con conseguenze reali (il miglior giocatore vuole andarsene, sponsor che si ritira, allenatore sotto pressione, offerta di acquisizione, guasti alla piscina, contestazioni, stipendi arretrati, tornei estivi…).
- **Ciclo stagionale**: mercato estivo, precampionato, campionato, mercato invernale, playoff e playout, verdetti, premi, invecchiamento, ritiri, nuova stagione. Storia del club, albo d'oro, leggende.
- **Illustrazioni 2D** generate con l'AI di Canva in uno stile unico (menu, dashboard, strutture, mercato, staff, vivaio, partite, coppe, fine stagione): `src/assets/art/`.
- **Più intuitivo**: navigazione raggruppata (Squadra, Gare, Società), pannello "Da fare adesso" con le prossime mosse utili, guida rapida al primo avvio (riapribile con "?"), spiegazioni contestuali.
- **Identità visiva**: logo del gioco (scudo con pallone giallo-blu che emerge dall'acqua e le tre stelle della "road to glory"), favicon e kit grafico in [`brand/`](brand/BRAND.md); ogni società ha stemma generato nei suoi colori e le tre calottine regolamentari (scura, chiara, rossa del portiere).
- **Account e cloud** (facoltativi): con email e password le carriere si salvano anche online (funzione Netlify `netlify/functions/pallanuoto.mts`, Netlify Blobs) e si riprendono da un altro computer o dal telefono. Se la stessa carriera viene giocata su due dispositivi, il gioco lo rileva e fa scegliere quale versione tenere. Password con PBKDF2, blocco dopo 5 tentativi sbagliati, nessuna email inviata, account eliminabile con tutti i dati. Prova di integrazione: `npm run test:pallanuoto` (dalla radice del repository).
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
npm run brand        # rigenera favicon e loghi SVG da src/ui/brand.ts
```

Requisiti: Node 20+.
