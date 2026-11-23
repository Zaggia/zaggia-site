import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { migrateWorld } from '../engine/world/migrate';
import { transferWindowOpen } from '../engine/transfer/market';
import { dayOf } from '../engine/calendar';

describe('mercato estivo fino al 12 ottobre', () => {
  it('una carriera salvata (v13, chiusura al 30 settembre) viene allungata', () => {
    const w = createWorld({
      careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
      colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
      poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 5,
    });
    w.version = 13;
    for (const x of w.rules.windows) if (x.name === 'Mercato estivo') x.end = '09-30';
    w.day = dayOf(w.season, '10-10');
    expect(transferWindowOpen(w).open).toBe(false);
    expect(migrateWorld(w)).toBe(true);
    expect(transferWindowOpen(w).open).toBe(true);
    w.day = dayOf(w.season, '10-12');
    expect(transferWindowOpen(w).open).toBe(true);
    w.day = dayOf(w.season, '10-13');
    expect(transferWindowOpen(w).open).toBe(false);
  });
});
