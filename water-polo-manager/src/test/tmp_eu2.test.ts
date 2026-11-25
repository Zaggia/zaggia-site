import { it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { teamStrength } from '../engine/club/lineup';
import { REAL_FOREIGN, FOREIGN_CITY_SIZE } from '../engine/data/realClubs';
import { NATIONS } from '../engine/data/names';
it('eu2', () => {
  const w: any = createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 21,
  });
  const rank = new Map<string, number>(); const rows: string[] = []; let dsum = 0, n = 0;
  for (const fc of REAL_FOREIGN) {
    const r = rank.get(fc.nation) ?? 0; rank.set(fc.nation, r + 1);
    const size = FOREIGN_CITY_SIZE[fc.city] ?? 2;
    const lvl = Math.max(52, Math.min(86, 57 + NATIONS[fc.nation].school * 4.2 - r * 2.4 + size * 0.8 + (fc.bonus ?? 0)));
    const c = Object.values(w.clubs).find((x: any) => x.name === fc.name) as any;
    if (!c) continue;
    const s = teamStrength(w, c); dsum += s - lvl; n++;
    rows.push(`${fc.nation} ${fc.name} r${r} lvl ${lvl.toFixed(0)} str ${s} bonus ${fc.bonus ?? 0}`);
  }
  console.log('OFFSET mean', (dsum / n).toFixed(1)); console.log(rows.join('\n'));
});
