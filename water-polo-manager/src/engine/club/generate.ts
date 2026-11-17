import { FANS_NAMES } from '../data/cities';
import { NATIONS } from '../data/names';
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
  balance?: number;
  philosophy?: ClubPhilosophy;
}

export interface GeneratedClub {
  club: Club;
  players: Player[];
  coach: Coach;
  staff: StaffMember[];
}

const ROSTER: Role[] = ['POR', 'POR', 'CEN', 'CEN', 'DIF', 'DIF', 'ESD', 'ESD', 'ESS', 'ESS', 'ALA', 'ALA', 'ALA', 'UNI', 'UNI'];
const PHILOSOPHIES: ClubPhilosophy[] = ['giovani', 'campioni', 'prudente', 'equilibrata', 'ambiziosa'];

export function generateRoster(ctx: GenCtx, clubId: string, level: number, country: string, foreignChance: number, size = 17): Player[] {
  const roles: Role[] = [...ROSTER];
  const extra: Role[] = ['UNI', 'ESD', 'ESS', 'DIF', 'ALA', 'CEN'];
  while (roles.length < size) roles.push(ctx.rng.pick(extra));
  const players: Player[] = [];
  roles.forEach((role, i) => {
    // I primi di ogni ruolo sono titolari, poi riserve e qualche giovane.
    const isYoung = i >= 13 && ctx.rng.chance(0.55);
    const starterBoost = i % 2 === 0 ? 3 : -2;
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
  const size = ctx.rng.int(16, 18);
  const players = generateRoster(ctx, id, seed.level, seed.country, seed.foreignChance, size);
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
