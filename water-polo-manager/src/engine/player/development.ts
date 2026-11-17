// Crescita e declino dei giocatori: allenamento settimanale, età, minuti giocati,
// personalità, strutture e staff. Non tutti raggiungono il potenziale.

import type { Rng } from '../rng';
import { ALL_ATTRS, GK_ATTRS, MENT_ATTRS, PHYS_ATTRS, TECH_ATTRS, type AttrKey, type Club, type Player, type World } from '../types';
import { clamp } from '../util';
import { ROLE_WEIGHTS, computeOverall } from './attributes';
import { ageOf, refreshValue } from './value';
import { physicalFactor, trainingFactor } from '../club/facilities';

/** Crescita annua dell'overall in funzione dell'età (prima dei moltiplicatori). */
const CURVE: [number, number][] = [
  [15, 6], [16, 5.5], [17, 5], [18, 4.5], [19, 4], [20, 3.5], [21, 3], [22, 2.4], [23, 1.8], [24, 1.2], [25, 0.7], [26, 0.3],
  [27, 0.1], [28, 0], [29, -0.6], [30, -1.1], [31, -1.7], [32, -2.4], [33, -3.1], [34, -3.9],
];

export function ageCurve(age: number, gk: boolean): number {
  const a = gk ? age - 2 : age;
  if (a < 15) return 6;
  for (const [k, v] of CURVE) if (a <= k) return v;
  return -5;
}

/** Crescita ancora possibile (in punti di overall) da questa età al picco di carriera. */
export function remainingGrowth(age: number, gk = false): number {
  let t = 0;
  for (let a = age; a <= 28; a++) t += Math.max(0, ageCurve(a, gk));
  return t;
}

const TRAINING_WEEKS = 42;

const FOCUS_GROUPS: Record<string, Partial<Record<'tecnica' | 'fisico' | 'mentale' | 'portiere', number>>> = {
  bilanciato: { tecnica: 1, fisico: 1, mentale: 1, portiere: 1 },
  tecnico: { tecnica: 1.45, fisico: 0.75, mentale: 0.9, portiere: 1.2 },
  fisico: { tecnica: 0.75, fisico: 1.5, mentale: 0.85, portiere: 0.9 },
  tattico: { tecnica: 0.85, fisico: 0.8, mentale: 1.35, portiere: 0.9 },
  speciali: { tecnica: 1.15, fisico: 0.8, mentale: 1.05, portiere: 1.0 },
  recupero: { tecnica: 0.5, fisico: 0.5, mentale: 0.6, portiere: 0.5 },
};

function groupOf(k: AttrKey): 'tecnica' | 'fisico' | 'mentale' | 'portiere' {
  if ((TECH_ATTRS as readonly string[]).includes(k)) return 'tecnica';
  if ((PHYS_ATTRS as readonly string[]).includes(k)) return 'fisico';
  if ((MENT_ATTRS as readonly string[]).includes(k)) return 'mentale';
  return 'portiere';
}

export interface DevContext {
  training: number;
  physical: number;
  coachYouth: number;
  coachFitness: number;
  gkCoach: number;
  intensity: number;
  focus: string;
  youthAcademy: number;
}

export function devContext(world: World, club: Club | null): DevContext {
  if (!club) {
    return { training: 0.75, physical: 0.75, coachYouth: 30, coachFitness: 30, gkCoach: 0, intensity: 0.85, focus: 'bilanciato', youthAcademy: 0.8 };
  }
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  const gk = club.staff.portieri ? world.staff[club.staff.portieri] : null;
  const fit = club.staff.atletico ? world.staff[club.staff.atletico] : null;
  return {
    training: trainingFactor(club),
    physical: physicalFactor(club) * (1 + (fit ? fit.rating / 500 : 0)),
    coachYouth: coach?.attrs.giovani ?? 30,
    coachFitness: coach?.attrs.preparazione ?? 30,
    gkCoach: gk?.rating ?? 0,
    intensity: club.training.intensity === 'alta' ? 1.15 : club.training.intensity === 'bassa' ? 0.85 : 1,
    focus: club.training.focus,
    youthAcademy: 0.8 + club.facilities.giovanile.level * 0.08,
  };
}

/** Sviluppo settimanale di un giocatore. */
export function developWeekly(world: World, p: Player, ctx: DevContext, rng: Rng) {
  const age = ageOf(p, world.season);
  const gk = p.role === 'POR';
  let annual = ageCurve(age, gk);
  const pers = p.personality;
  if (annual > 0) {
    const gap = p.potential - p.overall;
    if (gap <= 0) annual = 0.03;
    else {
      const gapF = clamp(gap / 14, 0.12, 1.0);
      const prof = 0.75 + pers.professionalita / 40 + (p.attrs.determinazione - 50) / 500;
      const minutes = 0.7 + 0.45 * p.playingTime;
      const youthCoach = age <= 21 ? 0.88 + ctx.coachYouth / 400 : 1;
      const academy = p.youth ? ctx.youthAcademy : 1;
      const gkF = gk ? 0.9 + ctx.gkCoach / 300 : 1;
      annual *= gapF * prof * minutes * youthCoach * academy * gkF * Math.pow(ctx.training, 0.7) * ctx.intensity;
    }
  } else {
    // Il declino è più lento per i professionisti e con una buona preparazione fisica.
    annual *= 1.2 - pers.professionalita / 50 - (ctx.physical - 1) * 0.3;
  }
  const weekly = annual / TRAINING_WEEKS;
  if (Math.abs(weekly) < 0.0005) return;
  const focus = FOCUS_GROUPS[ctx.focus] ?? FOCUS_GROUPS.bilanciato;
  const w = ROLE_WEIGHTS[p.role];
  for (const k of ALL_ATTRS) {
    const g = groupOf(k);
    if (g === 'portiere' && !gk) continue;
    const relevance = (w[k] ?? 0) > 0 ? 1 : gk ? 0.25 : 0.45;
    let d: number;
    if (weekly > 0) {
      const indiv = p.devFocus === g ? 1.35 : 1;
      const phys = g === 'fisico' ? ctx.physical : 1;
      d = weekly * relevance * (focus[g] ?? 1) * indiv * phys * rng.float(0.3, 1.7);
    } else {
      // Con l'età cala il fisico, la testa invece migliora un po'.
      // Normalizzato in modo che il calo dell'overall corrisponda alla curva d'età.
      const mult = g === 'fisico' ? 2.0 : g === 'mentale' ? -0.1 : g === 'portiere' ? 0.95 : 0.9;
      d = weekly * relevance * mult * rng.float(0.4, 1.6);
    }
    p.attrs[k] = clamp(Math.round((p.attrs[k] + d) * 100) / 100, 1, 99);
  }
  const before = p.overall;
  p.overall = computeOverall(p.attrs, p.role);
  if (p.overall > p.potential && weekly > 0) p.potential = p.overall;
  if (before !== p.overall) refreshValue(p, world.season);
}

/** Fine stagione: invecchiamento, rivalutazione del potenziale, esperienza. */
export function seasonEndDevelopment(world: World, p: Player, rng: Rng, avgRating: number) {
  const age = ageOf(p, world.season);
  if (age <= 23) {
    let shift = rng.gauss(-0.5, 1.3);
    if (avgRating >= 7.2) shift += 1;
    if (avgRating > 0 && avgRating < 5.8) shift -= 1.5;
    if (p.personality.professionalita <= 6) shift -= 1;
    p.potential = clamp(Math.round(p.potential + shift), p.overall, 99);
  } else if (age >= 27) {
    p.potential = Math.max(p.overall, Math.min(p.potential, p.overall + (age >= 30 ? 0 : 2)));
  }
  p.experience = clamp(p.experience + 3 + p.playingTime * 5, 0, 100);
  p.reputation = clamp(Math.round(p.reputation * 0.7 + (p.overall * 1.1 - 22) * 0.3 + (avgRating > 6.8 ? 2 : 0)), 1, 99);
}

/** Probabilità di ritiro a fine stagione. */
export function retirementChance(p: Player, season: number): number {
  const age = ageOf(p, season);
  if (!p.clubId) {
    // Chi resta senza squadra spesso smette (o torna a giocare solo per passione).
    if (age >= 31) return clamp(0.4 + (age - 31) * 0.12, 0, 0.97);
    if (age >= 19 && p.overall < 35) return 0.55;
    if (age >= 23 && p.overall < 45) return 0.5;
    return 0.2;
  }
  if (age < 31) return 0;
  const base = age >= 38 ? 0.9 : age >= 36 ? 0.55 : age >= 34 ? 0.3 : age >= 33 ? 0.16 : 0.06;
  const lowLevel = p.overall < 35 ? 0.12 : 0;
  return clamp(base + lowLevel - (p.role === 'POR' ? 0.06 : 0), 0, 0.97);
}

export { GK_ATTRS };
