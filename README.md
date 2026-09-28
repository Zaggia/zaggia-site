# Residenza — sito in anteprima

Sito vetrina per **Residenza**, affittacamere in Viale delle Provincie 116 (interno 1, primo piano), 00162 Roma — quartiere Nomentano, a 5 minuti a piedi dalla metro B Bologna.

Sito statico, senza build: `index.html` + `css/style.css` + `js/main.js`. Basta aprire `index.html` nel browser o pubblicare la cartella (GitHub Pages, Netlify, Vercel…).

## Esperienza

| Sezione | Idea |
| --- | --- |
| Preloader | Un portone bianco a due ante con la scritta *Residenza*; il caricamento conta in numeri romani (I → C), poi le ante si aprono in 3D. |
| Ingresso | Un tunnel di **sei archi** (uno per camera) su pavimento in travertino. Scorrendo si cammina attraverso gli archi; l'ultimo si apre a tutto schermo sulla camera. |
| I · La casa | Frase che si accende parola per parola; carte che ruotano in 3D dai numeri romani ai numeri reali (VI → 6 camere, D → 500 m dalla metro…). |
| II · Le camere | Anello 3D di sei carte ad arco, guidato dallo scroll e trascinabile. |
| Servizi | Icone disegnate a tratto che si animano, card con inclinazione 3D. |
| III · Il quartiere | Mappa schematica della linea B su un piano 3D inclinato: dalla porta alla metro Bologna e poi al Colosseo (5 fermate, senza cambi). Mappa Google in scala di grigi. |
| IV · Gli ospiti | Mazzo di recensioni in 3D (clic, swipe o frecce). |
| V · Informazioni | Check-in/out, indirizzo, regole. |
| VI · La chiave | Portachiavi d'albergo in 3D che oscilla come un pendolo seguendo il cursore; pulsanti di prenotazione. |

Rispetta `prefers-reduced-motion` (niente preloader né tunnel animato), funziona su mobile e resta leggibile anche senza JavaScript.

## Informazioni usate (fonti pubbliche)

- Indirizzo, 6 camere, camere matrimoniali rinnovate con bagno privato, aria condizionata, riscaldamento, TV satellitare, bollitore, frigorifero, scrivania, Wi‑Fi gratuito, struttura non fumatori, parcheggio non disponibile.
- Check-in 12:30–21:00, check-out entro le 10:30.
- Distanze: metro B Bologna 500 m / 5 min, metro Tiburtina 12 min, stazione Tiburtina 1,1 km, La Sapienza 17 min, Termini 2,1 km, Ciampino 24 km.
- Voto 8/10 su Booking.com, 5/5 su Tripadvisor; le citazioni sono estratti di recensioni pubbliche tradotti e adattati.

**Da confermare con la struttura:** telefono, e-mail/WhatsApp (non inseriti perché non verificati) e i testi prima della pubblicazione.

## Sostituire le foto

Le immagini attuali sono **dimostrative** (Unsplash). Per usare le foto reali (es. da Booking.com, con il consenso della struttura) basta salvarle nella cartella `img/` con questi nomi: il sito le usa automaticamente al posto di quelle dimostrative.

| File | Dove appare |
| --- | --- |
| `img/hero.jpg` | Dentro l'ultimo arco e a tutto schermo alla fine dell'ingresso |
| `img/residenza.jpg` | Foto grande nella sezione "La casa" |
| `img/camera-1.jpg` … `img/camera-6.jpg` | Le sei carte dell'anello "Le camere" (riposo, vista, bagno, clima, pausa, tempo) |

Formato consigliato: JPG orizzontale ≥ 1600 px per `hero.jpg` e `residenza.jpg`, verticale ≥ 900 px per le camere.

## Prima della pubblicazione ufficiale

- Togliere `<meta name="robots" content="noindex, nofollow">` da `index.html`.
- Togliere la dicitura "Anteprima del sito · immagini dimostrative" nel footer.
- Aggiungere contatti diretti (telefono / WhatsApp / e-mail).
