// ─────────────────────────────────────────────────────────────────────────────
// Water Polo Manager — tipi del dominio.
// Il motore è indipendente dall'interfaccia: tutto ciò che è qui è serializzabile
// (nessuna funzione, nessuna classe) e viene salvato così com'è in IndexedDB.
// ─────────────────────────────────────────────────────────────────────────────

export type ID = string;

/** Ruoli della pallanuoto. */
export type Role = 'POR' | 'CEN' | 'DIF' | 'MAN' | 'CVA' | 'ALA' | 'UNI';
export type Hand = 'R' | 'L';

export const TECH_ATTRS = [
  'tiro', 'potenzaTiro', 'precisione', 'passaggio', 'visione', 'controlloPalla', 'dribbling',
  'smarcamento', 'giocoCentro', 'marcatura', 'contrasto', 'superiorita', 'inferiorita',
] as const;
export const PHYS_ATTRS = ['velocita', 'accelerazione', 'resistenza', 'forza', 'elevazione', 'agilita', 'recupero'] as const;
export const MENT_ATTRS = [
  'concentrazione', 'leadership', 'intelligenzaTattica', 'decisioni', 'determinazione', 'freddezza', 'pressione',
] as const;
export const GK_ATTRS = ['riflessi', 'piazzamento', 'uscite', 'rinvio'] as const;
export const ALL_ATTRS = [...TECH_ATTRS, ...PHYS_ATTRS, ...MENT_ATTRS, ...GK_ATTRS] as const;

export type TechAttr = (typeof TECH_ATTRS)[number];
export type PhysAttr = (typeof PHYS_ATTRS)[number];
export type MentAttr = (typeof MENT_ATTRS)[number];
export type GkAttr = (typeof GK_ATTRS)[number];
export type AttrKey = (typeof ALL_ATTRS)[number];
export type Attributes = Record<AttrKey, number>;
export type AttrGroup = 'tecnica' | 'fisico' | 'mentale' | 'portiere';

export interface Personality {
  /** 1-20, nascosti al giocatore ma descritti a parole. */
  professionalita: number;
  ambizione: number;
  lealta: number;
  temperamento: number;
}

export type SquadStatus = 'fondamentale' | 'titolare' | 'rotazione' | 'riserva' | 'giovane';

export interface Contract {
  /** Stipendio annuo lordo in euro. */
  wage: number;
  /** Ultima stagione coperta (stagione = anno di inizio, es. 2025 = 2025/26). */
  endSeason: number;
  status: SquadStatus;
  releaseClause?: number;
}

export interface StatLine {
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  exclDrawn: number;
  exclCommitted: number;
  steals: number;
  turnovers: number;
  blocks: number;
  saves: number;
  goalsAgainst: number;
  penGoals: number;
  manUpGoals: number;
  ratingSum: number;
  mvp: number;
}

export interface PlayerSeasonRecord {
  season: number;
  clubId: ID;
  clubName: string;
  division: string;
  apps: number;
  goals: number;
  assists: number;
  saves: number;
  avgRating: number;
  overall: number;
}

export interface Injury {
  name: string;
  daysLeft: number;
  totalDays: number;
}

export interface Loan {
  fromClubId: ID;
  untilSeason: number;
  /** Quota dello stipendio pagata dal club che riceve (0-1). */
  wageShare: number;
}

export interface Player {
  id: ID;
  firstName: string;
  lastName: string;
  nationality: string;
  birthYear: number;
  height: number;
  weight: number;
  role: Role;
  hand: Hand;
  capNumber: number;
  /** Giocatore reale (nome, ruolo e nazionalità dalle rose pubbliche); le caratteristiche sono stimate dal gioco. */
  real?: boolean;
  attrs: Attributes;
  overall: number;
  /** Potenziale reale (nascosto: l'interfaccia mostra stime in base allo scouting). */
  potential: number;
  personality: Personality;
  clubId: ID | null;
  contract: Contract | null;
  loan?: Loan;
  youth: boolean;
  morale: number;
  condition: number;
  /** Ultime valutazioni in partita (max 6). */
  form: number[];
  experience: number;
  reputation: number;
  injury?: Injury;
  value: number;
  transferListed: boolean;
  loanListed: boolean;
  wantsToLeave: boolean;
  /** Settimane consecutive di morale molto basso. */
  unhappyWeeks: number;
  /** Quota di minuti nelle ultime partite (media mobile 0-1). */
  playingTime: number;
  joinedSeason: number;
  devFocus?: AttrGroup;
  /** Caratteristiche specifiche su cui il giocatore si allena in modo mirato (fino a 3). */
  devAttrs?: AttrKey[];
  /** Overall fissato (giocatore famoso con valutazione precisa): non lo tocca il bilanciamento dei livelli. */
  rated?: boolean;
  stats: Record<string, StatLine>;
  history: PlayerSeasonRecord[];
  retired?: boolean;
  /** Promessa del presidente (es. "più spazio") con scadenza. */
  promise?: { kind: 'playingTime' | 'strengthen' | 'renewal'; untilDay: number; season: number };
  /** Giorno fino al quale il giocatore rifiuta altre trattative. */
  negotiationBlockedUntil?: number;
}

// ─── Allenatori e staff ──────────────────────────────────────────────────────

export type CoachPhilosophy = 'difensivo' | 'offensivo' | 'equilibrato' | 'superiorita' | 'giovani';

export interface CoachAttributes {
  tattica: number;
  preparazione: number;
  giovani: number;
  spogliatoio: number;
  esperienza: number;
  motivazione: number;
  adattabilita: number;
  reputazione: number;
}

export interface Coach {
  id: ID;
  firstName: string;
  lastName: string;
  nationality: string;
  birthYear: number;
  attrs: CoachAttributes;
  philosophy: CoachPhilosophy;
  clubId: ID | null;
  contract: { wage: number; endSeason: number } | null;
  /** Fiducia/pressione: 0 = in bilico, 100 = saldissimo. */
  security: number;
  history: { season: number; clubName: string; division: string; position: number | null }[];
  trophies: number;
}

export type StaffRole = 'vice' | 'atletico' | 'portieri' | 'medico' | 'osservatore' | 'giovanili' | 'ds' | 'marketing';

export interface StaffMember {
  id: ID;
  firstName: string;
  lastName: string;
  nationality: string;
  birthYear: number;
  role: StaffRole;
  rating: number;
  clubId: ID | null;
  contract: { wage: number; endSeason: number } | null;
}

// ─── Tattiche ────────────────────────────────────────────────────────────────

export type OffenseTactic =
  | 'organizzato' | 'centroboa' | 'rapido' | 'circolazione' | 'distanza' | 'espulsione' | 'ali' | 'aggressivo';
export type DefenseTactic = 'uomo' | 'zona' | 'zonaM' | 'pressing' | 'prudente' | 'aggressiva' | 'raddoppio';
export type ManUpFormation = '4-2' | '3-3';
export type ManUpCirculation = 'paziente' | 'veloce';
export type ManUpStrategy = 'equilibrata' | 'perimetro' | 'pali' | 'centro';
export type ManDownStyle = 'compatta' | 'aggressiva' | 'porta' | 'blocco';

export interface TacticsSetup {
  offense: OffenseTactic;
  defense: DefenseTactic;
  manUp: {
    formation: ManUpFormation;
    circulation: ManUpCirculation;
    strategy: ManUpStrategy;
    shooters: ID[];
  };
  manDown: {
    style: ManDownStyle;
    /** Giocatore avversario da marcare con attenzione speciale (opzionale). */
    focusPlayerId: ID | null;
  };
}

export type TacticId = OffenseTactic | DefenseTactic | `mu_${ManUpFormation}` | `md_${ManDownStyle}`;

// ─── Formazione ──────────────────────────────────────────────────────────────

/** 7 posizioni in acqua: 0 portiere e le posizioni d’attacco numerate della pallanuoto (1 ala destra, 2 lato destro, 3 centrovasca, 4 lato sinistro, 5 ala sinistra, 6 centroboa). */
export interface Lineup {
  slots: (ID | null)[];
  bench: ID[];
  captainId: ID | null;
  penaltyTakers: ID[];
  /** Minutaggio previsto (in minuti su 32) dei panchinari. Se manca un giocatore, si usa quello che si aspetta dal suo ruolo in squadra. */
  minutes?: Record<ID, number>;
}

export interface SavedLineup {
  name: string;
  lineup: Lineup;
}

export type TrainingFocus = 'bilanciato' | 'tecnico' | 'fisico' | 'tattico' | 'speciali' | 'recupero';
export type TrainingIntensity = 'bassa' | 'media' | 'alta';

export interface TrainingSettings {
  focus: TrainingFocus;
  intensity: TrainingIntensity;
}

// ─── Strutture ───────────────────────────────────────────────────────────────

export type FacilityKey = 'piscina' | 'allenamento' | 'palestra' | 'medico' | 'giovanile' | 'scouting' | 'uffici';

export interface FacilityState {
  level: number;
  /** Lavori in corso verso il livello successivo. */
  upgrading?: { daysLeft: number; totalDays: number; cost: number };
}

// ─── Economia ────────────────────────────────────────────────────────────────

export type IncomeCat =
  | 'sponsor' | 'biglietti' | 'abbonamenti' | 'merchandising' | 'attivita' | 'premi' | 'contributi' | 'investimenti' | 'cessioni' | 'altro';
export type ExpenseCat =
  | 'stipendi' | 'acquisti' | 'staff' | 'piscina' | 'trasferte' | 'giovanili' | 'manutenzione' | 'amministrazione'
  | 'interessi' | 'strutture' | 'altro';

export interface SeasonLedger {
  season: number;
  income: Record<IncomeCat, number>;
  expense: Record<ExpenseCat, number>;
}

export interface BankLoan {
  id: ID;
  principal: number;
  remaining: number;
  weeklyPayment: number;
  rate: number;
  startSeason: number;
}

export interface Finances {
  balance: number;
  transferBudget: number;
  wageBudget: number;
  loans: BankLoan[];
  ledger: SeasonLedger;
  pastLedgers: SeasonLedger[];
  /** Saldo settimanale (per i grafici), stagione corrente. */
  weeklyBalance: number[];
  /** Settimane consecutive con stipendi non pagati. */
  unpaidWeeks: number;
  /** Stipendi arretrati da pagare. */
  arrears: number;
  ticketPrice: number;
  seasonTicketPrice: number;
}

export type SponsorSlot = 'principale' | 'tecnico' | 'secondario';

export type ObjectiveKind = 'promozione' | 'playoff' | 'salvezza' | 'metaClassifica' | 'top4' | 'titolo' | 'coppa' | 'europa';

export interface SponsorContract {
  id: ID;
  name: string;
  slot: SponsorSlot;
  annual: number;
  startSeason: number;
  endSeason: number;
  objective: ObjectiveKind;
  bonus: number;
  /** Penale per mancato obiettivo (riduzione percentuale l'anno successivo). */
  malus: number;
}

export interface SponsorOffer extends SponsorContract {
  expiresDay: number;
}

// ─── Società ─────────────────────────────────────────────────────────────────

export type ClubPhilosophy = 'giovani' | 'campioni' | 'prudente' | 'equilibrata' | 'ambiziosa';

export interface CrestSpec {
  shape: 'scudo' | 'cerchio' | 'esagono' | 'rombo' | 'scudoClassico';
  pattern: 'pieno' | 'strisce' | 'meta' | 'banda' | 'croce' | 'onde' | 'bordo';
  symbol: 'palla' | 'onda' | 'tridente' | 'stella' | 'delfino' | 'iniziali' | 'corona' | 'faro';
  primary: string;
  secondary: string;
  initials: string;
}

export interface ClubSeasonRecord {
  season: number;
  division: string;
  group?: string;
  position: number | null;
  finalRank: number | null;
  points: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  outcome: string;
  cups: string[];
  topScorer?: string;
  balance: number;
  reputation: number;
  coach?: string;
}

export interface Honour {
  season: number;
  comp: string;
  label: string;
}

export interface Club {
  id: ID;
  name: string;
  short: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  colors: [string, string];
  crest: CrestSpec;
  founded: number;
  poolName: string;
  fansName: string;
  /** 'A1' | 'A2' | 'B' | 'C' per le italiane, 'EST' per le estere. */
  division: string;
  reputation: number;
  fans: number;
  /** Abbonati della stagione in corso. */
  abbonati: number;
  philosophy: ClubPhilosophy;
  finances: Finances;
  facilities: Record<FacilityKey, FacilityState>;
  coachId: ID | null;
  staff: Partial<Record<StaffRole, ID>>;
  playerIds: ID[];
  youthIds: ID[];
  tactics: TacticsSetup;
  lineup: Lineup;
  savedLineups: SavedLineup[];
  training: TrainingSettings;
  tacticFamiliarity: Partial<Record<TacticId, number>>;
  chemistry: number;
  /** Preparazione atletica di squadra (costruita nel precampionato). */
  fitnessPrep: number;
  sponsors: SponsorContract[];
  history: ClubSeasonRecord[];
  honours: Honour[];
  isUser: boolean;
  /** Aspettativa/obiettivo della stagione. */
  objective: ObjectiveKind;
  /** Punti di sviluppo societario (sbloccano livelli). */
  devPoints: number;
  /** Forza "nazionale" per i club esteri (simula il campionato estero). */
  domesticRank?: number;
  /** Striscia di risultati recenti: 'W' | 'D' | 'L'. */
  recent: string[];
  /** Penalità punti da applicare nella prossima stagione (licenza nazionale). */
  pendingPenalty: number;
  /** Giorno fino al quale la piscina è inagibile (si gioca senza incasso). */
  poolClosedUntil?: number;
  partner?: { name: string; share: number; objective: ObjectiveKind; untilSeason: number };
}

// ─── Competizioni ────────────────────────────────────────────────────────────

export type TieFormat = { kind: 'single' } | { kind: 'twoLegs' } | { kind: 'series'; bestOf: number };

export interface PostseasonRule {
  id: string;
  name: string;
  /** 'title' = scudetto, 'promotion' = vince la promozione, 'playout' = i perdenti retrocedono. */
  purpose: 'title' | 'promotion' | 'playout';
  scope: 'perGroup' | 'all';
  /** Posizioni coinvolte (1-based, nella classifica del girone). */
  positions: number[];
  rounds: { name: string; bestOf: number }[];
}

export interface LeagueRules {
  key: string;
  name: string;
  tier: number;
  groups: number;
  teamsPerGroup: number;
  groupNames: string[];
  legs: number;
  points: { win: number; draw: number; loss: number };
  promotesTo: string | null;
  relegatesTo: string | null;
  directPromotion: number;
  directRelegation: number;
  postseason: PostseasonRule[];
  startDate: string;
  prizeByPosition: number[];
  promotionPrize: number;
  /** Livello medio delle rose (per la generazione del mondo). */
  strength: [number, number];
  /** Fasce di budget e reputazione (per la generazione). */
  budget: [number, number];
  reputation: [number, number];
  fans: [number, number];
  baseContribution: number;
  ticketPrice: number;
  travelCost: number;
}

export interface CupRules {
  key: string;
  name: string;
  kind: 'national' | 'supercup';
  eligible: string[];
  dates: string[];
  finalFourFrom: number | null;
  prize: number[];
  reputationGain: number;
}

export interface ContinentalRules {
  key: string;
  name: string;
  level: number;
  /** Posti per nazione: per l'Italia indica le posizioni finali di A1 ammesse. */
  italySlots: number[];
  foreignSlots: Record<string, number>;
  format: 'groups+ko' | 'ko';
  groupCount: number;
  groupDates: string[];
  koRounds: { name: string; dates: string[]; format: 'twoLegs' | 'single' }[];
  prizePerWin: number;
  prizeByRound: number[];
  reputationGain: number;
  /** Seconda fase a gironi (nella Champions i "quarti di finale" sono un girone da 4 prima della Final Four). */
  stage2?: { name: string; groupCount: number; dates: string[] };
  /** Chi esce dalla fase a gironi scende in un'altra coppa (chiave), dove entra nel tabellone a eliminazione diretta. */
  dropTo?: string;
}

export interface TransferWindow {
  name: string;
  start: string;
  end: string;
}

export interface WorldRules {
  leagues: LeagueRules[];
  cups: CupRules[];
  continental: ContinentalRules[];
  windows: TransferWindow[];
  blackouts: [string, string][];
  matchSquadSize: number;
  /** Giocatori in rosa per ogni squadra (uguale in tutte le categorie). */
  rosterSize: number;
  periodSeconds: number;
  youthIntakeDate: string;
  licenseCheckDate: string;
}

export interface Fixture {
  id: ID;
  compId: ID;
  phase: number;
  group?: number;
  tieId?: ID;
  round: number;
  day: number;
  homeId: ID;
  awayId: ID;
  neutral: boolean;
  played: boolean;
  hg: number;
  ag: number;
  pens?: [number, number];
  /** Partita di serie da giocare solo se necessaria. */
  ifNeeded?: boolean;
  cancelled?: boolean;
  /** Marcatori compatti: [playerId, side(0/1)] */
  scorers?: [ID, number][];
  reportId?: ID;
  importance: number;
  label: string;
}

export interface Tie {
  id: ID;
  homeId: ID | null;
  awayId: ID | null;
  fixtureIds: ID[];
  winnerId?: ID;
  loserId?: ID;
  format: TieFormat;
  /** Vittorie nella serie [home, away]. */
  wins: [number, number];
}

export interface KnockoutRound {
  name: string;
  ties: Tie[];
  dates: number[];
  format: TieFormat;
}

export interface GroupStage {
  name: string;
  clubIds: ID[];
  fixtureIds: ID[];
}

export interface Phase {
  kind: 'groups' | 'knockout';
  name: string;
  /** Per i campionati: uno dei postseason (id), altrimenti 'main'. */
  purpose: string;
  groups: GroupStage[];
  rounds: KnockoutRound[];
  done: boolean;
  /** Per i postseason per girone: indice del girone di provenienza. */
  sourceGroup?: number;
  /** Turni a eliminazione previsti (nome, formula, date, campo neutro). */
  plan?: { name: string; format: TieFormat; dates: number[]; neutral: boolean }[];
  drawMode?: 'bracket' | 'random';
  /** Squadre che entrano direttamente in un turno successivo (teste di serie con bye). */
  entrants?: Record<number, string[]>;
  /** Teste di serie (posizione di partenza, più basso = migliore). */
  seeds?: Record<string, number>;
  /** Squadre ancora in gara in attesa del sorteggio del turno successivo. */
  pool?: string[];
}

export interface Competition {
  id: ID;
  key: string;
  name: string;
  kind: 'league' | 'cup' | 'supercup' | 'continental';
  season: number;
  tier: number;
  phases: Phase[];
  finished: boolean;
  winnerId?: ID;
  runnerUpId?: ID;
  penalties: Record<ID, number>;
  /** Classifica finale (campionati), riempita a fine stagione. */
  finalRanking?: ID[][];
  promoted: ID[];
  relegated: ID[];
}

export interface StandingRow {
  clubId: ID;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  form: string[];
}

// ─── Partita ─────────────────────────────────────────────────────────────────

export interface MatchEvent {
  /** Secondi trascorsi nel tempo corrente. */
  period: number;
  clock: number;
  type: string;
  side: 0 | 1 | -1;
  p1?: ID;
  p2?: ID;
  text?: string;
  /** Dettaglio (tipo di tiro, motivo, ecc.). */
  kind?: string;
  score?: [number, number];
  /** Categoria per lo stile nella cronaca. */
  tag?: 'goal' | 'save' | 'excl' | 'info' | 'bad' | 'tactic' | 'period' | 'big';
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  blocked: number;
  exclusionsDrawn: number;
  manUp: number;
  manUpGoals: number;
  penalties: number;
  penaltyGoals: number;
  counters: number;
  counterGoals: number;
  steals: number;
  turnovers: number;
  fouls: number;
  possessionSeconds: number;
  possessions: number;
  timeouts: number;
  sprintsWon: number;
  goalsByPeriod: number[];
  goalTypes: Record<string, number>;
}

export interface PlayerMatchLine {
  id: ID;
  name: string;
  number: number;
  role: Role;
  started: boolean;
  seconds: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  exclDrawn: number;
  exclCommitted: number;
  steals: number;
  turnovers: number;
  blocks: number;
  saves: number;
  goalsAgainst: number;
  penGoals: number;
  manUpGoals: number;
  rating: number;
  fouledOut: boolean;
  injured: boolean;
  redCard: boolean;
}

export interface MatchReport {
  id: ID;
  fixtureId: ID;
  season: number;
  day: number;
  compName: string;
  homeId: ID;
  awayId: ID;
  homeName: string;
  awayName: string;
  score: [number, number];
  pens?: [number, number];
  periods: [number, number][];
  stats: [TeamMatchStats, TeamMatchStats];
  players: [PlayerMatchLine[], PlayerMatchLine[]];
  events: MatchEvent[];
  mvpId: ID | null;
  attendance: number;
  tactics: [{ offense: string; defense: string }, { offense: string; defense: string }];
}

// ─── Mercato ─────────────────────────────────────────────────────────────────

export interface TransferOffer {
  id: ID;
  playerId: ID;
  fromClubId: ID;
  toClubId: ID;
  fee: number;
  loan: boolean;
  wageShare?: number;
  day: number;
  expiresDay: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'withdrawn';
  counterFee?: number;
  /** Il club offerente è l'utente? */
  byUser: boolean;
  note?: string;
}

export interface TransferRecord {
  season: number;
  day: number;
  playerId: ID;
  playerName: string;
  fromId: ID | null;
  toId: ID | null;
  fromName: string;
  toName: string;
  fee: number;
  loan: boolean;
  overall: number;
}

// ─── Eventi, notizie, messaggi ───────────────────────────────────────────────

export interface EventChoice {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface GameEvent {
  id: ID;
  kind: string;
  title: string;
  body: string;
  day: number;
  season: number;
  choices: EventChoice[];
  resolved: boolean;
  chosen?: string;
  outcome?: string;
  data: Record<string, any>;
  /** Blocca l'avanzamento finché non si decide. */
  blocking: boolean;
  expiresDay?: number;
}

export type InboxCategory =
  | 'notizia' | 'mercato' | 'partita' | 'finanze' | 'staff' | 'giovani' | 'sponsor' | 'evento' | 'infortuni' | 'societa'
  | 'contratti';

export interface InboxMessage {
  id: ID;
  day: number;
  season: number;
  category: InboxCategory;
  title: string;
  body: string;
  read: boolean;
  eventId?: ID;
  offerId?: ID;
  link?: { view: string; id?: ID };
  important?: boolean;
}

export interface NewsItem {
  id: ID;
  day: number;
  season: number;
  title: string;
  body: string;
  tag: string;
}

// ─── Mondo ───────────────────────────────────────────────────────────────────

export type Difficulty = 'facile' | 'normale' | 'difficile' | 'leggenda';

export interface DifficultySettings {
  key: Difficulty;
  label: string;
  startBalance: number;
  squadLevel: [number, number];
  presidentWealth: number;
  incomeMult: number;
  aiAggression: number;
  moraleSensitivity: number;
}

export interface CareerMeta {
  id: ID;
  name: string;
  clubName: string;
  season: number;
  day: number;
  division: string;
  createdAt: number;
  updatedAt: number;
  crest: CrestSpec;
  difficulty: Difficulty;
}

export interface ScoutAssignment {
  playerId: ID;
  daysLeft: number;
}

export interface Negotiation {
  playerId: ID;
  rounds: number;
  lastDemand?: { wage: number; years: number };
  /** Richiesta attuale del club venditore (trattative per il cartellino). */
  lastFee?: number;
  /** Quanto si è irritata la controparte con offerte troppo basse. */
  irritation?: number;
  /** Scarto personale (±) sulla soglia di accettazione: due trattative uguali non finiscono sempre allo stesso modo. */
  bias?: number;
  /** Giorno dell'ultimo scambio: le trattative ferme da tempo ripartono da zero. */
  day?: number;
}

export interface PendingMatch {
  fixtureId: ID;
}

export interface SeasonSummary {
  season: number;
  champions: Record<string, { id: ID; name: string }>;
  promoted: Record<string, string[]>;
  relegated: Record<string, string[]>;
  userOutcome: string;
  awards: { mvp?: string; topScorer?: string; bestYoung?: string };
}

export interface World {
  version: number;
  careerId: ID;
  seed: number;
  rng: number;
  nextId: number;
  season: number;
  day: number;
  startSeason: number;
  difficulty: Difficulty;
  userClubId: ID;
  presidentName: string;
  presidentWealth: number;
  rules: WorldRules;
  clubs: Record<ID, Club>;
  players: Record<ID, Player>;
  coaches: Record<ID, Coach>;
  staff: Record<ID, StaffMember>;
  competitions: Record<ID, Competition>;
  fixtures: Record<ID, Fixture>;
  reports: Record<ID, MatchReport>;
  offers: TransferOffer[];
  transfers: TransferRecord[];
  sponsorOffers: SponsorOffer[];
  events: GameEvent[];
  inbox: InboxMessage[];
  news: NewsItem[];
  shortlist: ID[];
  scouting: ScoutAssignment[];
  /** Conoscenza dei giocatori (0-100) da parte del club dell'utente. */
  knowledge: Record<ID, number>;
  negotiations: Record<ID, Negotiation>;
  /** Fase della stagione: 'regular' oppure 'review' (riepilogo di fine stagione da confermare). */
  phase: 'regular' | 'review' | 'gameover';
  seasonSummaries: SeasonSummary[];
  /** Albo d'oro: chiave competizione → elenco vincitori. */
  rollOfHonour: Record<string, { season: number; clubId: ID; clubName: string; runnerUp?: string }[]>;
  /** Squadre e allenatori ritirati non salvati: solo nomi di leggende del club. */
  legends: { name: string; seasons: string; apps: number; goals: number }[];
  gameOverReason?: string;
  /** Statistiche globali: per evitare di ripetere eventi troppo spesso. */
  eventCooldowns: Record<string, number>;
  /** Contatore per il precampionato e altre flag stagionali. */
  flags: Record<string, number | boolean | string>;
}
