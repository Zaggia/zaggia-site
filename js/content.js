/* Editable content. To use real photos, save them in assets/photos/ with the names below. */
window.SITE = {
  photos: {
    terrazza: 'assets/photos/terrazza.jpg',
    camera: 'assets/photos/camera-balcone.jpg',
    twin: 'assets/photos/camera-twin.jpg',
    singola: 'assets/photos/camera-singola.jpg',
    bagno: 'assets/photos/bagno.jpg',
    colazione: 'assets/photos/colazione.jpg',
    dettaglio: 'assets/photos/dettaglio.jpg',
    facciata: 'assets/photos/facciata.jpg',
    colonnato: 'assets/photos/san-pietro.jpg',
    castel: 'assets/photos/castel-santangelo.jpg',
    cupola: 'assets/photos/cupola.jpg'
  },

  rooms: [
    { id: 'terrazza', plate: 'terrazza', name: 'Camera con Terrazza', tag: 'Doppia · terrazza privata', guests: 2, bed: 'Letto matrimoniale', price: 150,
      text: 'Una terrazza tutta per voi sopra i tetti di Prati, per l’aperitivo al tramonto.', feats: ['Terrazza', 'Vista sui tetti', 'Doccia a pioggia'] },
    { id: 'balcone', plate: 'camera', name: 'Camera con Balcone', tag: 'Doppia · vista città', guests: 2, bed: 'Letto matrimoniale', price: 130,
      text: 'Finestre alte, luce del mattino e un balcone affacciato sul viale.', feats: ['Balcone', 'Vista città', 'Piumino in piuma'] },
    { id: 'twin', plate: 'twin', name: 'Camera Twin', tag: 'Doppia o twin', guests: 2, bed: 'Due letti singoli o un matrimoniale', price: 115,
      text: 'Due letti che diventano uno quando serve. Ideale per amici o colleghi.', feats: ['Letti separabili', 'Scrivania', 'Smart TV'] },
    { id: 'singola', plate: 'singola', name: 'Camera Singola', tag: 'Per chi viaggia da solo', guests: 1, bed: 'Letto singolo', price: 85,
      text: 'Compatta e silenziosa, con scrivania per lavorare tra una visita e l’altra.', feats: ['Scrivania', 'Cassaforte', 'Wi-Fi veloce'] }
  ],

  gallery: [
    { plate: 'facciata', cap: 'Il palazzo al civico 76' },
    { plate: 'terrazza', cap: 'La terrazza al tramonto' },
    { plate: 'camera', cap: 'Camera con Balcone' },
    { plate: 'twin', cap: 'Camera Twin' },
    { plate: 'singola', cap: 'Camera Singola' },
    { plate: 'bagno', cap: 'Bagno con doccia a pioggia' },
    { plate: 'dettaglio', cap: 'Dettagli d’arredo' },
    { plate: 'colazione', cap: 'La colazione, dietro l’angolo' },
    { plate: 'colonnato', cap: 'Il colonnato di San Pietro' },
    { plate: 'castel', cap: 'Castel Sant’Angelo sul Tevere' }
  ],

  amenities: [
    ['ac', 'Aria condizionata', 'In ogni camera, regolabile'],
    ['wifi', 'Wi-Fi gratuito', 'Veloce in tutta la casa'],
    ['terrace', 'Terrazza', 'Per il sole e le sere d’estate'],
    ['lift', 'Ascensore', 'Anche con le valigie grandi'],
    ['clean', 'Pulizia giornaliera', 'Camere rifatte ogni giorno'],
    ['shower', 'Doccia a pioggia', 'Bagno privato e asciugacapelli'],
    ['fridge', 'Minibar e bollitore', 'Tè e caffè quando vuoi'],
    ['safe', 'Cassaforte', 'Per documenti e oggetti di valore'],
    ['tv', 'Smart TV', 'Schermo piatto in camera'],
    ['laundry', 'Lavanderia', 'Lavaggio e stiratura su richiesta'],
    ['ticket', 'Tour e biglietti', 'Ti aiutiamo a prenotare i Musei Vaticani'],
    ['key', 'Check-in rapido', 'Arrivo e partenza senza attese']
  ],

  places: [
    { id: 'ottaviano', name: 'Metro Ottaviano', sub: 'Linea A', walk: '5 min', x: 318, y: 332, c: [360, 330] },
    { id: 'cola', name: 'Via Cola di Rienzo', sub: 'Shopping', walk: '4 min', x: 452, y: 378, c: [440, 330] },
    { id: 'musei', name: 'Musei Vaticani', sub: 'Cappella Sistina', walk: '15 min', x: 150, y: 322, c: [280, 280] },
    { id: 'sanpietro', name: 'Piazza San Pietro', sub: '1,3 km', walk: '16 min', x: 214, y: 470, c: [300, 420] },
    { id: 'castel', name: 'Castel Sant’Angelo', sub: '1,7 km', walk: '21 min', x: 486, y: 540, c: [470, 420] },
    { id: 'popolo', name: 'Piazza del Popolo', sub: 'Oltre il Tevere', walk: '24 min', x: 712, y: 330, c: [560, 250] }
  ],

  quotes: [
    { t: 'Personale gentilissimo e disponibile: fanno di tutto per rendere il soggiorno perfetto.', k: 'Accoglienza' },
    { t: 'Tutto era davvero pulito.', k: 'Pulizia' },
    { t: 'Pulitissimo, ordinato e curato in ogni dettaglio.', k: 'Cura' },
    { t: 'Michela e sua figlia sono persone gentilissime e accoglienti.', k: 'Padrone di casa' }
  ]
};
