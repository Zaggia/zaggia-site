import { FOREIGN_CODES, NATIONS, namePool } from '../data/names';
import { ALL_ATTRS, GK_ATTRS, type AttrKey, type Attributes, type Hand, type Player, type Role, type StatLine } from '../types';
import { clamp } from '../util';
import type { GenCtx } from '../world/context';
import { ROLE_WEIGHTS, computeOverall, emptyAttributes } from './attributes';
import { expectedWage, marketValue } from './value';
import { remainingGrowth } from './development';

export interface PlayerGenOptions {
  level: number;
  role?: Role;
  age?: number;
  nationality?: string;
  /** Spinta extra al potenziale (talenti). */
  potentialBonus?: number;
  /** Potenziale fissato esplicitamente. */
  potential?: number;
  youth?: boolean;
  clubId?: string | null;
  contractYears?: number;
  foreignChance?: number;
  /** Dati anagrafici di un giocatore reale. */
  firstName?: string;
  lastName?: string;
  real?: boolean;
  /** Overall preciso da raggiungere esattamente (senza età né casualità). */
  exactOverall?: number;
  /** Giocatore famoso con valutazione precisa: il bilanciamento dei livelli non lo modifica. */
  rated?: boolean;
}

/** Porta l'overall di un giocatore al valore indicato muovendo le sue caratteristiche chiave. */
export function tuneOverall(attrs: Attributes, role: Role, target: number): void {
  const w = ROLE_WEIGHTS[role];
  for (let i = 0; i < 60; i++) {
    const diff = target - computeOverall(attrs, role);
    if (Math.abs(diff) < 0.5) return;
    for (const k of Object.keys(w) as AttrKey[]) attrs[k] = clamp(Math.round((attrs[k] + diff * 0.9) * 10) / 10, 1, 99);
  }
}

const ROLE_DISTRIBUTION: [Role, number][] = [
  ['POR', 0.13], ['CEN', 0.14], ['DIF', 0.14], ['MAN', 0.1], ['CVA', 0.15], ['ALA', 0.18], ['UNI', 0.16],
];

export function randomRole(ctx: GenCtx): Role {
  return ROLE_DISTRIBUTION[ctx.rng.weightedIndex(ROLE_DISTRIBUTION.map((r) => r[1]))][0];
}

export function randomNationality(ctx: GenCtx, foreignChance: number): string {
  if (!ctx.rng.chance(foreignChance)) return 'ITA';
  return ctx.rng.weighted(FOREIGN_CODES, (c) => NATIONS[c].weight);
}

function randomAge(ctx: GenCtx): number {
  // Distribuzione realistica: molti tra 21 e 30.
  return clamp(Math.round(ctx.rng.gauss(25.5, 4.2)), 17, 36);
}

function physique(ctx: GenCtx, role: Role): { height: number; weight: number } {
  const base: Record<Role, [number, number]> = {
    POR: [194, 92], CEN: [195, 104], DIF: [193, 99], MAN: [189, 90], CVA: [190, 92], ALA: [185, 85], UNI: [191, 93],
  };
  const [h, w] = base[role];
  const height = Math.round(ctx.rng.gauss(h, 4.5));
  const weight = Math.round(w + (height - h) * 0.8 + ctx.rng.gauss(0, 4));
  return { height: clamp(height, 172, 210), weight: clamp(weight, 70, 125) };
}

function handFor(ctx: GenCtx, role: Role): Hand {
  // Il mancino è per definizione un giocatore che tira di sinistro; negli altri ruoli i mancini sono pochi.
  const leftChance = role === 'MAN' ? 1 : role === 'ALA' ? 0.15 : 0.08;
  return ctx.rng.chance(leftChance) ? 'L' : 'R';
}

/** Genera le caratteristiche intorno a un livello target, coerenti con il ruolo e l'età. */
export function generateAttributes(ctx: GenCtx, role: Role, level: number, age: number, height: number): Attributes {
  const a = emptyAttributes(1);
  const w = ROLE_WEIGHTS[role];
  const isGk = role === 'POR';
  // Profilo personale: alcuni giocatori sono più "fisici", altri più "tecnici" o "mentali".
  const techBias = ctx.rng.gauss(0, 4);
  const physBias = ctx.rng.gauss(0, 4);
  const mentBias = ctx.rng.gauss(0, 3);
  for (const k of ALL_ATTRS) {
    const weight = w[k] ?? 0;
    let base: number;
    if ((GK_ATTRS as readonly string[]).includes(k)) {
      base = isGk ? level + 6 : ctx.rng.int(2, 12);
    } else if (isGk && weight === 0) {
      base = level * 0.55 + ctx.rng.gauss(0, 5);
    } else {
      const bias = weight >= 0.1 ? 6 : weight >= 0.04 ? 2 : -5;
      base = level + bias;
    }
    const group = (['velocita', 'accelerazione', 'resistenza', 'forza', 'elevazione', 'agilita', 'recupero'] as string[]).includes(k)
      ? physBias
      : (['concentrazione', 'leadership', 'intelligenzaTattica', 'decisioni', 'determinazione', 'freddezza', 'pressione'] as string[]).includes(k)
        ? mentBias
        : techBias;
    let v = base + group + ctx.rng.gauss(0, 6.5);
    // Età: i giovanissimi sono meno forti fisicamente e meno esperti mentalmente.
    if (age < 20 && (k === 'forza' || k === 'resistenza')) v -= (20 - age) * 2.2;
    if (age < 22 && (k === 'decisioni' || k === 'freddezza' || k === 'leadership' || k === 'pressione')) v -= (22 - age) * 1.6;
    if (age > 30 && (k === 'velocita' || k === 'accelerazione' || k === 'recupero')) v -= (age - 30) * 1.8;
    if (age > 28 && (k === 'leadership' || k === 'intelligenzaTattica' || k === 'freddezza')) v += (age - 28) * 1.0;
    if (k === 'forza' || k === 'elevazione') v += (height - 190) * 0.5;
    a[k] = clamp(v, 1, 99);
  }
  // Correzione iterativa verso il livello target dell'overall.
  for (let i = 0; i < 4; i++) {
    const ovr = computeOverall(a, role);
    const diff = level - ovr;
    if (Math.abs(diff) < 0.6) break;
    for (const k of Object.keys(w) as AttrKey[]) a[k] = clamp(a[k] + diff, 1, 99);
  }
  for (const k of ALL_ATTRS) a[k] = Math.round(a[k] * 10) / 10;
  return a;
}

/**
 * Potenziale: il livello attuale più la crescita che un giocatore di quell'età può ancora avere,
 * con grande variabilità (c'è chi esplode e chi si ferma). Così il livello medio del mondo resta stabile.
 */
export function potentialFor(ctx: GenCtx, level: number, age: number, bonus = 0, gk = false): number {
  const rem = remainingGrowth(age, gk);
  const pot = level + rem * clamp(ctx.rng.gauss(0.9, 0.35), 0.1, 2.2) + bonus;
  return Math.round(clamp(pot, level + (age <= 21 ? 2 : 0), 99));
}

export function emptyStatLine(): StatLine {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, exclDrawn: 0, exclCommitted: 0,
    steals: 0, turnovers: 0, blocks: 0, saves: 0, goalsAgainst: 0, penGoals: 0, manUpGoals: 0, ratingSum: 0, mvp: 0,
  };
}

export function generatePlayer(ctx: GenCtx, opts: PlayerGenOptions): Player {
  const role = opts.role ?? randomRole(ctx);
  const age = opts.age ?? randomAge(ctx);
  const nationality = opts.nationality ?? randomNationality(ctx, opts.foreignChance ?? 0);
  const pool = namePool(nationality);
  const { height, weight } = physique(ctx, role);
  // Per età: un giovane è più indietro rispetto al livello che raggiungerà nel pieno della carriera.
  const exact = opts.exactOverall != null;
  const ageAdj = !exact && opts.potential == null && !opts.youth ? -remainingGrowth(age, role === 'POR') * 0.75 + 1.5 : 0;
  const level = clamp(exact ? opts.exactOverall! : opts.level + ageAdj, 5, 99);
  const attrs = generateAttributes(ctx, role, level, age, height);
  if (exact) tuneOverall(attrs, role, Math.round(opts.exactOverall!));
  const overall = computeOverall(attrs, role);
  const potential = opts.potential != null
    ? Math.max(overall, Math.round(opts.potential))
    : Math.max(overall, potentialFor(ctx, overall, age, opts.potentialBonus ?? 0, role === 'POR'));
  const p: Player = {
    id: ctx.newId('p'),
    firstName: opts.firstName ?? ctx.rng.pick(pool.first),
    lastName: opts.lastName ?? ctx.rng.pick(pool.last),
    ...(opts.real ? { real: true } : {}),
    ...(opts.rated ? { rated: true } : {}),
    nationality,
    birthYear: ctx.season - age,
    height,
    weight,
    role,
    hand: handFor(ctx, role),
    capNumber: 0,
    attrs,
    overall,
    potential,
    personality: {
      professionalita: clamp(Math.round(ctx.rng.gauss(11, 4)), 1, 20),
      ambizione: clamp(Math.round(ctx.rng.gauss(11, 4)), 1, 20),
      lealta: clamp(Math.round(ctx.rng.gauss(11, 4)), 1, 20),
      temperamento: clamp(Math.round(ctx.rng.gauss(10, 4)), 1, 20),
    },
    clubId: opts.clubId ?? null,
    contract: null,
    youth: !!opts.youth,
    morale: clamp(Math.round(ctx.rng.gauss(68, 8)), 35, 95),
    condition: ctx.rng.int(88, 100),
    form: [],
    experience: clamp(Math.round((age - 15) * 4 + overall * 0.35 + ctx.rng.gauss(0, 6)), 0, 100),
    reputation: clamp(Math.round(overall * 1.1 - 22 + ctx.rng.gauss(0, 5)), 1, 99),
    value: 0,
    transferListed: false,
    loanListed: false,
    wantsToLeave: false,
    unhappyWeeks: 0,
    playingTime: 0.5,
    joinedSeason: ctx.season - ctx.rng.int(0, Math.max(0, Math.min(6, age - 17))),
    stats: {},
    history: [],
  };
  if (p.clubId) {
    const years = opts.contractYears ?? ctx.rng.int(1, 3);
    p.contract = {
      wage: opts.youth ? Math.max(300, Math.round(expectedWage(p, ctx.season) * 0.3 / 100) * 100) : expectedWage(p, ctx.season),
      endSeason: ctx.season + years - 1,
      status: 'rotazione',
    };
  }
  p.value = marketValue(p, ctx.season);
  return p;
}

/** Nome visualizzato abbreviato: "M. Rossi". */
export function shortName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName[0]}. ${p.lastName}`;
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}
