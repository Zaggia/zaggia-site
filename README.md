# Manhunt Italia

Caccia all'uomo nelle città italiane, giocata dal browser del telefono. App in italiano, inglese, spagnolo, francese e tedesco.

- **Mappa di tutta Italia** (OpenStreetMap, scurita con un filtro CSS). 41 città con zone pronte: a Roma Centro storico, Trastevere, Villa Borghese, Mura Aureliane, Colosseo; nelle altre un cerchio di 1 o 2 km attorno al centro. Si può anche usare "attorno a me" o disegnare la zona a mano. Durante la partita la mappa resta sulla città di gioco.
- **Zona di gioco** a cerchio o poligono disegnata dall'host, con restringimento opzionale nel tempo.
- **Posizioni live** di tutti i giocatori, filtrate per ruolo:
  - i cacciatori vedono le prede solo a intervalli ("segnale ogni N minuti", oppure in diretta);
  - chi esce dalla zona viene mostrato in diretta;
  - anche i cacciatori possono essere mostrati alle prede a intervalli ("segnale cacciatori ogni N minuti");
  - le prede ricevono un allarme quando un cacciatore è vicino;
  - arbitri e giocatori catturati vedono tutto.
- **Catture**: il pulsante appare al cacciatore quando è entro la distanza di cattura; la preda può anche arrendersi. La cattura è automatica: con un cacciatore entro la distanza di cattura per 3 secondi la preda viene presa da sola (il pulsante resta come riserva).
- **Kamikaze**: regola opzionale che esiste solo con più di 10 giocatori (arbitri esclusi); con meno non compare. Con più di 10 giocatori una preda a caso diventa kamikaze in segreto; il cacciatore che la prende viene eliminato. Se restano senza cacciatori vincono le prede.
- **Zone di interesse**: ogni 5 minuti (regolabile, 0 = mai) compare una zona di 40 m in un punto a caso della zona di gioco (se capita vicino ci arrivi, altrimenti no). Chi ci entra entro 40 s e ci resta 30 s di fila vince un bonus estratto a caso: invisibile per 3 segnali, vede i cacciatori per 1 minuto, radar a 300 m per 5 minuti, oppure 4 secondi in meno nella zona successiva (mai due volte di fila). Dentro la zona le prede sono visibili in diretta ai cacciatori; i cacciatori no.
- **Account esclusi dal ruolo di cacciatore**: un elenco nel codice (`NEVER_HUNTER_HASHES`, solo hash delle email) indica gli account che non diventano mai cacciatori, né a mano, né con "Ruoli a caso", né con l'infezione. Vale quando si crea o si entra in una partita dopo aver fatto l'accesso.
- **Account facoltativo** (nome, cognome, età, lingua, email, password): le password sono salvate solo come hash PBKDF2, dopo 5 tentativi sbagliati l'account si blocca per 10 minuti, si può eliminare dall'app. Nessuna email viene inviata. La lingua scelta nell'account diventa la lingua dell'app.
- Vantaggio iniziale, timer, modalità infezione, cronaca degli eventi, vibrazione, schermo sempre acceso, installabile come app.

## Come funziona

```
public/                 frontend statico (HTML, CSS, JS, Leaflet incluso)
  geo.js                geometria e città, condivise tra browser e server
  i18n.js               traduzioni (it, en, es, fr, de)
netlify/functions/api.mts   API /api/:action (create, join, sync, config, start, catch, ...); gli errori e gli eventi viaggiano come codici
scripts/dev.mjs         server locale con emulatore di Netlify Blobs
```

Lo stato vive in Netlify Blobs (partite, `u/…` account, `s/…` sessioni). Ogni giocatore scrive solo la propria chiave (`g/{codice}/p/{id}`), l'host solo la configurazione (`g/{codice}/game`), le catture sono chiavi create una volta (`g/{codice}/c/{id}`), così come le zone di interesse (`g/{codice}/z/{n}`); i bonus vivono nella chiave del giocatore che li vince. I client fanno `sync` ogni 3,5 secondi inviando la propria posizione e ricevendo lo stato già filtrato per ruolo: le posizioni nascoste non lasciano mai il server. Le partite si cancellano dopo 24 ore.

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
