// Overall precisi dei giocatori veri più forti (scala 1-99, quella del gioco: un titolare di A1 vale circa 70).
// Non sono statistiche ufficiali ma un giudizio di gioco costruito su premi e risultati recenti:
//  - Alvaro Granados: MVP dei Mondiali 2025 e giocatore dell'anno 2025 per World Aquatics ed European Aquatics;
//  - Argyropoulos, Skoumpakis, Mandić, Manhercz, Kakaris, Glušac, Rašović, Ákos Nagy: squadra ideale / MVP degli Europei 2026
//    e candidati al premio di giocatore dell'anno 2026;
//  - nazionali di Italia, Spagna, Croazia, Serbia, Ungheria, Grecia e Francia: valore in base al ruolo nei club di vertice
//    (Pro Recco, Ferencváros, Barceloneta, Olympiacos, Radnički, Novi Beograd, Mladost).
// Chi non è in elenco ha un overall deterministico calcolato dal livello del suo club (vedi `ratedOverall`).
// Un giocatore in questo elenco ha SEMPRE lo stesso overall di partenza in ogni carriera, e non viene toccato dal bilanciamento dei livelli.

export const plainName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const RAW: [number, string[]][] = [
  [97, ['Alvaro Granados']],
  [96, ['Stylianos Argyropoulos', 'Dimitrios Skoumpakis']],
  [95, ['Dusan Mandic']],
  [94, ['Krisztian Manhercz']],
  [93, ['Konstantinos Kakaris', 'Milan Glusac']],
  [92, ['Strahinja Rasovic', 'Panagiotis Tzortzatos']],
  [91, ['Akos Nagy', 'Nagy Akos', 'Konstantinos Genidounias', 'Francesco Di Fulvio', 'Marko Bijac', 'Marc Larumbe', 'Bernat Sanahuja']],
  [90, ['Gianmarco Nicosia', 'Ivan Marcelic', 'Luka Bukic', 'Emmanouil Zerdevas', 'Nikola Jaksic', 'Alberto Munarriz']],
  [89, ['Gergo Fekete', 'Vasilije Martinovic', 'Thomas Vernoux', 'Alessandro Velotto', 'Viktor Rasovic', 'Alexandros Papanastasiou', 'Alejandro Bustos', 'Biel Gomila', 'Unai Aguirre']],
  [88, ['Nicholas Presciutti', 'Edoardo Di Somma', 'Andrija Basic', 'Dimitrios Nikolaidis', 'Szilard Jansik', 'Vendel Vigvari', 'Vigvari Vendel', 'Tomas Perrone', 'Gergo Zalanki', 'Nikola Dedovic']],
  [87, ['Francesco Condemi', 'Giacomo Cannella', 'Mario Del Basso', 'Konstantin Kharkov', 'Evangelos Pouros', 'Soma Vogel', 'Miguel de Toro', 'Milos Cuk', 'Nikola Lukic', 'Daniel Angyal', 'Gonzalo Echenique', 'Marko Zuvela', 'Marc Valls']],
  [86, ['Matteo Iocchi Gratta', 'Lorenzo Bruni', 'Nikolaos Gkillas', 'Alexandre Bouet', 'Gergely Burian', 'Josip Vrlic', 'Luka Loncar', 'Jerko Marinic Kragic', 'Sava Randjelovic', 'Roger Tahull', 'Ante Vukicevic']],
  [85, ['Luca Damonte', 'Filippo Ferrero', 'Francesco Cassia', 'Tommaso Gianazza', 'Marco Del Lungo', 'Vince Varga', 'Tommaso Baggi Necchi', 'Strahinja Gojkovic', 'Angelos Vlachopoulos', 'Maro Jokovic', 'Dusko Pijetlovic', 'Vladan Spaic', 'Ugo Crousillat', 'Dusan Vasic', 'Matias Biljaka', 'Zsombor Vismeg', 'Vismeg Zsombor']],
  [84, ['Stefano Guerrato', 'Jacopo Alesiani', 'Paolo Oliva', 'Luca Marziali', 'Nikolaos Papanikolaou', 'Konstantinos Gkiouvetsis', 'Vincenzo Renzuto Iodice', 'Edoardo Manzi', 'Umberto Esposito', 'Michael Bodegas', 'Balazs Erdelyi', 'Kristijan Milakovic', 'Nicola Cuccovillo']],
  [83, ['Biagio Borrelli', 'Lorenzo Briganti', 'Simone Rossi', 'Sebastiano Di Luciano', 'Enrico Caruso', 'Giuliano Mattiello', 'Eduardo Campopiano', 'Vincenzo Tozzi', 'Aristeidis Chalyvopoulos', 'Andro Buslje', 'Marko Dimitrijevic']],
];

export const PLAYER_RATINGS: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const [v, names] of RAW) for (const n of names) out[plainName(n)] = Math.max(out[plainName(n)] ?? 0, v);
  return out;
})();

/** Overall fissato di un giocatore famoso, o null. */
export function starRating(name: string): number | null {
  return PLAYER_RATINGS[plainName(name)] ?? null;
}

/**
 * Livello di squadra dei club di vertice (forza di squadra da raggiungere): i migliori club europei hanno rose molto più forti,
 * perché oltre ai fuoriclasse hanno anche gli altri titolari e le riserve di livello alto.
 */
export const TOP_CLUB_LEVELS: Record<string, number> = {
  'Pro Recco': 86, 'Ferencváros': 86, 'CN Atlètic-Barceloneta': 84, 'Olympiacos': 82, 'AN Brescia': 80, 'VK Radnički Kragujevac': 80,
  'VK Novi Beograd': 79, 'HAVK Mladost': 79, 'VK Jadran Spalato': 77, 'RN Savona': 76, 'Pallanuoto Trieste': 76, 'VK Jug Dubrovnik': 75,
  'CC Ortigia': 74, 'CN Marseille': 74, 'CN Posillipo': 73, 'Circolo Canottieri Napoli': 72, 'De Akker Bologna': 72, 'Panathinaikos': 72,
  'Iren Genova Quinto': 71, 'SS Lazio Nuoto': 71, 'Telimar Palermo': 70, 'CN Sabadell': 72, 'VK Jadran Herceg Novi': 72,
  'PVK Primorac Kotor': 72, 'Vasas': 72, 'Spandau 04': 66, 'NO Vouliagmeni': 68, 'CN Barcelona': 68, 'BVSC-Zugló': 70, 'Szolnoki Dózsa': 70,
  'CSM Oradea': 62, 'CSA Steaua București': 64,
};
