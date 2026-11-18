import type { RealPlayer } from '../data/realPlayers';
import { FANS_NAMES } from '../data/cities';
import { NATIONS } from '../data/names';
import { TOP_CLUB_LEVELS, plainName, starRating } from '../data/playerRatings';
import { BIRTH_YEARS } from '../data/birthYears';
import { generatePlayer } from '../player/generate';
import { expectedWage } from '../player/value';
import { remainingGrowth } from '../player/development';
import { generateCoach, generateStaff, STAFF_ROLES } from '../staff/coach';
import { defaultFamiliarity, defaultTactics } from '../tactics/tactics';
import type {
  Club, ClubPhilosophy, CrestSpec, FacilityKey, ObjectiveKind, Player, Role, StaffMember, Coach,
} from '../types';
import { clamp, lerp } from '../util';
import type { GenCtx } from '../world/context';
import { newFinances } from '../economy/ledger';
import { randomCrest, PALETTES } from './crest';

export interface ClubSeed {
  name: string;
  short: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  division: string;
  /** Livello medio della rosa (overall dei titolari). */
  level: number;
  reputation: number;
  fans: number;
  budget: number;
  facilityLevel: number;
  devPoints: number;
  isUser?: boolean;
  colors?: [string, string];
  crest?: CrestSpec;
  poolName?: string;
  founded?: number;
  fansName?: string;
  objective?: ObjectiveKind;
  ticketPrice: number;
  foreignChance: number;
  staffRoles: number;
  rosterSize?: number;
  /** Rosa reale (se disponibile): i giocatori veri del club. */
  realRoster?: RealPlayer[];
  balance?: number;
  philosophy?: ClubPhilosophy;
}

export interface GeneratedClub {
  club: Club;
  players: Player[];
  coach: Coach;
  staff: StaffMember[];
}

/** Rosa tipo di 15 giocatori: 2 portieri, 2 centroboa, 2 difensori, 2 centrovasca, 2 mancini, 3 ali, 2 universali. */
const ROSTER: Role[] = ['POR', 'CEN', 'DIF', 'CVA', 'MAN', 'ALA', 'ALA', 'UNI', 'POR', 'CEN', 'DIF', 'CVA', 'MAN', 'ALA', 'UNI'];
const PHILOSOPHIES: ClubPhilosophy[] = ['giovani', 'campioni', 'prudente', 'equilibrata', 'ambiziosa'];

export function generateRoster(ctx: GenCtx, clubId: string, level: number, country: string, foreignChance: number, size = 15): Player[] {
  const roles: Role[] = ROSTER.slice(0, size);
  const extra: Role[] = ['UNI', 'MAN', 'CVA', 'DIF', 'ALA', 'CEN'];
  while (roles.length < size) roles.push(ctx.rng.pick(extra));
  const players: Player[] = [];
  roles.forEach((role, i) => {
    // I primi di ogni ruolo sono titolari, poi riserve e qualche giovane.
    // I primi otto sono i titolari (portiere compreso), poi riserve e qualche giovane.
    const isYoung = i >= 12 && ctx.rng.chance(0.6);
    const starterBoost = i < 8 ? 3 : -3;
    const lvl = isYoung ? level - ctx.rng.int(8, 16) : level + starterBoost + ctx.rng.gauss(0, 4);
    const age = isYoung ? ctx.rng.int(17, 20) : undefined;
    const nat = country !== 'ITA'
      ? (ctx.rng.chance(0.75) ? country : ctx.rng.weighted(Object.keys(NATIONS).filter((c) => c !== country), (c) => NATIONS[c].weight + (c === 'ITA' ? 4 : 0)))
      : undefined;
    const p = generatePlayer(ctx, {
      level: lvl, role, age, clubId, nationality: nat, foreignChance, contractYears: ctx.rng.int(1, 3),
    });
    players.push(p);
  });
  assignNumbers(players);
  assignStatuses(players);
  return players;
}

/** Numero fisso calcolato dal nome (stesso risultato in ogni carriera). */
function nameHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000;
}

const REAL_ROLE: Record<string, Role> = { P: 'POR', CB: 'CEN', CV: 'CVA', D: 'DIF', U: 'UNI' };
const TARGET: Partial<Record<Role, number>> = { POR: 2, CEN: 2, DIF: 2, CVA: 2, MAN: 2, ALA: 3, UNI: 2 };

/** Divide "Nome Cognome": il primo nome resta tale, il resto è il cognome (es. "Francesco Di Fulvio"). */
export function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return ['', parts[0]];
  return [parts[0], parts.slice(1).join(' ')];
}

/**
 * Rosa con i giocatori reali del club: nomi, nazionalità, ruolo ed età vengono dalle rose pubbliche,
 * le caratteristiche sono stimate dal livello della squadra. Si tengono 15 giocatori (2 portieri);
 * se la rosa pubblica è incompleta, i posti mancanti vanno a giocatori generati.
 */
export function generateRealRoster(ctx: GenCtx, clubId: string, level: number, country: string, real: RealPlayer[], size: number, foreignChance: number, fixed = false): Player[] {
  // Se la rosa pubblica è più lunga di quella ammessa si tengono i giocatori più forti (prima i famosi, poi chi ha una voce enciclopedica).
  const seenNames = new Set<string>();
  // Doppioni e giocatori oltre i 44 anni (rose non aggiornate: sono quasi sicuramente ritirati) non entrano in rosa.
  real = real.filter((r) => {
    const k = plainName(r.n);
    if (seenNames.has(k)) return false;
    seenNames.add(k);
    const y = r.y ?? BIRTH_YEARS[k];
    return !(y && ctx.season - y > 44);
  });
  const strongFirst = (a: RealPlayer, b: RealPlayer) => (starRating(b.n) ?? 0) - (starRating(a.n) ?? 0) || (b.f ?? 0) - (a.f ?? 0);
  const gks = real.filter((r) => r.r === 'P').sort(strongFirst).slice(0, 2);
  const field = real.filter((r) => r.r !== 'P').sort(strongFirst).slice(0, size - Math.max(2, gks.length));
  const chosen = [...gks, ...field].slice(0, size);
  const count = (roles: Role[], r: Role) => roles.filter((x) => x === r).length;
  const roles: Role[] = [];
  // Prima i ruoli dichiarati, poi gli attaccanti e chi non ha ruolo nei ruoli ancora scoperti.
  const assigned = chosen.map((r) => REAL_ROLE[r.r] ?? null);
  assigned.forEach((r) => { if (r) roles.push(r); });
  const need = (pool: Role[]) => pool.reduce((best, r) => ((TARGET[r] ?? 0) - count(roles, r) > (TARGET[best] ?? 0) - count(roles, best) ? r : best), pool[0]);
  chosen.forEach((r, i) => {
    if (assigned[i]) return;
    const role = r.r === 'A' ? need(['ALA', 'MAN', 'UNI']) : need(['ALA', 'MAN', 'UNI', 'CEN', 'DIF', 'CVA']);
    assigned[i] = role;
    roles.push(role);
  });
  const players: Player[] = chosen.map((r, i) => {
    const role = assigned[i]!;
    const [firstName, lastName] = splitName(r.n);
    // Senza anno di nascita l'età è fissa (calcolata dal nome), così il giocatore è sempre lo stesso in ogni carriera.
    const by = r.y ?? BIRTH_YEARS[plainName(r.n)];
    const age = by ? clamp(ctx.season - by, 16, 44) : 22 + (nameHash(r.n + 'e') % 10);
    const nat = r.c && NATIONS[r.c] ? r.c : country;
    // Gli stranieri nei club italiani sono di norma tra i più forti; i primi portieri sono i titolari.
    // Chi ha una voce enciclopedica (nazionali, olimpionici) è un giocatore affermato: livello più alto.
    // Overall preciso, senza casualità: i giocatori famosi hanno il valore fissato in `PLAYER_RATINGS`; gli altri dipendono dal livello
    // del club, dall'esperienza internazionale, dall'età e da una piccola differenza fissa (calcolata dal nome, uguale in ogni carriera).
    const star = starRating(r.n);
    // Con l'età oltre i 34 anni si perde in fretta (resistenza, velocità): lo stesso vale per i campioni in elenco.
    const veteran = age > 34 ? (age - 34) * 1.3 : 0;
    let exact: number;
    if (star != null) exact = Math.round(star - veteran);
    else {
      const young = age < 22 ? (22 - age) * 1.4 : 0;
      exact = Math.round(clamp(level + (r.f ? 3 : -2) + (nat !== country ? 1 : 0) + (role === 'POR' && i === 0 ? 1 : 0) + (nameHash(r.n) % 5) - 2 - young - veteran, 20, 95));
    }
    // Potenziale fisso: i più giovani hanno ancora margine, chi ha più di 26 anni è al massimo.
    const potential = Math.min(99, exact + (age <= 20 ? 6 : age <= 23 ? 3 : age <= 26 ? 1 : 0));
    const p = generatePlayer(ctx, { level: exact, exactOverall: exact, potential, rated: star != null || fixed, role, age, clubId, nationality: nat, firstName, lastName, real: true, contractYears: ctx.rng.int(1, 3) });
    if (role === 'MAN') p.hand = 'L';
    return p;
  });
  // Posti scoperti (rosa pubblica incompleta): giocatori generati nei ruoli mancanti.
  const missing: Role[] = [];
  for (const [r, n] of Object.entries(TARGET) as [Role, number][]) for (let k = count(roles, r); k < n; k++) missing.push(r);
  while (players.length < size) {
    const role = missing.shift() ?? 'UNI';
    players.push(generatePlayer(ctx, { level: level - 3 + ctx.rng.gauss(0, 4), role, clubId, foreignChance, contractYears: ctx.rng.int(1, 2) }));
  }
  assignNumbers(players);
  // Dove la rosa pubblica indica il numero di calottina, si usa quello.
  chosen.forEach((r, i) => { if (r.num && r.num > 0 && r.num < 30 && !players.some((p, j) => j !== i && p.capNumber === r.num)) players[i].capNumber = r.num; });
  assignStatuses(players);
  return players;
}

export function assignNumbers(players: Player[]) {
  const used = new Set<number>();
  const gks = players.filter((p) => p.role === 'POR');
  const field = players.filter((p) => p.role !== 'POR').sort((a, b) => b.overall - a.overall);
  gks.forEach((p, i) => {
    const n = i === 0 ? 1 : i === 1 ? 13 : 14 + i;
    p.capNumber = n;
    used.add(n);
  });
  let n = 2;
  for (const p of field) {
    while (used.has(n)) n++;
    p.capNumber = n;
    used.add(n);
  }
}

export function assignStatuses(players: Player[]) {
  const sorted = [...players].sort((a, b) => b.overall - a.overall);
  sorted.forEach((p, i) => {
    if (!p.contract) return;
    p.contract.status = i < 2 ? 'fondamentale' : i < 8 ? 'titolare' : i < 13 ? 'rotazione' : 'riserva';
  });
  for (const p of players) {
    if (p.contract && p.potential - p.overall >= 12 && p.overall < sorted[7]?.overall) p.contract.status = 'giovane';
  }
}

/**
 * Potenziale medio dei ragazzi prodotti da un vivaio: dipende soprattutto dal livello
 * del settore giovanile, poi dal responsabile delle giovanili e dalla reputazione del club.
 */
export function academyMean(academyLevel: number, directorRating: number, reputation: number): number {
  return 29 + academyLevel * 7 + directorRating * 0.08 + reputation * 0.05;
}

export function generateYouth(ctx: GenCtx, clubId: string, mean: number, count: number, academyLevel: number): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < count; i++) {
    const age = ctx.rng.int(15, 18);
    const golden = ctx.rng.chance(0.002 + academyLevel * 0.0015);
    const potential = golden ? ctx.rng.int(84, 96) : Math.round(clamp(ctx.rng.gauss(mean, 7), 22, 90));
    const rem = remainingGrowth(age);
    const lvl = clamp(Math.round(potential - rem * clamp(ctx.rng.gauss(0.85, 0.12), 0.5, 1.1)), 8, potential - 3);
    const p = generatePlayer(ctx, { level: lvl, age, clubId, youth: true, potential, contractYears: 3 });
    out.push(p);
  }
  return out;
}

export function generateClub(ctx: GenCtx, seed: ClubSeed): GeneratedClub {
  const id = ctx.newId('c');
  const colors = seed.colors ?? ctx.rng.pick(PALETTES);
  const crest = seed.crest ?? randomCrest(ctx.rng, colors, seed.short);
  const facLevel = (k: FacilityKey) => {
    const base = seed.facilityLevel + (k === 'piscina' ? 0.2 : 0) + ctx.rng.gauss(0, 0.6);
    return clamp(Math.round(base), 1, 5);
  };
  const facilities = {
    piscina: { level: facLevel('piscina') },
    allenamento: { level: facLevel('allenamento') },
    palestra: { level: facLevel('palestra') },
    medico: { level: facLevel('medico') },
    giovanile: { level: facLevel('giovanile') },
    scouting: { level: facLevel('scouting') },
    uffici: { level: facLevel('uffici') },
  };
  if (seed.isUser) for (const k of Object.keys(facilities) as FacilityKey[]) facilities[k].level = 1;
  const club: Club = {
    id,
    name: seed.name,
    short: seed.short,
    city: seed.city,
    region: seed.region,
    country: seed.country,
    lat: seed.lat,
    lon: seed.lon,
    colors,
    crest,
    founded: seed.founded ?? ctx.rng.int(1900, 2012),
    poolName: seed.poolName ?? `Piscina ${ctx.rng.pick(['Comunale', 'Olimpica', 'del Mare', 'Centrale', 'dello Sport', 'Azzurra', 'del Lido'])} di ${seed.city}`,
    fansName: seed.fansName ?? ctx.rng.pick(FANS_NAMES),
    division: seed.division,
    reputation: clamp(Math.round(seed.reputation), 1, 100),
    fans: Math.round(seed.fans),
    abbonati: 0,
    philosophy: seed.philosophy ?? ctx.rng.pick(PHILOSOPHIES),
    finances: newFinances(ctx.season, seed.balance ?? seed.budget * ctx.rng.float(0.12, 0.35), seed.ticketPrice),
    facilities,
    coachId: null,
    staff: {},
    playerIds: [],
    youthIds: [],
    tactics: defaultTactics(),
    lineup: { slots: [null, null, null, null, null, null, null], bench: [], captainId: null, penaltyTakers: [] },
    savedLineups: [],
    training: { focus: 'bilanciato', intensity: 'media' },
    tacticFamiliarity: defaultFamiliarity(seed.level),
    chemistry: seed.isUser ? 45 : clamp(Math.round(ctx.rng.gauss(60, 10)), 30, 85),
    fitnessPrep: 50,
    sponsors: [],
    history: [],
    honours: [],
    isUser: !!seed.isUser,
    objective: seed.objective ?? 'metaClassifica',
    devPoints: Math.round(seed.devPoints),
    recent: [],
    pendingPenalty: 0,
  };
  const size = seed.rosterSize ?? 15;
  const players = seed.realRoster?.length
    ? generateRealRoster(ctx, id, TOP_CLUB_LEVELS[seed.name] ?? seed.level, seed.country, seed.realRoster, size, seed.foreignChance, TOP_CLUB_LEVELS[seed.name] != null)
    : generateRoster(ctx, id, seed.level, seed.country, seed.foreignChance, size);
  club.playerIds = players.map((p) => p.id);
  const youth = generateYouth(ctx, id, academyMean(facilities.giovanile.level, 30, club.reputation), seed.isUser ? 3 : ctx.rng.int(2, 4), facilities.giovanile.level);
  club.youthIds = youth.map((p) => p.id);
  players.push(...youth);
  const coachLevel = clamp(seed.level + ctx.rng.gauss(seed.isUser ? -2 : 0, 6), 15, 92);
  const coach = generateCoach(ctx, coachLevel, id);
  club.coachId = coach.id;
  const staff: StaffMember[] = [];
  const roles = seed.isUser ? (['vice', 'medico'] as const) : STAFF_ROLES.slice(0, seed.staffRoles);
  for (const r of roles) {
    const s = generateStaff(ctx, r, clamp(seed.level + ctx.rng.gauss(-4, 7), 10, 90), id);
    club.staff[r] = s.id;
    staff.push(s);
  }
  // Ricalibra gli stipendi sulla stagione corrente.
  for (const p of players) if (p.contract && !p.youth) p.contract.wage = expectedWage(p, ctx.season);
  return { club, players, coach, staff };
}

export function seedValue(range: [number, number], t: number): number {
  return lerp(range[0], range[1], clamp(t, 0, 1));
}
