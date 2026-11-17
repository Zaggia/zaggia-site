import { namePool } from '../data/names';
import type { Coach, CoachAttributes, CoachPhilosophy, StaffMember, StaffRole } from '../types';
import { clamp, niceMoney } from '../util';
import type { GenCtx } from '../world/context';
import { randomNationality } from '../player/generate';

export const PHILOSOPHY_LABELS: Record<CoachPhilosophy, string> = {
  difensivo: 'Difensivo',
  offensivo: 'Offensivo',
  equilibrato: 'Equilibrato',
  superiorita: 'Specialista della superiorità',
  giovani: 'Sviluppo dei giovani',
};

export const PHILOSOPHY_DESC: Record<CoachPhilosophy, string> = {
  difensivo: 'Impara più in fretta le difese a zona e il raddoppio; squadre ordinate che concedono poco.',
  offensivo: 'Spinge su attacco rapido e circolazione; più gol fatti, più rischi dietro.',
  equilibrato: 'Nessun punto debole: tutte le tattiche di base crescono in modo uniforme.',
  superiorita: 'Superiorità e inferiorità numeriche molto curate: più gol con l’uomo in più.',
  giovani: 'I giovani crescono più rapidamente e ricevono più minuti.',
};

export const COACH_ATTR_LABELS: Record<keyof CoachAttributes, string> = {
  tattica: 'Competenza tattica',
  preparazione: 'Preparazione atletica',
  giovani: 'Sviluppo dei giovani',
  spogliatoio: 'Gestione dello spogliatoio',
  esperienza: 'Esperienza',
  motivazione: 'Capacità motivazionale',
  adattabilita: 'Adattabilità',
  reputazione: 'Reputazione',
};

export const STAFF_LABELS: Record<StaffRole, string> = {
  vice: 'Vice allenatore',
  atletico: 'Preparatore atletico',
  portieri: 'Allenatore dei portieri',
  medico: 'Medico e fisioterapista',
  osservatore: 'Capo osservatore',
  giovanili: 'Responsabile settore giovanile',
  ds: 'Direttore sportivo',
  marketing: 'Responsabile commerciale',
};

export const STAFF_EFFECTS: Record<StaffRole, string> = {
  vice: 'Aumenta la capacità organizzativa (sblocco tattiche) e l’apprendimento delle tattiche.',
  atletico: 'Migliora la condizione fisica, il recupero e riduce gli infortuni.',
  portieri: 'Accelera la crescita dei portieri.',
  medico: 'Riduce i tempi di recupero dagli infortuni.',
  osservatore: 'Valuta con più precisione il potenziale e completa prima le relazioni.',
  giovanili: 'Migliora la qualità dei giovani che arrivano ogni anno.',
  ds: 'Ottiene prezzi migliori nelle trattative e stipendi più bassi.',
  marketing: 'Aumenta il valore delle offerte degli sponsor e il merchandising.',
};

export const STAFF_ROLES: StaffRole[] = ['vice', 'atletico', 'portieri', 'medico', 'osservatore', 'giovanili', 'ds', 'marketing'];

const PHILOSOPHIES: CoachPhilosophy[] = ['difensivo', 'offensivo', 'equilibrato', 'superiorita', 'giovani'];

export function coachRating(c: Coach): number {
  const a = c.attrs;
  return Math.round(
    a.tattica * 0.26 + a.preparazione * 0.14 + a.giovani * 0.1 + a.spogliatoio * 0.14 + a.esperienza * 0.1 +
      a.motivazione * 0.11 + a.adattabilita * 0.15,
  );
}

export function coachWage(level: number): number {
  return niceMoney(1500 * Math.exp(0.07 * (level - 30)));
}

export function staffWage(rating: number): number {
  return niceMoney(800 * Math.exp(0.06 * (rating - 30)));
}

export function generateCoach(ctx: GenCtx, level: number, clubId: string | null, philosophy?: CoachPhilosophy): Coach {
  const nat = randomNationality(ctx, 0.12);
  const pool = namePool(nat);
  const age = clamp(Math.round(ctx.rng.gauss(48, 8)), 32, 70);
  const g = (bias = 0) => clamp(Math.round(level + bias + ctx.rng.gauss(0, 9)), 5, 99);
  const phil = philosophy ?? ctx.rng.pick(PHILOSOPHIES);
  const attrs: CoachAttributes = {
    tattica: g(phil === 'difensivo' || phil === 'superiorita' ? 4 : 0),
    preparazione: g(),
    giovani: g(phil === 'giovani' ? 10 : -2),
    spogliatoio: g(),
    esperienza: clamp(Math.round((age - 30) * 2 + level * 0.5 + ctx.rng.gauss(0, 8)), 5, 99),
    motivazione: g(),
    adattabilita: g(phil === 'equilibrato' ? 5 : 0),
    reputazione: clamp(Math.round(level * 1.05 - 8 + ctx.rng.gauss(0, 6)), 1, 99),
  };
  const c: Coach = {
    id: ctx.newId('k'),
    firstName: ctx.rng.pick(pool.first),
    lastName: ctx.rng.pick(pool.last),
    nationality: nat,
    birthYear: ctx.season - age,
    attrs,
    philosophy: phil,
    clubId,
    contract: null,
    security: 70,
    history: [],
    trophies: 0,
  };
  if (clubId) c.contract = { wage: coachWage(coachRating(c)), endSeason: ctx.season + ctx.rng.int(0, 2) };
  return c;
}

export function generateStaff(ctx: GenCtx, role: StaffRole, level: number, clubId: string | null): StaffMember {
  const nat = randomNationality(ctx, 0.08);
  const pool = namePool(nat);
  const rating = clamp(Math.round(level + ctx.rng.gauss(0, 9)), 5, 99);
  const s: StaffMember = {
    id: ctx.newId('s'),
    firstName: ctx.rng.pick(pool.first),
    lastName: ctx.rng.pick(pool.last),
    nationality: nat,
    birthYear: ctx.season - clamp(Math.round(ctx.rng.gauss(45, 9)), 26, 68),
    role,
    rating,
    clubId,
    contract: null,
  };
  if (clubId) s.contract = { wage: staffWage(rating), endSeason: ctx.season + ctx.rng.int(0, 2) };
  return s;
}
