# Milizie 76 Gallery — concept del sito

Landing page di anteprima per **Milizie 76 Gallery**, guest house in Viale delle Milizie 76, Prati (Roma).

## Come vederla

- **Il modo più semplice:** apri `dist/milizie-76-anteprima.html` con un doppio clic. È un unico file che contiene tutto: librerie, font e immagini.
- **Dalla cartella del progetto:** `python3 -m http.server` e poi apri <http://localhost:8000>.

## Cosa c'è dentro

- Header con le camere in un arco romano, a dissolvenza con zoom lento.
- Camere in scorrimento orizzontale con card inclinabili in 3D e prezzo indicativo; cliccando una camera la si seleziona nel modulo di prenotazione.
- Galleria ad anello 3D da trascinare (mouse, touch o frecce) con lightbox.
- Mappa interattiva del quartiere con i tempi a piedi verso i luoghi vicini.
- Recensioni a mazzo di carte e punteggi animati.
- Modulo di prenotazione con calcolo della stima del soggiorno.
- Scroll fluido (Lenis), animazioni GSAP, cursore personalizzato, bottoni magnetici, supporto a `prefers-reduced-motion`.
- Caricamento rapido: la prima foto è nell'HTML, niente schermata di attesa, illustrazioni generate solo se servono.

## Foto

Il sito usa le foto della struttura; dove una foto manca mostra un'illustrazione generata nel browser. Come aggiungerne: `assets/photos/LEGGIMI.md`.

## Struttura

```
index.html          pagina
css/style.css       stile
js/content.js       testi, camere, luoghi, recensioni (modificabili)
js/plates.js        illustrazioni generate
js/main.js          interazioni e animazioni
vendor/             GSAP, ScrollTrigger, Lenis
fonts/              Bodoni Moda, Instrument Sans
assets/photos/      foto originali (JPG)
assets/img/         foto ottimizzate WebP generate da build.py
build.py            ottimizza le foto e genera dist/milizie-76-anteprima.html
```

Concept non ufficiale: prezzi e tempi a piedi sono indicativi.
