/* Editable content. Photos live in assets/photos/; missing ones fall back to an illustration. */
window.SITE = {
  photos: {
    mose: 'assets/photos/camera-mose.jpg',
    scala: 'assets/photos/camera-scala.jpg',
    statua: 'assets/photos/camera-statua.jpg',
    bagnoCamera: 'assets/photos/bagno-camera.jpg',
    bagno: 'assets/photos/bagno.jpg',
    twin: 'assets/photos/camera-twin.jpg',
    lavabo: 'assets/photos/bagno-lavabo.jpg',
    mensole: 'assets/photos/camera-mensole.jpg',
    armadio: 'assets/photos/camera-armadio.jpg',
    terrazza: 'assets/photos/terrazza.jpg',
    singola: 'assets/photos/camera-singola.jpg',
    colazione: 'assets/photos/colazione.jpg',
    facciata: 'assets/photos/facciata.jpg',
    colonnato: 'assets/photos/san-pietro.jpg',
    castel: 'assets/photos/castel-santangelo.jpg'
  },
  /* illustration used while a photo is missing */
  fallback: { mose: 'camera', scala: 'camera', statua: 'camera', bagnoCamera: 'bagno', lavabo: 'bagno', mensole: 'dettaglio', armadio: 'dettaglio' },

  hero: [
    { img: 'mose', pos: '68% 50%', cap: 'Camera con Balcone · il Mosè di Michelangelo' },
    { img: 'scala', pos: '50% 40%', cap: 'Camera Superior · la scala elicoidale' },
    { img: 'statua', pos: '50% 35%', cap: 'Camera Doppia · marmi antichi' },
    { img: 'twin', pos: '40% 50%', cap: 'Camera Twin · i cherubini' }
  ],

  rooms: [
    { id: 'balcone', img: 'mose', name: 'Camera con Balcone', tag: 'Doppia · balcone sul viale', guests: 2, bed: 'Letto matrimoniale', price: 140,
      text: 'Sopra il letto il Mosè di Michelangelo, davanti una portafinestra con balcone sul viale.', feats: ['Balcone', 'Vista città', 'Doccia a pioggia'] },
    { id: 'superior', img: 'scala', name: 'Camera Superior', tag: 'Doppia · la più luminosa', guests: 2, bed: 'Letto matrimoniale', price: 150,
      text: 'Due finestre, parquet chiaro e la scala elicoidale dei Musei Vaticani a tutta parete.', feats: ['Molto luminosa', 'Parquet', 'Smart TV'] },
    { id: 'doppia', img: 'statua', name: 'Camera Doppia', tag: 'Doppia · letto matrimoniale', guests: 2, bed: 'Letto matrimoniale', price: 120,
      text: 'Un eroe di marmo veglia sul letto, tra lampade di piuma e comodini in ferro nero.', feats: ['Minibar', 'Cassaforte', 'Wi-Fi veloce'] },
    { id: 'twin', img: 'twin', name: 'Camera Twin', tag: 'Due letti singoli', guests: 2, bed: 'Due letti singoli', price: 115,
      text: 'Due letti, parquet chiaro e pareti di cherubini in bianco e azzurro. Perfetta per amici o colleghi.', feats: ['Due letti', 'Scrivania', 'Smart TV'] },
    { id: 'terrazza', img: 'terrazza', name: 'Camera con Terrazza', tag: 'Doppia · terrazza privata', guests: 2, bed: 'Letto matrimoniale', price: 160,
      text: 'Una terrazza tutta per voi sopra i tetti di Prati, per l’aperitivo al tramonto.', feats: ['Terrazza', 'Vista sui tetti', 'Doccia a pioggia'] },
    { id: 'singola', img: 'singola', name: 'Camera Singola', tag: 'Per chi viaggia da solo', guests: 1, bed: 'Letto singolo', price: 85,
      text: 'Compatta e silenziosa, con scrivania per lavorare tra una visita e l’altra.', feats: ['Scrivania', 'Cassaforte', 'Wi-Fi veloce'] }
  ],

  gallery: [
    { img: 'mose', cap: 'Camera con Balcone' },
    { img: 'scala', cap: 'Camera Superior' },
    { img: 'statua', cap: 'Camera Doppia' },
    { img: 'twin', cap: 'Camera Twin' },
    { img: 'bagnoCamera', cap: 'Dal bagno alla camera' },
    { img: 'bagno', cap: 'Doccia con piastrelle decorate' },
    { img: 'lavabo', cap: 'Il bagno privato' },
    { img: 'armadio', cap: 'Armadio e dettagli in legno' },
    { img: 'mensole', cap: 'Coperte e mensole a vista' },
    { img: 'terrazza', cap: 'La terrazza al tramonto' },
    { img: 'colonnato', cap: 'Il colonnato di San Pietro' },
    { img: 'castel', cap: 'Castel Sant’Angelo sul Tevere' }
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
