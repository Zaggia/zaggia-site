import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { autoLineup, minutesPlan } from '../engine/club/lineup';
import { buildMatchSetup } from '../engine/match/setup';
import { createMatch, simulateToEnd } from '../engine/match/engine';
import type { World } from '../engine/types';

function newWorld(): World {
  return createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 21,
  });
}

/** Minuti medi giocati dai panchinari in 40 partite simulate con un dato piano. */
function benchMinutes(world: World, minutes: (id: string) => number | undefined) {
  const user = world.clubs[world.userClubId];
  const fx = Object.values(world.fixtures).find((f) => f.homeId === user.id || f.awayId === user.id)!;
  const lineup = autoLineup(world, user);
  lineup.minutes = {};
  for (const id of lineup.bench) { const m = minutes(id); if (m != null) lineup.minutes[id] = m; }
  const out: Record<string, number> = {};
  const runs = 40;
  for (let r = 0; r < runs; r++) {
    world.day = fx.day;
    const setup = buildMatchSetup(world, { ...fx, id: fx.id + r }, lineup);
    const st = createMatch(setup);
    simulateToEnd(st);
    const side = st.setup.home.clubId === user.id ? 0 : 1;
    st.sides[side].p.forEach((p, i) => {
      const pid = st.setup[side === 0 ? 'home' : 'away'].players[i].id;
      if (lineup.bench.includes(pid)) out[pid] = (out[pid] ?? 0) + p.line.seconds / 60 / runs;
    });
  }
  return { out, lineup };
}

describe('minutaggio dei panchinari', () => {
  it('il piano dell’utente sposta i minuti dei panchinari', () => {
    const w = newWorld();
    const user = w.clubs[w.userClubId];
    const lineup = autoLineup(w, user);
    const field = lineup.bench.filter((id) => w.players[id].role !== 'POR');
    const none = benchMinutes(w, () => 0);
    const lots = benchMinutes(w, (id) => (field.includes(id) ? 14 : 0));
    const sum = (o: Record<string, number>) => field.reduce((t, id) => t + (o[id] ?? 0), 0);
    console.log('minuti medi panchinari di movimento: piano 0 =', sum(none.out).toFixed(1), '| piano 14 a testa =', sum(lots.out).toFixed(1), '(attesi ~', field.length * 14, ')');
    expect(sum(lots.out)).toBeGreaterThan(sum(none.out) + 20);
    // ciascuno si avvicina al proprio programma (tolleranza ampia: le rotazioni avvengono a gioco fermo)
    for (const id of field) expect(lots.out[id] ?? 0, w.players[id].lastName).toBeGreaterThan(5);
  });

  it('senza scelte si usano le attese del giocatore', () => {
    const w = newWorld();
    const user = w.clubs[w.userClubId];
    const l = autoLineup(w, user);
    const plan = minutesPlan(w, l);
    for (const id of l.bench) expect(plan[id]).toBeGreaterThanOrEqual(0);
    l.minutes = { [l.bench[0]]: 11 };
    expect(minutesPlan(w, l)[l.bench[0]]).toBe(11);
  });
});

describe('ingaggio dell’allenatore', () => {
  it('dopo un esonero esiste almeno un allenatore disposto ad accettare e la firma riesce', async () => {
    const { fireCoach, hireCoach, coachDemand, coachHireIssue, COACH_MIN_INTEREST, coachInterest } = await import('../engine/club/manage');
    const w = newWorld();
    const user = w.clubs[w.userClubId];
    expect(fireCoach(w, user)).toBeNull();
    const free = Object.values(w.coaches).filter((c) => !c.clubId);
    const ok = free.filter((c) => coachInterest(w, c, user) >= COACH_MIN_INTEREST);
    expect(ok.length).toBeGreaterThan(3);
    const no = free.find((c) => coachInterest(w, c, user) < COACH_MIN_INTEREST);
    if (no) expect(coachHireIssue(w, user, no.id)).toMatch(/non è interessato/);
    const pick = ok[0];
    expect(coachHireIssue(w, user, pick.id, coachDemand(w, pick, user))).toBeNull();
    expect(hireCoach(w, user, pick.id, coachDemand(w, pick, user), 2)).toBeNull();
    expect(user.coachId).toBe(pick.id);
  });
});

describe('niente squalifiche, infortuni rari', () => {
  it('nelle partite non ci sono più cartellini rossi né squalifiche e gli infortuni sono rarissimi', () => {
    const w = newWorld();
    const user = w.clubs[w.userClubId];
    const fx = Object.values(w.fixtures).find((f) => f.homeId === user.id || f.awayId === user.id)!;
    const lineup = autoLineup(w, user);
    let injuries = 0, reds = 0;
    const n = 300;
    for (let r = 0; r < n; r++) {
      w.day = fx.day;
      const st = createMatch(buildMatchSetup(w, { ...fx, id: fx.id + r }, lineup));
      simulateToEnd(st);
      for (const s of st.sides) for (const p of s.p) { if (p.line.injured) injuries++; if (p.line.redCard) reds++; }
    }
    expect(reds).toBe(0);
    // Meno di un infortunio ogni 12 partite (due squadre) in media.
    expect(injuries / n).toBeLessThan(0.09);
    expect(Object.values(w.players).every((p) => (p as unknown as { suspension?: number }).suspension == null)).toBe(true);
  });
});
