import { Rng } from '../engine/rng';
import { generatePlayer, shortName } from '../engine/player/generate';
import type { GenCtx } from '../engine/world/context';
import type { MatchSetup, MatchTeamInput } from '../engine/match/engine';
import { defaultTactics, defaultFamiliarity } from '../engine/tactics/tactics';
import type { Role, TacticsSetup } from '../engine/types';

export function testCtx(seed = 1): GenCtx {
  let n = 0;
  return { rng: Rng.fromSeed(seed), season: 2025, newId: (p) => `${p}${n++}` };
}

const ORDER: Role[] = ['POR', 'ALA', 'MAN', 'DIF', 'CVA', 'ALA', 'CEN', 'POR', 'UNI', 'MAN', 'CVA', 'CEN', 'DIF'];

export function testTeam(ctx: GenCtx, level: number, name: string, tactics?: Partial<TacticsSetup>, fam = 70): MatchTeamInput {
  const players = ORDER.map((role, i) => {
    const p = generatePlayer(ctx, { level: level + ctx.rng.gauss(0, 3), role, age: 26 });
    return {
      id: p.id, name: shortName(p), number: i + 1, role: p.role, hand: p.hand, attrs: p.attrs, overall: p.overall,
      condition: 95, morale: 70, formAvg: 6.3, temperament: p.personality.temperamento,
    };
  });
  const t = { ...defaultTactics(), ...tactics };
  const familiarity = defaultFamiliarity(level);
  for (const k of Object.keys(familiarity)) (familiarity as any)[k] = fam;
  return {
    clubId: name, name, short: name.slice(0, 3).toUpperCase(), players, tactics: t, familiarity,
    coach: { tattica: level, motivazione: level, adattabilita: level, esperienza: level, preparazione: level },
    chemistry: 70, fitnessPrep: 60, penaltyTakers: [],
    available: { offense: ['organizzato', 'centroboa', 'distanza', 'rapido', 'ali', 'aggressivo', 'circolazione', 'espulsione'], defense: ['uomo', 'prudente', 'zona', 'aggressiva', 'raddoppio', 'pressing', 'zonaM'] },
    coachAdjusts: true, autoSubs: true,
  };
}

export function testSetup(home: MatchTeamInput, away: MatchTeamInput, seed: number, allowDraw = true): MatchSetup {
  return {
    home: structuredClone(home), away: structuredClone(away), neutral: false, importance: 0.3, allowDraw, periodSeconds: 480, seed,
  };
}
