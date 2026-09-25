// ─────────────────────────────────────────────────────────────────────────
//  TUTTI I DATI DEL LOCALE IN UN SOLO POSTO.
//  Modifica qui orari, telefoni, gusti e fritti: il sito si aggiorna da solo.
//  Le voci segnate "DA VERIFICARE" vanno confermate con il titolare.
// ─────────────────────────────────────────────────────────────────────────

export const BUSINESS = {
  name: 'Pizza ART',
  tagline: "L'arte della pizza al taglio",
  address: 'Piazza Giovenale, 9',
  cap: '00136',
  city: 'Roma',
  zone: 'Balduina · Monte Mario',
  phone: '06 6456 0323',
  phoneHref: 'tel:+390664560323',
  mobile: '346 183 0803',
  mobileHref: 'tel:+393461830803',
  // DA VERIFICARE: il numero cellulare è attivo su WhatsApp?
  whatsapp: '393461830803',
  mapsUrl: 'https://maps.app.goo.gl/K39PojjyiE7bgwih9',
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Pizza+Art+Piazza+Giovenale+9+00136+Roma',
  mapEmbed: 'https://www.google.com/maps?q=Pizza%20Art%2C%20Piazza%20Giovenale%209%2C%2000136%20Roma&output=embed',
  facebook: 'https://www.facebook.com/PizzaARTBalduina/',
  // Obbligatoria per legge sul sito di un'attività: inseriscila prima della pubblicazione.
  vat: '',
  credits: { name: '', url: '' },
};

// Orari (fuso Europe/Rome). 0 = domenica … 6 = sabato. DA VERIFICARE con il titolare
// (le fonti online indicano apertura tra le 8:00 e le 8:30, chiusura alle 22:00).
export const HOURS = {
  0: [['08:30', '22:00']],
  1: [['08:30', '22:00']],
  2: [['08:30', '22:00']],
  3: [['08:30', '22:00']],
  4: [['08:30', '22:00']],
  5: [['08:30', '22:00']],
  6: [['08:30', '22:00']],
};

export const DELIVERY = {
  from: '18:00',
  to: '22:00',
  ordersFrom: '17:00',
};

// "Le Opere": i gusti in galleria. `photo` = nome del file in src/assets/foto,
// `recipe` = composizione disegnata se la foto non c'è ancora.
export const OPERE = [
  {
    id: 'margherita',
    title: 'Margherita',
    notes: 'Pomodoro, fior di latte, basilico fresco, olio extravergine.',
    photo: 'hero-teglia',
    recipe: 'margherita',
  },
  {
    id: 'bianca',
    title: 'Pizza Bianca',
    notes: 'Olio buono, sale grosso, rosmarino. La più semplice, la più difficile.',
    photo: 'pizza-bianca',
    recipe: 'bianca',
  },
  {
    id: 'patate',
    title: 'Patate e Rosmarino',
    notes: 'Patate sottili, fior di latte, rosmarino. Croccante ai bordi.',
    photo: 'patate-rosmarino',
    recipe: 'patate',
  },
  {
    id: 'diavola',
    title: 'Diavola',
    notes: 'Pomodoro, fior di latte, salame piccante che si arriccia in forno.',
    photo: 'diavola',
    recipe: 'diavola',
  },
  {
    id: 'fiori',
    title: 'Fiori e Alici',
    notes: 'Fiori di zucca, alici, fior di latte. Un classico romano.',
    photo: 'fiori-alici',
    recipe: 'fiori',
  },
  {
    id: 'mortadella',
    title: 'Mortadella e Pistacchio',
    notes: 'Base bianca, mortadella, burrata e granella di pistacchio.',
    photo: 'mortadella-pistacchio',
    recipe: 'mortadella',
  },
];

export const FRITTI = [
  { name: 'Supplì classico', note: 'Riso al pomodoro, cuore di mozzarella filante' },
  { name: 'Crocchette di patate', note: 'Morbide dentro, dorate fuori' },
  { name: 'Olive ascolane', note: 'Ripiene e fritte al momento' },
  { name: 'Fiori di zucca', note: 'Con mozzarella e alici, in pastella' },
];

// Configuratore: ordine = ordine dei bottoni.
export const BUILDER_INGREDIENTS = [
  'sugo', 'mozzarella', 'basilico', 'patate', 'salame', 'funghi',
  'olive', 'fiori', 'alici', 'mortadella', 'pistacchio', 'rosmarino',
];

export const BUILDER_PRESETS = {
  Margherita: ['sugo', 'mozzarella', 'basilico'],
  Diavola: ['sugo', 'mozzarella', 'salame'],
  'Patate e rosmarino': ['mozzarella', 'patate', 'rosmarino'],
  'Fiori e alici': ['mozzarella', 'fiori', 'alici'],
  'Mortadella e pistacchio': ['mozzarella', 'mortadella', 'pistacchio'],
};

// Foto della galleria circolare "Dal forno".
export const RING = [
  { photo: 'forno', fallback: 'art:forno', alt: 'Teglia sfornata dal forno' },
  { photo: 'impasto', fallback: 'art:impasto', alt: 'Impasto steso a mano' },
  { photo: 'hero-teglia', fallback: 'slice:margherita', alt: 'Teglia di margherita' },
  { photo: 'supli', fallback: 'art:supli', alt: 'Supplì con mozzarella filante' },
  { photo: 'pizza-bianca', fallback: 'slice:bianca', alt: 'Pizza bianca con rosmarino' },
  { photo: 'fritti', fallback: 'art:fritti', alt: 'Cartoccio di fritti' },
  { photo: 'diavola', fallback: 'slice:diavola', alt: 'Trancio di diavola' },
  { photo: 'feste', fallback: 'art:feste', alt: 'Teglie per una festa' },
  { photo: 'patate-rosmarino', fallback: 'slice:patate', alt: 'Trancio patate e rosmarino' },
  { photo: 'consegna', fallback: 'art:consegna', alt: 'Consegna serale a domicilio' },
];
