// Scelte tattiche dell'allenatore (AI): in base alla rosa, all'avversario,
// alla filosofia dell'allenatore e alle tattiche effettivamente apprese dalla squadra.

import type { Club, DefenseTactic, ManDownStyle, OffenseTactic, Player, TacticsSetup, World } from '../types';
import {
  DEFENSE, MANDOWN_STYLES, MANUP_CIRCULATION, MANUP_FORMATIONS, MANUP_STRATEGY, OFFENSE, familiarity, organizationCapacity,
} from '../tactics/tactics';
import { avg, topN } from '../util';

export interface Available {
  offense: OffenseTactic[];
  defense: DefenseTactic[];
}

export function availableTactics(world: World, club: Club): Available {
  const cap = organizationCapacity(world, club).total;
  return {
    offense: (Object.keys(OFFENSE) as OffenseTactic[]).filter((t) => OFFENSE[t].complexity <= cap),
    defense: (Object.keys(DEFENSE) as DefenseTactic[]).filter((t) => DEFENSE[t].complexity <= cap),
  };
}

export interface SquadProfile {
  cf: number;
  shooters: number;
  speed: number;
  wings: number;
  passing: number;
  drive: number;
  press: number;
  block: number;
  overall: number;
  topScorerId: string | null;
}

export function squadProfile(world: World, club: Club): SquadProfile {
  const ps = club.playerIds.map((id) => world.players[id]).filter((p): p is Player => !!p && !p.injury);
  const field = ps.filter((p) => p.role !== 'POR');
  const best = topN(field, 9, (p) => p.overall);
  const cfs = field.filter((p) => p.role === 'CEN' || p.role === 'UNI');
  const cf = cfs.length ? Math.max(...cfs.map((p) => p.attrs.giocoCentro * 0.5 + p.attrs.forza * 0.5)) : 25;
  const shooters = avg(topN(field, 3, (p) => p.attrs.tiro + p.attrs.potenzaTiro).map((p) => (p.attrs.tiro + p.attrs.potenzaTiro) / 2));
  const wings = avg(topN(field.filter((p) => p.role === 'ALA' || p.role === 'UNI' || p.role === 'ESD' || p.role === 'ESS'), 2, (p) => p.attrs.precisione).map((p) => p.attrs.precisione));
  const scorer = topN(field, 1, (p) => (p.stats['L']?.goals ?? 0) * 3 + p.attrs.tiro + p.overall)[0];
  return {
    cf,
    shooters,
    speed: avg(best.map((p) => p.attrs.velocita)),
    wings,
    passing: avg(best.map((p) => (p.attrs.passaggio + p.attrs.visione) / 2)),
    drive: avg(best.map((p) => (p.attrs.dribbling + p.attrs.forza) / 2)),
    press: avg(best.map((p) => (p.attrs.marcatura + p.attrs.contrasto) / 2)),
    block: avg(best.map((p) => p.attrs.elevazione)),
    overall: avg(best.map((p) => p.overall)),
    topScorerId: scorer?.id ?? null,
  };
}

export function chooseTactics(world: World, club: Club, opponent?: Club): TacticsSetup {
  const av = availableTactics(world, club);
  const cap = organizationCapacity(world, club).total;
  const me = squadProfile(world, club);
  const opp = opponent ? squadProfile(world, opponent) : null;
  const coach = club.coachId ? world.coaches[club.coachId] : null;
  const phil = coach?.philosophy ?? 'equilibrato';
  const rng = (k: string) => {
    // Rumore deterministico per evitare scelte sempre identiche.
    let h = 0;
    const s = club.id + k + world.day;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return ((h >>> 0) % 1000) / 1000;
  };
  const oppDef = opponent?.tactics.defense;
  const offFit: Record<OffenseTactic, number> = {
    organizzato: 50,
    centroboa: me.cf + (oppDef && ['zona', 'zonaM', 'raddoppio'].includes(oppDef) ? -15 : 0),
    distanza: me.shooters + (oppDef && ['zona', 'raddoppio'].includes(oppDef) ? 12 : 0),
    rapido: me.speed + (opp ? (me.speed - opp.speed) * 0.5 : 0),
    ali: me.wings + (oppDef && ['raddoppio', 'zonaM'].includes(oppDef) ? 12 : 0),
    aggressivo: me.drive - 3,
    circolazione: me.passing + 3,
    espulsione: (me.cf + me.drive) / 2 + 4 + (oppDef && ['aggressiva', 'pressing'].includes(oppDef) ? 10 : 0),
  };
  let bestO: OffenseTactic = 'organizzato';
  let bestOV = -1e9;
  for (const t of av.offense) {
    const fam = familiarity(club, t);
    const aff = OFFENSE[t].affinity.includes(phil) ? 6 : 0;
    const v = (offFit[t] - me.overall) * 1.0 + fam * 0.25 + aff + rng(t) * 4 + (t === 'organizzato' ? 0 : 0);
    if (v > bestOV) { bestOV = v; bestO = t; }
  }
  const weaker = opp ? opp.overall - me.overall : 0;
  const defFit: Record<DefenseTactic, number> = {
    uomo: 50 + (opp ? (me.speed - opp.speed) * 0.6 + (me.press - opp.passing) * 0.4 : 0),
    prudente: 46 + Math.max(0, weaker) * 0.8,
    zona: 50 + (opp ? (opp.cf - opp.shooters) * 0.6 : 0),
    aggressiva: 46 + (me.press - me.overall) * 0.8,
    raddoppio: 46 + (opp ? (opp.cf - opp.shooters) * 0.9 : 0),
    pressing: 44 + (opp ? (me.speed - opp.speed) * 0.8 : 0) - Math.max(0, weaker) * 0.5,
    zonaM: 50 + (opp ? (opp.cf - opp.wings) * 0.7 : 0),
  };
  let bestD: DefenseTactic = 'uomo';
  let bestDV = -1e9;
  for (const t of av.defense) {
    const fam = familiarity(club, t);
    const aff = DEFENSE[t].affinity.includes(phil) ? 6 : 0;
    const v = defFit[t] + fam * 0.25 + aff + rng('d' + t) * 4;
    if (v > bestDV) { bestDV = v; bestD = t; }
  }
  const ps = club.playerIds.map((id) => world.players[id]).filter((p) => p && p.role !== 'POR' && !p.injury);
  const posts = avg(topN(ps, 3, (p) => p.attrs.precisione + p.attrs.giocoCentro).map((p) => (p.attrs.precisione + p.attrs.giocoCentro) / 2));
  const formation = MANUP_FORMATIONS['3-3'].complexity <= cap && me.shooters > posts + 4 ? '3-3' : '4-2';
  const circulation = MANUP_CIRCULATION.veloce.complexity <= cap && me.passing > me.overall ? 'veloce' : 'paziente';
  let strategy: TacticsSetup['manUp']['strategy'] = 'equilibrata';
  if (MANUP_STRATEGY.centro.complexity <= cap && me.cf > me.shooters + 6) strategy = 'centro';
  else if (MANUP_STRATEGY.pali.complexity <= cap && posts > me.shooters) strategy = 'pali';
  else if (MANUP_STRATEGY.perimetro.complexity <= cap && me.shooters > posts + 3) strategy = 'perimetro';
  const shooters = topN(ps, 2, (p) => p.attrs.tiro + p.attrs.potenzaTiro + p.attrs.superiorita).map((p) => p.id);
  let style: ManDownStyle = 'compatta';
  if (MANDOWN_STYLES.aggressiva.complexity <= cap && me.press > me.overall + 5) style = 'aggressiva';
  else if (MANDOWN_STYLES.blocco.complexity <= cap && me.block > me.overall) style = 'blocco';
  else if (opp && opp.shooters > opp.cf + 5) style = 'porta';
  return {
    offense: bestO,
    defense: bestD,
    manUp: { formation, circulation, strategy, shooters },
    manDown: { style, focusPlayerId: opp?.topScorerId ?? null },
  };
}
