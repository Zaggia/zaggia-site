# Manhunt Roma

Caccia all'uomo per le strade di Roma, giocata dal browser del telefono.

- **Mappa di Roma** (OpenStreetMap, scurita con un filtro CSS) con zone già pronte: Centro storico, Trastevere, Villa Borghese, Mura Aureliane, Colosseo.
- **Zona di gioco** a cerchio o poligono disegnata dall'host, con restringimento opzionale nel tempo.
- **Posizioni live** di tutti i giocatori, filtrate per ruolo:
  - i cacciatori vedono le prede solo a intervalli ("segnale ogni N minuti", oppure in diretta);
  - chi esce dalla zona viene mostrato in diretta;
  - anche i cacciatori possono essere mostrati alle prede a intervalli ("segnale cacciatori ogni N minuti");
  - le prede ricevono un allarme quando un cacciatore è vicino;
  - arbitri e giocatori catturati vedono tutto.
- **Catture**: il pulsante appare al cacciatore quando è entro la distanza di cattura; la preda può anche arrendersi. Con la regola "cattura automatica" la preda viene presa da sola dopo 5 secondi con un cacciatore entro la distanza.
- **Kamikaze**: regola opzionale. Con più di 10 giocatori una preda a caso diventa kamikaze in segreto; il cacciatore che la prende viene eliminato. Se restano senza cacciatori vincono le prede.
- **Account facoltativo** (nome, cognome, età, lingua, email, password): le password sono salvate solo come hash PBKDF2, dopo 5 tentativi sbagliati l'account si blocca per 10 minuti, si può eliminare dall'app. Nessuna email viene inviata. La lingua è salvata nel profilo, ma l'interfaccia per ora è solo in italiano.
- Vantaggio iniziale, timer, modalità infezione, cronaca degli eventi, vibrazione, schermo sempre acceso, installabile come app.

## Come funziona

```
public/                 frontend statico (HTML, CSS, JS, Leaflet incluso)
  geo.js                geometria condivisa tra browser e server
netlify/functions/api.mts   API /api/:action (create, join, sync, config, start, catch, ...)
scripts/dev.mjs         server locale con emulatore di Netlify Blobs
```

Lo stato vive in Netlify Blobs (partite, `u/…` account, `s/…` sessioni). Ogni giocatore scrive solo la propria chiave (`g/{codice}/p/{id}`), l'host solo la configurazione (`g/{codice}/game`), le catture sono chiavi create una volta (`g/{codice}/c/{id}`). I client fanno `sync` ogni 3,5 secondi inviando la propria posizione e ricevendo lo stato già filtrato per ruolo: le posizioni nascoste non lasciano mai il server. Le partite si cancellano dopo 24 ore.

## Sviluppo

```sh
npm install
npm run dev:local     # http://localhost:8888 (Node 22.18+)
# oppure
npm run dev           # netlify dev
```

La geolocalizzazione del browser funziona solo su `https` o `localhost`.

## Pubblicazione

Collega il repository a Netlify (publish directory `public`, nessun comando di build) oppure `netlify deploy --prod`. Non servono variabili d'ambiente.

## Limiti

Il browser aggiorna la posizione solo con l'app aperta: tenere lo schermo acceso (l'app lo chiede in automatico dove supportato).
