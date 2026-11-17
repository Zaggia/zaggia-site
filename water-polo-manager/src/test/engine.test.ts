import { describe, expect, it } from 'vitest';
import { createMatch, simulateToEnd } from '../engine/match/engine';
import { testCtx, testSetup, testTeam } from './helpers';
import type { TacticsSetup } from '../engine/types';

function agg(ta: Partial<TacticsSetup>, tb: Partial<TacticsSetup>, n = 160, la = 55, lb = 55) {
  const ctx = testCtx(99);
  const A = testTeam(ctx, la, 'A', ta);
  const B = testTeam(ctx, lb, 'B', tb);
  A.coachAdjusts = false; B.coachAdjusts = false;
  const out = { goalsA: 0, centerA: 0, distA: 0, stealsB: 0, exclA: 0, manUpA: 0, energyB: 0 };
  for (let i = 0; i < n; i++) {
    const st = createMatch(testSetup(A, B, 5000 + i));
    simulateToEnd(st);
    out.goalsA += st.score[0];
    out.centerA += st.sides[0].stats.goalTypes['centro'] ?? 0;
    out.distA += st.sides[0].stats.goalTypes['distanza'] ?? 0;
    out.stealsB += st.sides[1].stats.steals;
    out.exclA += st.sides[0].stats.exclusionsDrawn;
    out.manUpA += st.sides[0].stats.manUp;
  }
  return out;
}

describe('motore partita', () => {
  it('è deterministico con lo stesso seed', () => {
    const ctx = testCtx(3);
    const A = testTeam(ctx, 50, 'A');
    const B = testTeam(ctx, 50, 'B');
    const a = createMatch(testSetup(A, B, 1234));
    const b = createMatch(testSetup(A, B, 1234));
    simulateToEnd(a);
    simulateToEnd(b);
    expect(a.score).toEqual(b.score);
    expect(a.events.length).toBe(b.events.length);
  });

  it('la squadra nettamente più forte vince quasi sempre, ma le sorprese esistono', () => {
    const ctx = testCtx(8);
    const strong = testTeam(ctx, 80, 'F');
    const weak = testTeam(ctx, 35, 'D');
    let wins = 0;
    for (let i = 0; i < 100; i++) {
      const st = createMatch(testSetup(strong, weak, 77 + i));
      simulateToEnd(st);
      if (st.score[0] > st.score[1]) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(97);
    const close = { a: testTeam(ctx, 52, 'X'), b: testTeam(ctx, 48, 'Y') };
    let upsets = 0;
    for (let i = 0; i < 200; i++) {
      const st = createMatch(testSetup(close.a, close.b, 300 + i));
      simulateToEnd(st);
      if (st.score[1] > st.score[0]) upsets++;
    }
    expect(upsets).toBeGreaterThan(20);
  });

  it('la zona limita il gioco sul centroboa ma concede il tiro da fuori', () => {
    const vsMan = agg({ offense: 'centroboa' }, { defense: 'uomo' });
    const vsZone = agg({ offense: 'centroboa' }, { defense: 'zona' });
    expect(vsZone.centerA).toBeLessThan(vsMan.centerA * 0.8);
    const distMan = agg({ offense: 'distanza' }, { defense: 'uomo' });
    const distZone = agg({ offense: 'distanza' }, { defense: 'zona' });
    expect(distZone.distA).toBeGreaterThan(distMan.distA);
  });

  it('il pressing recupera più palloni', () => {
    const base = agg({}, { defense: 'uomo' });
    const press = agg({}, { defense: 'pressing' });
    expect(press.stealsB).toBeGreaterThan(base.stealsB * 1.15);
  });

  it('la ricerca dell’espulsione genera più superiorità', () => {
    const base = agg({ offense: 'organizzato' }, {});
    const seek = agg({ offense: 'espulsione' }, {});
    expect(seek.exclA).toBeGreaterThan(base.exclA * 1.1);
  });
});
