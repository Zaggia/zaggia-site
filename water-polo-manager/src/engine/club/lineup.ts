// Formazione: validazione e scelta automatica (usata dall'AI e dal pulsante "Formazione consigliata").

import type { Club, Lineup, Player, World } from '../types';
import { slotSuitability } from '../player/attributes';
import { leagueRules } from '../data/config';

export function isAvailable(p: Player | undefined): p is Player {
  return !!p && !p.injury && p.suspension <= 0 && !p.retired;
}

/** Valore di un giocatore in una posizione, considerando la condizione fisica. */
export function slotValue(p: Player, slot: number): number {
  const cond = 0.75 + 0.25 * (p.condition / 100);
  const morale = 0.95 + 0.1 * (p.morale / 100);
  return p.overall * slotSuitability(p.role, p.hand, slot) * cond * morale;
}

export function foreignLimit(world: World, club: Club): number {
  if (club.country !== 'ITA') return 13;
  try {
    return leagueRules(world.rules, club.division).foreignersOnSheet;
  } catch {
    return 13;
  }
}

export function isForeign(p: Player, club: Club): boolean {
  return p.nationality !== club.country;
}

/** Sceglie automaticamente 7 titolari e la panchina migliore. */
export function autoLineup(world: World, club: Club, opts: { rotate?: boolean } = {}): Lineup {
  const squad = club.playerIds.map((id) => world.players[id]).filter(isAvailable);
  // Se mancano giocatori si attinge al settore giovanile.
  if (squad.length < world.rules.matchSquadSize || !squad.some((p) => p.role === 'POR')) {
    const youth = club.youthIds.map((id) => world.players[id]).filter(isAvailable).sort((a, b) => b.overall - a.overall);
    for (const y of youth) {
      if (squad.length >= world.rules.matchSquadSize && squad.some((p) => p.role === 'POR')) break;
      squad.push(y);
    }
  }
  const limit = foreignLimit(world, club);
  let foreigners = 0;
  const used = new Set<string>();
  const slots: (string | null)[] = [null, null, null, null, null, null, null];
  const canUse = (p: Player) => !used.has(p.id) && (!isForeign(p, club) || foreigners < limit);
  const take = (p: Player) => {
    used.add(p.id);
    if (isForeign(p, club)) foreigners++;
  };
  // Rotazione: chi è molto stanco viene penalizzato.
  const fatigue = (p: Player) => (opts.rotate && p.condition < 75 ? 0.85 : 1);
  // Portiere
  const gks = squad.filter((p) => p.role === 'POR').sort((a, b) => slotValue(b, 0) * fatigue(b) - slotValue(a, 0) * fatigue(a));
  const gk = gks.find(canUse);
  if (gk) { slots[0] = gk.id; take(gk); }
  else {
    // Nessun portiere disponibile: va in porta il giocatore di movimento più adatto.
    const emergency = squad.filter(canUse).sort((a, b) => b.attrs.riflessi + b.attrs.elevazione - (a.attrs.riflessi + a.attrs.elevazione))[0];
    if (emergency) { slots[0] = emergency.id; take(emergency); }
  }
  // Posizioni di movimento: prima quelle più "specialistiche".
  const order = [6, 3, 1, 5, 2, 4];
  for (const slot of order) {
    const best = squad
      .filter((p) => p.role !== 'POR' && canUse(p))
      .sort((a, b) => slotValue(b, slot) * fatigue(b) - slotValue(a, slot) * fatigue(a))[0];
    if (best) { slots[slot] = best.id; take(best); }
  }
  // Panchina: secondo portiere + i migliori rimasti.
  const bench: string[] = [];
  const size = world.rules.matchSquadSize - 7;
  const gk2 = gks.find(canUse);
  if (gk2) { bench.push(gk2.id); take(gk2); }
  const rest = squad
    .filter((p) => p.role !== 'POR' && canUse(p))
    .sort((a, b) => b.overall * fatigue(b) - a.overall * fatigue(a));
  for (const p of rest) {
    if (bench.length >= size) break;
    if (!canUse(p)) continue;
    bench.push(p.id);
    take(p);
  }
  const all = [...slots.filter(Boolean), ...bench] as string[];
  const byLead = all.map((id) => world.players[id]).sort((a, b) => b.attrs.leadership + b.experience * 0.3 - (a.attrs.leadership + a.experience * 0.3));
  const captainId = club.lineup?.captainId && all.includes(club.lineup.captainId) ? club.lineup.captainId : byLead[0]?.id ?? null;
  const pens = all
    .map((id) => world.players[id])
    .filter((p) => p.role !== 'POR')
    .sort((a, b) => b.attrs.tiro + b.attrs.freddezza + b.attrs.precisione - (a.attrs.tiro + a.attrs.freddezza + a.attrs.precisione))
    .slice(0, 5)
    .map((p) => p.id);
  return { slots, bench, captainId, penaltyTakers: pens };
}

export interface LineupIssue {
  level: 'error' | 'warning';
  text: string;
}

export function validateLineup(world: World, club: Club, lineup: Lineup): LineupIssue[] {
  const issues: LineupIssue[] = [];
  const ids = [...lineup.slots, ...lineup.bench].filter(Boolean) as string[];
  if (lineup.slots.some((s) => !s)) issues.push({ level: 'error', text: 'Servono 7 giocatori in acqua (portiere compreso).' });
  const gk = lineup.slots[0] ? world.players[lineup.slots[0]] : null;
  const gkAvailable = [...club.playerIds, ...club.youthIds].some((id) => world.players[id]?.role === 'POR' && isAvailable(world.players[id]));
  if (gk && gk.role !== 'POR') issues.push({ level: gkAvailable ? 'error' : 'warning', text: gkAvailable ? 'In porta deve giocare un portiere.' : `Nessun portiere disponibile: in porta va ${gk.lastName}.` });
  for (let i = 1; i < 7; i++) {
    const p = lineup.slots[i] ? world.players[lineup.slots[i]!] : null;
    if (p && p.role === 'POR') issues.push({ level: 'error', text: `${p.lastName} è un portiere: non può giocare in movimento.` });
  }
  if (new Set(ids).size !== ids.length) issues.push({ level: 'error', text: 'Lo stesso giocatore compare due volte.' });
  if (ids.length > world.rules.matchSquadSize) issues.push({ level: 'error', text: `Massimo ${world.rules.matchSquadSize} giocatori a referto.` });
  for (const id of ids) {
    const p = world.players[id];
    if (!p || p.clubId !== club.id) { issues.push({ level: 'error', text: 'Un giocatore selezionato non fa più parte della rosa.' }); continue; }
    if (p.injury) issues.push({ level: 'error', text: `${p.firstName} ${p.lastName} è infortunato.` });
    if (p.suspension > 0) issues.push({ level: 'error', text: `${p.firstName} ${p.lastName} è squalificato.` });
  }
  const limit = foreignLimit(world, club);
  const foreign = ids.filter((id) => world.players[id] && isForeign(world.players[id], club)).length;
  if (foreign > limit) issues.push({ level: 'error', text: `Troppi stranieri a referto: ${foreign} (massimo ${limit}).` });
  if (!lineup.bench.some((id) => world.players[id]?.role === 'POR')) issues.push({ level: 'warning', text: 'Nessun portiere di riserva in panchina.' });
  for (let i = 0; i < 7; i++) {
    const p = lineup.slots[i] ? world.players[lineup.slots[i]!] : null;
    if (p && i > 0 && slotSuitability(p.role, p.hand, i) < 0.75) {
      issues.push({ level: 'warning', text: `${p.lastName} è fuori ruolo in questa posizione.` });
    }
    if (p && p.condition < 65) issues.push({ level: 'warning', text: `${p.lastName} è molto stanco (${Math.round(p.condition)}%).` });
  }
  if (lineup.bench.length < world.rules.matchSquadSize - 7) issues.push({ level: 'warning', text: 'Panchina incompleta.' });
  return issues;
}

/** Rimuove dalla formazione chi non è disponibile e completa con la scelta automatica. */
export function repairLineup(world: World, club: Club): Lineup {
  const l = club.lineup;
  const errors = validateLineup(world, club, l).filter((i) => i.level === 'error');
  if (!errors.length) return l;
  const auto = autoLineup(world, club);
  const valid = (id: string | null) => {
    if (!id) return false;
    const p = world.players[id];
    return isAvailable(p) && p.clubId === club.id;
  };
  const used = new Set<string>();
  const slots = l.slots.map((id, i) => {
    if (valid(id) && (i === 0) === (world.players[id!].role === 'POR') && !used.has(id!)) { used.add(id!); return id; }
    return null;
  });
  for (let i = 0; i < 7; i++) {
    if (!slots[i]) {
      const cand = [auto.slots[i], ...auto.bench, ...auto.slots].find(
        (id) => id && !used.has(id) && ((i === 0) === (world.players[id].role === 'POR') || id === auto.slots[i]),
      );
      if (cand) { slots[i] = cand; used.add(cand); }
    }
  }
  const bench = l.bench.filter((id) => valid(id) && !used.has(id));
  bench.forEach((id) => used.add(id));
  for (const id of [...auto.bench, ...auto.slots]) {
    if (bench.length >= world.rules.matchSquadSize - 7) break;
    if (id && !used.has(id)) { bench.push(id); used.add(id); }
  }
  const fixed: Lineup = { slots, bench, captainId: used.has(l.captainId ?? '') ? l.captainId : auto.captainId, penaltyTakers: l.penaltyTakers.filter((id) => used.has(id)) };
  if (validateLineup(world, club, fixed).some((i) => i.level === 'error')) return auto;
  return fixed;
}

/** Forza media della squadra (migliori 7 + panchina pesata). */
export function teamStrength(world: World, club: Club): number {
  const ps = club.playerIds.map((id) => world.players[id]).filter((p) => p && !p.retired);
  const gks = ps.filter((p) => p.role === 'POR').sort((a, b) => b.overall - a.overall);
  const field = ps.filter((p) => p.role !== 'POR').sort((a, b) => b.overall - a.overall);
  const top6 = field.slice(0, 6);
  const bench = field.slice(6, 11);
  const gk = gks[0]?.overall ?? 20;
  const t6 = top6.length ? top6.reduce((s, p) => s + p.overall, 0) / top6.length : 20;
  const b = bench.length ? bench.reduce((s, p) => s + p.overall, 0) / bench.length : t6 - 15;
  return Math.round(gk * 0.22 + t6 * 0.6 + b * 0.18);
}
