// Nazionalità e nomi inventati per la generazione dei pallanuotisti e degli staff.

export interface Nation {
  code: string;
  name: string;
  flag: string;
  /** Peso nella generazione di giocatori stranieri (scuole forti = più giocatori). */
  weight: number;
  /** Livello medio della scuola pallanuotistica (bonus al talento). */
  school: number;
}

export const NATIONS: Record<string, Nation> = {
  ITA: { code: 'ITA', name: 'Italia', flag: '🇮🇹', weight: 0, school: 3 },
  HUN: { code: 'HUN', name: 'Ungheria', flag: '🇭🇺', weight: 10, school: 4 },
  SRB: { code: 'SRB', name: 'Serbia', flag: '🇷🇸', weight: 10, school: 4 },
  CRO: { code: 'CRO', name: 'Croazia', flag: '🇭🇷', weight: 9, school: 4 },
  ESP: { code: 'ESP', name: 'Spagna', flag: '🇪🇸', weight: 8, school: 3 },
  GRE: { code: 'GRE', name: 'Grecia', flag: '🇬🇷', weight: 8, school: 3 },
  MNE: { code: 'MNE', name: 'Montenegro', flag: '🇲🇪', weight: 6, school: 4 },
  FRA: { code: 'FRA', name: 'Francia', flag: '🇫🇷', weight: 4, school: 1 },
  GER: { code: 'GER', name: 'Germania', flag: '🇩🇪', weight: 3, school: 1 },
  ROU: { code: 'ROU', name: 'Romania', flag: '🇷🇴', weight: 3, school: 1 },
  NED: { code: 'NED', name: 'Paesi Bassi', flag: '🇳🇱', weight: 2, school: 1 },
  USA: { code: 'USA', name: 'Stati Uniti', flag: '🇺🇸', weight: 4, school: 2 },
  AUS: { code: 'AUS', name: 'Australia', flag: '🇦🇺', weight: 4, school: 2 },
  BRA: { code: 'BRA', name: 'Brasile', flag: '🇧🇷', weight: 2, school: 0 },
  GEO: { code: 'GEO', name: 'Georgia', flag: '🇬🇪', weight: 2, school: 1 },
  TUR: { code: 'TUR', name: 'Turchia', flag: '🇹🇷', weight: 1, school: 0 },
  MLT: { code: 'MLT', name: 'Malta', flag: '🇲🇹', weight: 1, school: 0 },
  JPN: { code: 'JPN', name: 'Giappone', flag: '🇯🇵', weight: 2, school: 1 },
  CAN: { code: 'CAN', name: 'Canada', flag: '🇨🇦', weight: 1, school: 1 },
  ARG: { code: 'ARG', name: 'Argentina', flag: '🇦🇷', weight: 1, school: 0 },
  // Nazionalità presenti solo nelle rose reali (non usate per generare nuovi giocatori).
  RUS: { code: 'RUS', name: 'Russia', flag: '🇷🇺', weight: 0, school: 2 },
  SVK: { code: 'SVK', name: 'Slovacchia', flag: '🇸🇰', weight: 0, school: 1 },
  SVN: { code: 'SVN', name: 'Slovenia', flag: '🇸🇮', weight: 0, school: 1 },
  UKR: { code: 'UKR', name: 'Ucraina', flag: '🇺🇦', weight: 0, school: 1 },
  ARM: { code: 'ARM', name: 'Armenia', flag: '🇦🇲', weight: 0, school: 0 },
  BUL: { code: 'BUL', name: 'Bulgaria', flag: '🇧🇬', weight: 0, school: 0 },
  BLR: { code: 'BLR', name: 'Bielorussia', flag: '🇧🇾', weight: 0, school: 0 },
  ISR: { code: 'ISR', name: 'Israele', flag: '🇮🇱', weight: 0, school: 0 },
  AUT: { code: 'AUT', name: 'Austria', flag: '🇦🇹', weight: 0, school: 0 },
  GBR: { code: 'GBR', name: 'Gran Bretagna', flag: '🇬🇧', weight: 0, school: 0 },
  CZE: { code: 'CZE', name: 'Repubblica Ceca', flag: '🇨🇿', weight: 0, school: 0 },
};

type Pool = { first: string[]; last: string[] };

const ITA: Pool = {
  first: [
    'Alessandro', 'Andrea', 'Antonio', 'Alberto', 'Alessio', 'Angelo', 'Arturo', 'Bruno', 'Carlo', 'Christian', 'Claudio',
    'Cristiano', 'Daniele', 'Dario', 'Davide', 'Diego', 'Domenico', 'Edoardo', 'Elia', 'Emanuele', 'Enrico', 'Ettore',
    'Fabio', 'Fabrizio', 'Federico', 'Filippo', 'Francesco', 'Gabriele', 'Giacomo', 'Gianluca', 'Gianmarco', 'Giorgio',
    'Giovanni', 'Giulio', 'Giuseppe', 'Guido', 'Jacopo', 'Leonardo', 'Lorenzo', 'Luca', 'Luigi', 'Manuel', 'Marco',
    'Mario', 'Massimo', 'Matteo', 'Mattia', 'Maurizio', 'Michele', 'Mirko', 'Nicola', 'Nicolò', 'Paolo', 'Pietro',
    'Raffaele', 'Riccardo', 'Roberto', 'Salvatore', 'Samuele', 'Simone', 'Stefano', 'Tommaso', 'Umberto', 'Valerio',
    'Vincenzo', 'Vittorio', 'Gennaro', 'Ciro', 'Carmine', 'Pasquale', 'Rocco', 'Saverio', 'Cosimo', 'Gaetano',
    'Ludovico', 'Achille', 'Ruggero', 'Ivan', 'Kevin', 'Thomas', 'Denis', 'Igor', 'Leandro', 'Lapo', 'Duccio',
    'Niccolò', 'Gregorio', 'Lucio', 'Ernesto', 'Ottavio', 'Massimiliano', 'Giordano', 'Tiziano', 'Renato', 'Sergio',
    'Silvio', 'Teo', 'Diego', 'Noah', 'Brando', 'Zeno', 'Aurelio', 'Elio', 'Fausto', 'Giacinto', 'Marcello',
    'Ferdinando', 'Orazio', 'Pierluigi', 'Raimondo', 'Rodolfo', 'Settimio', 'Valentino', 'Mauro', 'Loris', 'Ivano',
  ],
  last: [
    'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo',
    'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro',
    'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Gentile', 'Martinelli', 'Vitale',
    'Lombardo', 'Serra', 'Coppola', 'De Santis', "D'Angelo", 'Marchetti', 'Parisi', 'Villa', 'Conte', 'Ferraro', 'Ferri',
    'Fabbri', 'Bianco', 'Marini', 'Grasso', 'Valentini', 'Messina', 'Sala', 'De Angelis', 'Gatti', 'Pellegrini',
    'Palumbo', 'Sanna', 'Farina', 'Rizzi', 'Monti', 'Cattaneo', 'Morelli', 'Amato', 'Silvestri', 'Mazza', 'Testa',
    'Grassi', 'Pellegrino', 'Carbone', 'Giuliani', 'Benedetti', 'Barone', 'Rossetti', 'Caputo', 'Montanari', 'Guerra',
    'Palmieri', 'Bernardi', 'Martino', 'Fiore', 'De Rosa', 'Ferretti', 'Bellini', 'Basile', 'Riva', 'Donati', 'Piras',
    'Vitali', 'Battaglia', 'Sartori', 'Neri', 'Costantini', 'Milani', 'Pagano', 'Ruggiero', 'Sorrentino', "D'Amico",
    'Orlando', 'Damico', 'Negri', 'Castelli', 'Bonetti', 'Lanza', 'Carli', 'Zanetti', 'Pace', 'Cirillo', 'Ruggeri',
    'Salvi', 'Bonanno', 'Cocco', 'Lucchesi', 'Ventura', 'Pastore', 'Pinna', 'Rocca', 'Spina', 'Valente', 'Melis',
    'Tedesco', 'Arena', 'Scotti', 'Mele', 'Guidi', 'Bertolini', 'Brambilla', 'Cavallo', 'Corsi', 'Fumagalli', 'Iacono',
    'Landi', 'Lupo', 'Mazzoni', 'Nardi', 'Olivieri', 'Pozzi', 'Rota', 'Sacco', 'Tosi', 'Vaccaro', 'Zanella', 'Abate',
    'Acerbi', 'Bassi', 'Borrelli', 'Calabrese', 'Capasso', 'Cristiani', 'Del Vecchio', 'Di Martino', 'Di Stefano',
    'Fiorentino', 'Gargiulo', 'Iovino', 'La Rosa', 'Lo Russo', 'Manzo', 'Mastroianni', 'Nocera', 'Perrone', 'Quaranta',
    'Raimondi', 'Scognamiglio', 'Tortora', 'Vinci', 'Zito', 'Alfieri', 'Baldi', 'Brunetti', 'Ceccarelli', 'Crespi',
    'Dini', 'Fadda', 'Gennari', 'Ghezzi', 'Lai', 'Loi', 'Mura', 'Nieddu', 'Porcu', 'Sechi', 'Usai', 'Bruzzone',
    'Canepa', 'Parodi', 'Ravera', 'Rebora', 'Traverso', 'Queirolo', 'Bozzo', 'Ghio', 'Oneto', 'Repetto', 'Schiaffino',
    'Musumeci', 'Pappalardo', 'Scuderi', 'Puglisi', 'Licata', 'Cannella', 'Bonfiglio', 'Agnello',
    'Di Maio', 'Cuomo', 'Iervolino', 'Mattiello', 'Salerno', 'Velotto', 'Di Somma', 'Massa', 'Brignone',
  ],
};

const POOLS: Record<string, Pool> = {
  ITA,
  HUN: {
    first: ['Ádám', 'Balázs', 'Bence', 'Dániel', 'Dávid', 'Gergely', 'Krisztián', 'Márton', 'Norbert', 'Péter', 'Tamás', 'Zoltán', 'Gábor', 'Levente', 'Szilárd', 'Kristóf', 'Vince', 'Benedek', 'Ákos', 'Soma'],
    last: ['Nagy', 'Kovács', 'Tóth', 'Szabó', 'Horváth', 'Kiss', 'Molnár', 'Németh', 'Farkas', 'Balogh', 'Papp', 'Takács', 'Juhász', 'Lakatos', 'Mészáros', 'Oláh', 'Rácz', 'Fekete', 'Szilágyi', 'Török', 'Fehér', 'Bodnár', 'Sipos', 'Hegedűs', 'Bakos'],
  },
  SRB: {
    first: ['Nikola', 'Stefan', 'Filip', 'Dušan', 'Aleksandar', 'Marko', 'Nemanja', 'Viktor', 'Strahinja', 'Uroš', 'Miloš', 'Đorđe', 'Lazar', 'Vuk', 'Ognjen', 'Radomir', 'Sava', 'Petar'],
    last: ['Jovanović', 'Petrović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Ilić', 'Stanković', 'Pavlović', 'Milošević', 'Kostić', 'Popović', 'Živković', 'Lazić', 'Vasić', 'Simić', 'Obradović', 'Bogdanović', 'Krstić', 'Tomić'],
  },
  CRO: {
    first: ['Ivan', 'Luka', 'Marko', 'Josip', 'Ante', 'Matej', 'Petar', 'Toni', 'Mario', 'Filip', 'Loren', 'Rino', 'Jerko', 'Konstantin', 'Paulo', 'Andro', 'Duje'],
    last: ['Horvat', 'Kovačević', 'Babić', 'Marić', 'Jurić', 'Novak', 'Knežević', 'Vuković', 'Perić', 'Pavić', 'Šarić', 'Božić', 'Grgić', 'Kralj', 'Rukavina', 'Vidović', 'Mlinar', 'Radić', 'Bilić', 'Čolak'],
  },
  ESP: {
    first: ['Alberto', 'Álvaro', 'Bernat', 'Sergi', 'Marc', 'Roger', 'Unai', 'Alejandro', 'Pablo', 'Eduardo', 'Felipe', 'Blai', 'Miguel', 'Martí', 'Jordi', 'Íñigo', 'Pol', 'Dani'],
    last: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Díaz', 'Moreno', 'Muñoz', 'Navarro', 'Torres', 'Romero', 'Jiménez', 'Serrano', 'Castro', 'Aguirre', 'Vidal', 'Puig', 'Roca'],
  },
  GRE: {
    first: ['Georgios', 'Konstantinos', 'Dimitrios', 'Ioannis', 'Nikolaos', 'Angelos', 'Stylianos', 'Alexandros', 'Christos', 'Emmanouil', 'Efstathios', 'Panagiotis', 'Evangelos', 'Theodoros'],
    last: ['Papadopoulos', 'Papadakis', 'Georgiou', 'Christodoulou', 'Antoniou', 'Pappas', 'Karagiannis', 'Vasileiou', 'Oikonomou', 'Makris', 'Spanos', 'Kostopoulos', 'Lamprou', 'Nikolaidis', 'Petridis', 'Kontogiannis'],
  },
  MNE: {
    first: ['Aleksa', 'Vladan', 'Dražen', 'Bogdan', 'Đuro', 'Marko', 'Vasilije', 'Luka', 'Draško', 'Savo', 'Miloš', 'Stefan'],
    last: ['Vuksanović', 'Đukanović', 'Lalić', 'Bulatović', 'Kalezić', 'Raičević', 'Šćepanović', 'Bošković', 'Vujošević', 'Perović', 'Drašković', 'Vučinić', 'Lakić', 'Mugoša'],
  },
  FRA: {
    first: ['Thomas', 'Hugo', 'Ugo', 'Romain', 'Alexandre', 'Mehdi', 'Enzo', 'Rémi', 'Pierre', 'Thibaut', 'Léo', 'Clément'],
    last: ['Martin', 'Bernard', 'Dubois', 'Petit', 'Durand', 'Leroy', 'Roux', 'Fournier', 'Garcia', 'Lefebvre', 'Moreau', 'Laurent', 'Girard'],
  },
  GER: {
    first: ['Lukas', 'Maximilian', 'Jonas', 'Felix', 'Tim', 'Moritz', 'Julian', 'Niklas', 'Tobias', 'Dennis', 'Kevin', 'Florian'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Schäfer', 'Koch', 'Richter', 'Klein', 'Wolf'],
  },
  ROU: {
    first: ['Andrei', 'Alexandru', 'Mihai', 'Cosmin', 'Vlad', 'Tudor', 'Radu', 'Ionuț', 'Bogdan', 'Florin'],
    last: ['Popescu', 'Ionescu', 'Neagu', 'Stoica', 'Dumitru', 'Georgescu', 'Constantin', 'Radu', 'Munteanu', 'Gheorghe'],
  },
  NED: {
    first: ['Daan', 'Bram', 'Sem', 'Thijs', 'Lars', 'Ruben', 'Jesse', 'Stijn', 'Joeri'],
    last: ['de Jong', 'Jansen', 'de Vries', 'van den Berg', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder'],
  },
  USA: {
    first: ['Ben', 'Hannes', 'Alex', 'Ryder', 'Dylan', 'Max', 'Chase', 'Luca', 'Adrian', 'Marko', 'Tyler', 'Jake'],
    last: ['Brown', 'Taylor', 'Anderson', 'Thomas', 'Moore', 'Clark', 'Lewis', 'Smith', 'Johnson', 'Miller', 'Davis', 'Wilson'],
  },
  AUS: {
    first: ['Nathan', 'Blake', 'Marcus', 'Lachlan', 'Riley', 'Tim', 'Joel', 'Aaron', 'Jacob', 'Angus'],
    last: ['Walker', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Dawson', 'Mitchell', 'Clarke', 'Kelly'],
  },
  BRA: {
    first: ['Gabriel', 'Lucas', 'Pedro', 'Felipe', 'Rodrigo', 'Bernardo', 'Thiago', 'Gustavo'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Carvalho', 'Almeida'],
  },
  GEO: {
    first: ['Giorgi', 'Nika', 'Levan', 'Luka', 'Davit', 'Irakli', 'Saba'],
    last: ['Beridze', 'Kapanadze', 'Gelashvili', 'Maisuradze', 'Tsiklauri', 'Lomidze', 'Chikovani'],
  },
  TUR: {
    first: ['Emre', 'Mert', 'Can', 'Burak', 'Kerem', 'Ozan', 'Arda'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk'],
  },
  MLT: {
    first: ['Matthew', 'Jake', 'Luke', 'Nicholas', 'Jordan', 'Liam'],
    last: ['Borg', 'Camilleri', 'Vella', 'Farrugia', 'Zammit', 'Galea', 'Grech'],
  },
  JPN: {
    first: ['Yusuke', 'Kenta', 'Atsushi', 'Seiya', 'Taiyo', 'Ryo', 'Kohei'],
    last: ['Sato', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Tanaka', 'Suzuki'],
  },
  CAN: {
    first: ['Nicolas', 'Reuel', 'Jérémie', 'Owen', 'Liam', 'Gaelan'],
    last: ['Constantin', 'Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard'],
  },
  ARG: {
    first: ['Juan', 'Tomás', 'Mateo', 'Santiago', 'Nicolás', 'Agustín'],
    last: ['González', 'Rodríguez', 'Fernández', 'Romero', 'Álvarez', 'Benítez'],
  },
};

export function namePool(nationality: string): Pool {
  return POOLS[nationality] ?? ITA;
}

export const FOREIGN_CODES = Object.keys(NATIONS).filter((c) => c !== 'ITA');

export const SPONSOR_NAMES = [
  'Aqua Sport', 'Blu Marine', 'Termoidraulica Rossi', 'Banca del Territorio', 'Edilmare', 'Pastificio Del Golfo',
  'Oleificio Riviera', 'Autosalone Delta', 'Ottica Visione', 'Caseificio Valle Verde', 'Nautica Levante', 'Elettro Sud',
  'Farmacia Centrale', 'Assicurazioni Tirreno', 'Trasporti Adriatica', 'Costruzioni Aurora', 'Hotel Belvedere',
  'Birrificio Tre Onde', 'Acqua Fonte Chiara', 'Energia Pulita', 'Logistica Nord', 'Tecnomare', 'Vini Colline Alte',
  'Cantieri Navali Poseidon', 'Supermercati Sole', 'Gelateria Polare', 'Sanitaria Salus', 'Studio Legale Ferri',
  'Ferramenta Bulloni', 'Agenzia Viaggi Orizzonte', 'Pizzeria Vesuvio', 'Telecom Mare', 'Gruppo Acciai Liguri',
  'Banca Popolare del Mare', 'Moto Racing Team', 'AquaLab Swimwear', 'Delfino Costruzioni', 'Officine Meccaniche Riva',
  'Cooperativa Pescatori', 'Fintech Onda', 'Assicurazioni Nettuno', 'Riviera Resort', 'Caffè Torrefazione Moka',
  'Idrotermica Italia', 'Turbo Energy', 'Marmi Apuani', 'Profumi di Capri', 'Limoncello Amalfi', 'Pneumatici Grip',
  'Software Laguna', 'Distillerie Alpine', 'Calzaturificio Passo', 'Mobilificio Brianza', 'Sartoria Napoletana',
];

export const KIT_SPONSORS = ['Swimrun', 'Aquatek', 'Polofit', 'Hydrogear', 'WaveLine', 'Delfinia', 'Tritone Wear', 'Blucap'];

export const INJURIES: { name: string; min: number; max: number; weight: number }[] = [
  { name: 'Affaticamento muscolare', min: 3, max: 7, weight: 30 },
  { name: 'Contrattura alla spalla', min: 5, max: 14, weight: 20 },
  { name: 'Distorsione al dito', min: 4, max: 12, weight: 14 },
  { name: 'Lombalgia', min: 6, max: 18, weight: 10 },
  { name: 'Trauma al ginocchio', min: 10, max: 30, weight: 8 },
  { name: 'Lesione alla cuffia dei rotatori', min: 30, max: 90, weight: 3 },
  { name: 'Frattura al dito', min: 25, max: 45, weight: 4 },
  { name: 'Colpo al volto', min: 3, max: 10, weight: 8 },
  { name: 'Stiramento all’adduttore', min: 10, max: 25, weight: 7 },
  { name: 'Infiammazione al gomito', min: 7, max: 21, weight: 6 },
  { name: 'Lussazione alla spalla', min: 40, max: 100, weight: 2 },
  { name: 'Influenza', min: 3, max: 8, weight: 10 },
];
