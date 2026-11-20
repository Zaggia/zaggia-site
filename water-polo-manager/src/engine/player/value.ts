import type { Player } from '../types';
import { clamp, niceMoney } from '../util';
import { econOverall } from './scale';

export function ageOf(p: { birthYear: number }, season: number): number {
  return season - p.birthYear;
}

/** Stipendio annuo atteso in base al livello del giocatore (in euro). */
export function expectedWage(p: Player, season: number): number {
  // Stipendi e valori sono tarati sulla scala economica: gli overall delle categorie minori sono più alti di prima, i soldi no.
  const ovr = econOverall(p.overall);
  const age = ageOf(p, season);
  let w = 1200 * Math.exp(0.075 * (ovr - 35)) * (1 + Math.max(0, ovr - 80) * 0.08);
  // La reputazione personale fa salire le pretese.
  w *= 0.85 + p.reputation / 300;
  // I giovani con grande potenziale chiedono un po' di più, i veterani un po' meno.
  if (age <= 22) w *= 1 + Math.max(0, p.potential - p.overall) * 0.006;
  if (age >= 33) w *= 0.8;
  return Math.max(500, niceMoney(w));
}

export function yearsLeft(p: Player, season: number): number {
  if (!p.contract) return 0;
  return Math.max(0, p.contract.endSeason - season + 1);
}

/** Valore di mercato. */
export function marketValue(p: Player, season: number): number {
  const age = ageOf(p, season);
  const wage = expectedWage(p, season);
  const ageF = age <= 21 ? 1.5 : age <= 24 ? 1.35 : age <= 28 ? 1.0 : age <= 30 ? 0.8 : age <= 32 ? 0.55 : 0.3;
  const potF = age <= 24 ? 1 + Math.max(0, p.potential - p.overall) * 0.025 : 1;
  const yl = yearsLeft(p, season);
  const contractF = !p.contract ? 0.5 : yl <= 1 ? 0.7 : yl === 2 ? 1.0 : 1.1;
  const formAvg = p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : 6.3;
  const formF = clamp(1 + (formAvg - 6.3) * 0.08, 0.85, 1.2);
  const injF = p.injury && p.injury.daysLeft > 30 ? 0.8 : 1;
  return niceMoney(wage * 4 * ageF * potF * contractF * formF * injF);
}

export function refreshValue(p: Player, season: number) {
  p.value = marketValue(p, season);
}
