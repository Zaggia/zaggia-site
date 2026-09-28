# Residenza — sito in anteprima

Sito vetrina per **Residenza**, affittacamere in Viale delle Provincie 116 (interno 1, primo piano), 00162 Roma — quartiere Nomentano, a 5 minuti a piedi dalla metro B Bologna.

Sito statico in **un unico file**: `index.html` contiene HTML, CSS e JavaScript. Basta aprirlo nel browser o pubblicarlo così com'è (GitHub Pages, Netlify, Vercel…). Da internet carica solo i font Google, Lenis (smooth scroll, facoltativo) e le immagini dimostrative.

## Esperienza

| Sezione | Idea |
| --- | --- |
| Preloader | Un portone bianco a due ante con la scritta *Residenza*; il caricamento conta in numeri romani (I → C), poi le ante si aprono in 3D. |
| Ingresso | Un tunnel di **sei archi** (uno per camera) su pavimento in travertino. Scorrendo si cammina attraverso gli archi; l'ultimo si apre a tutto schermo sulla camera. |
| I · La casa | Frase che si accende parola per parola; carte che ruotano in 3D dai numeri romani ai numeri reali (VI → 6 camere, D → 500 m dalla metro…). |
| II · Le camere | Anello 3D con le sei camere (I–VI), guidato dallo scroll e trascinabile. Toccando una camera (o "Guarda la camera") si apre il visore a tutto schermo: galleria di foto, dotazioni della camera, passaggio alla camera precedente/successiva e pulsante "Richiedi questa camera". |
| III · Il quartiere | Mappa schematica della linea B su un piano 3D inclinato: dalla porta alla metro Bologna e poi al Colosseo (5 fermate, senza cambi). Pulsante "Apri in Google Maps". |
| IV · Gli ospiti | Mazzo di recensioni in 3D (clic, swipe o frecce). |
| V · Informazioni | Check-in/out, indirizzo, regole. |
| VI · La chiave | Modulo di prenotazione diretta su WhatsApp (nome, date, ospiti, camera, note) accanto al portachiavi d'albergo in 3D che oscilla seguendo il cursore. |

Rispetta `prefers-reduced-motion` (niente preloader né tunnel animato), funziona su mobile e resta leggibile anche senza JavaScript.

## Informazioni usate (fonti pubbliche)

- Indirizzo, 6 camere, camere matrimoniali rinnovate con bagno privato, aria condizionata, riscaldamento, TV satellitare, bollitore, frigorifero, scrivania, Wi‑Fi gratuito, struttura non fumatori, parcheggio non disponibile.
- Check-in 12:30–21:00, check-out entro le 10:30.
- Distanze: metro B Bologna 500 m / 5 min, metro Tiburtina 12 min, stazione Tiburtina 1,1 km, La Sapienza 17 min, Termini 2,1 km, Ciampino 24 km.
- Voto 8/10 su Booking.com, 5/5 su Tripadvisor; le citazioni sono estratti di recensioni pubbliche tradotti e adattati.

**Da confermare con la struttura:** numero WhatsApp (non trovato in fonti pubbliche), eventuali differenze tra le camere (es. quali hanno vista sulla città) e i testi prima della pubblicazione.

## Collegare WhatsApp

Il modulo compone il messaggio e apre WhatsApp. Per farlo arrivare alla struttura, inserire il numero nell'attributo `data-whatsapp` del modulo in `index.html` (cercare `id="bookForm"`), con prefisso internazionale e senza `+` né spazi:

```html
<form class="book" id="bookForm" ... data-whatsapp="393331234567">
```

Finché il numero è vuoto, WhatsApp si apre con il messaggio pronto e chiede a chi inviarlo.

## Sostituire le foto

Le immagini attuali sono **dimostrative** (Unsplash). Per usare le foto reali (es. da Booking.com, con il consenso della struttura) basta salvarle nella cartella `img/` con questi nomi: il sito le usa automaticamente al posto di quelle dimostrative.

| File | Dove appare |
| --- | --- |
| `img/hero.jpg` | Dentro l'ultimo arco e a tutto schermo alla fine dell'ingresso |
| `img/residenza.jpg` | Foto grande nella sezione "La casa" |
| `img/camera-1-1.jpg` … `img/camera-1-4.jpg` | Le 4 foto della Camera I (la prima è anche la copertina nell'anello) |
| `img/camera-2-1.jpg` … `img/camera-6-4.jpg` | Stesso schema per le camere II–VI |

Formato consigliato: JPG orizzontale ≥ 1600 px. Per avere più o meno di 4 foto in una camera, modificare l'elenco `data-photos` della relativa carta (`class="rcard"`) in `index.html`.

## Prima della pubblicazione ufficiale

- Togliere `<meta name="robots" content="noindex, nofollow">` da `index.html`.
- Togliere la dicitura "Anteprima del sito · immagini dimostrative" nel footer.
- Inserire il numero WhatsApp (vedi sopra) e le foto reali delle sei camere.
