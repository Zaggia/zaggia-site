import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { migrateWorld } from '../engine/world/migrate';
import { autoplaySeason } from './autoplay';
import { DEFAULT_RULES } from '../engine/data/config';
import type { World } from '../engine/types';

function newWorld(): World {
  return createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 21,
  });
}

describe('coppe europee', () => {
  it('nomi e formule reali: Champions League con Final Four, Euro Cup, Conference Cup e Super Cup', () => {
    const rules = DEFAULT_RULES.continental;
    expect(rules.map((c) => c.name)).toEqual([
      'European Aquatics Champions League', 'European Aquatics Euro Cup', 'European Aquatics Conference Cup',
    ]);
    expect(DEFAULT_RULES.cups.some((c) => c.key === 'EUSC' && c.name === 'European Aquatics Super Cup')).toBe(true);
    expect(rules[0].italySlots).toEqual([1, 2]);
    expect(rules[1].italySlots).toEqual([3, 4]);
    expect(rules[2].italySlots).toEqual([5, 6]);
  });

  it('si gioca una stagione intera: gironi, quarti a gironi, Final Four, ottavi con le retrocesse dalla Champions, Super Cup', () => {
    const w = newWorld();
    const season = w.season;
    autoplaySeason(w);
    const cl = w.competitions[`CL-${season}`];
    const ec = w.competitions[`EC-${season}`];
    const cc = w.competitions[`CC-${season}`];
    const eusc = w.competitions[`EUSC-${season}`];
    for (const c of [cl, ec, cc, eusc]) { expect(c).toBeTruthy(); expect(c.finished).toBe(true); expect(c.winnerId).toBeTruthy(); }
    // Champions League: 4 gironi da 4, poi 2 gironi da 4, poi Final Four (2 semifinali e finale).
    expect(cl.phases.map((p) => p.kind)).toEqual(['groups', 'groups', 'knockout']);
    expect(cl.phases[0].groups).toHaveLength(4);
    expect(cl.phases[1].groups.map((g) => g.clubIds.length)).toEqual([4, 4]);
    expect(cl.phases[2].rounds.map((r) => r.ties.length)).toEqual([2, 1]);
    // Euro Cup: 8 qualificate dai gironi + 8 retrocesse dalla Champions League negli ottavi.
    expect(ec.phases[1].rounds.map((r) => r.ties.length)).toEqual([8, 4, 2, 1]);
    const r16 = ec.phases[1].rounds[0].ties.flatMap((t) => [t.homeId!, t.awayId!]);
    const fromCl = cl.phases[0].groups.flatMap((g) => g.clubIds).filter((id) => !cl.phases[1].groups.some((gr) => gr.clubIds.includes(id)));
    expect(fromCl.filter((id) => r16.includes(id))).toHaveLength(8);
    // Conference Cup a eliminazione diretta.
    expect(cc.phases[0].rounds.map((r) => r.ties.length)).toEqual([8, 4, 2, 1]);
    // Nessun club gioca due coppe europee a gironi nella stessa stagione, tranne le retrocesse della Champions.
    const clIds = new Set(cl.phases[0].groups.flatMap((g) => g.clubIds));
    const ecGroupIds = ec.phases[0].groups.flatMap((g) => g.clubIds);
    expect(ecGroupIds.some((id) => clIds.has(id))).toBe(false);
  }, 200000);

  it('i grandi club europei hanno giocatori veri e le vecchie carriere ricevono club, rose e regole nuove (migrazione v7+)', () => {
    const w = newWorld();
    const byName = (n: string) => Object.values(w.clubs).find((c) => c.name === n)!;
    const ftc = byName('Ferencváros');
    expect(ftc.playerIds.map((id) => w.players[id]).filter((p) => p.real).length).toBeGreaterThanOrEqual(8);
    expect(ftc.playerIds).toHaveLength(15);
    // Si ricrea una carriera "vecchia": regole europee di prima, due club in meno.
    for (const n of ["Pays d'Aix Natation", 'Enka SK']) {
      const c = byName(n);
      for (const id of [...c.playerIds, ...c.youthIds]) delete w.players[id];
      delete w.clubs[c.id];
    }
    w.rules.continental = w.rules.continental.map((c) => ({ ...c, name: c.name.replace('European Aquatics', 'LEN'), stage2: undefined, dropTo: undefined }));
    w.rules.cups = w.rules.cups.filter((c) => c.key !== 'EUSC');
    w.version = 6;
    expect(migrateWorld(w)).toBe(true);
    expect(w.version).toBe(10);
    expect(w.rules.continental[0].name).toBe('European Aquatics Champions League');
    expect(w.rules.continental[0].stage2?.groupCount).toBe(2);
    expect(w.rules.cups.some((c) => c.key === 'EUSC')).toBe(true);
    expect(byName("Pays d'Aix Natation").playerIds).toHaveLength(15);
    expect(byName('Enka SK').playerIds).toHaveLength(15);
  });
});
