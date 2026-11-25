import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { migrateWorld } from '../engine/world/migrate';
import { teamStrength } from '../engine/club/lineup';
import { shiftClub } from '../engine/world/migrate';
import { foreignTargets } from '../engine/world/pyramid';
import type { World } from '../engine/types';

function world(seed = 4): World {
  return createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed,
  });
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const foreignTop = (w: World, n: number) => mean(Object.values(w.clubs).filter((c) => c.country !== 'ITA').map((c) => teamStrength(w, c)).sort((a, b) => b - a).slice(0, n));
const italyTop = (w: World, n: number) => mean(Object.values(w.clubs).filter((c) => c.country === 'ITA' && c.division === 'A1').map((c) => teamStrength(w, c)).sort((a, b) => b - a).slice(0, n));

describe('club europei', () => {
  it('in una carriera nuova i migliori club esteri sono forti almeno quanto i migliori italiani', () => {
    const w = world();
    expect(foreignTop(w, 8)).toBeGreaterThanOrEqual(italyTop(w, 8) + 3);
    expect(foreignTop(w, 16)).toBeGreaterThanOrEqual(80);
  });

  it('una carriera salvata con club esteri indeboliti li ritrova al loro livello (migrazione v15)', () => {
    const w = world(7);
    const targets = foreignTargets();
    for (const c of Object.values(w.clubs)) if (c.country !== 'ITA') shiftClub(w, c.id, teamStrength(w, c) - 9);
    const before = foreignTop(w, 16);
    w.version = 14;
    expect(migrateWorld(w)).toBe(true);
    expect(foreignTop(w, 16)).toBeGreaterThan(before + 5);
    const ferenc = Object.values(w.clubs).find((c) => c.name === 'Ferencváros')!;
    expect(teamStrength(w, ferenc)).toBeGreaterThanOrEqual(targets['Ferencváros'] - 14);
  });
});
