import { expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { teamStrength } from '../engine/club/lineup';
import { buildMatchSetup } from '../engine/match/setup';
import { createMatch, simulateToEnd } from '../engine/match/engine';
it('la squadra migliore del girone batte quasi sempre le ultime (come in pallanuoto vera)', () => {
  const w = createWorld({ careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona', colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' }, poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 4 });
  const proto = Object.values(w.fixtures)[0];
  const out: string[] = [];
  for (const div of ['A1', 'C']) {
    const comp = w.competitions[`${div}-${w.season}`];
    const grp = comp.phases[0].groups[0].clubIds.map((id) => w.clubs[id]).filter((c) => !c.isUser);
    const ranked = grp.map((c) => ({ c, s: teamStrength(w, c) })).sort((a, b) => b.s - a.s);
    const bins: Record<string, { n: number; fav: number; draw: number; goals: number }> = {};
    let top3bot3 = { n: 0, fav: 0, up: 0 };
    for (let i = 0; i < ranked.length; i++) for (let j = i + 1; j < ranked.length; j++) {
      const a = ranked[i], b = ranked[j];
      const d = a.s - b.s;
      const bin = d < 3 ? '0-3' : d < 6 ? '3-6' : d < 10 ? '6-10' : d < 15 ? '10-15' : '15+';
      for (let r = 0; r < 4; r++) {
        const home = r % 2 === 0 ? a.c : b.c, away = r % 2 === 0 ? b.c : a.c;
        const f = { ...proto, id: `x${i}-${j}-${r}`, homeId: home.id, awayId: away.id, importance: 0.5, neutral: false };
        const st = createMatch(buildMatchSetup(w, f as any));
        simulateToEnd(st);
        const favGoals = home.id === a.c.id ? st.score[0] : st.score[1];
        const dogGoals = home.id === a.c.id ? st.score[1] : st.score[0];
        const e = (bins[bin] ||= { n: 0, fav: 0, draw: 0, goals: 0 });
        e.n++; e.goals += favGoals + dogGoals;
        if (favGoals > dogGoals) e.fav++; else if (favGoals === dogGoals) e.draw++;
        if (i < 3 && j >= ranked.length - 3) { top3bot3.n++; if (favGoals > dogGoals) top3bot3.fav++; else if (favGoals < dogGoals) top3bot3.up++; }
      }
    }
    expect(top3bot3.up / top3bot3.n, `${div}: le prime tre perdono con le ultime tre`).toBeLessThan(0.06);
    expect(top3bot3.fav / top3bot3.n, `${div}: le prime tre vincono con le ultime tre`).toBeGreaterThan(0.92);
    out.push(`${div} forza ${ranked[0].s}->${ranked[ranked.length - 1].s}: prime3 vs ultime3 vince ${(100 * top3bot3.fav / top3bot3.n).toFixed(0)}% perde ${(100 * top3bot3.up / top3bot3.n).toFixed(1)}%`);
    void out;
    if (false) console.log(div, 'forza', ranked[0].s, '→', ranked[ranked.length - 1].s, '| ' + Object.entries(bins).map(([k, v]) => `Δ${k}: fav ${(100 * v.fav / v.n).toFixed(0)}% pari ${(100 * v.draw / v.n).toFixed(0)}% (${(v.goals / v.n).toFixed(1)} gol, n=${v.n})`).join(' | '), `| prime3 vs ultime3: vince ${(100 * top3bot3.fav / top3bot3.n).toFixed(0)}%, perde ${(100 * top3bot3.up / top3bot3.n).toFixed(1)}%`);
  }
});

it('una carriera salvata con le vecchie forze viene riequilibrata (gironi con forti e deboli, la tua squadra intatta)', async () => {
  const { migrateWorld, shiftClub } = await import('../engine/world/migrate');
  const w = createWorld({ careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona', colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' }, poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 12 });
  // Simula un vecchio salvataggio: in Serie C le forze sono schiacciate e legate al girone.
  const comp = w.competitions[`C-${w.season}`];
  const groups = comp.phases[0].groups.map((g) => g.clubIds.map((id) => w.clubs[id]).filter((c) => !c.isUser));
  groups.forEach((g, gi) => g.forEach((c) => shiftClub(w, c.id, 30 + gi * 4 + (c.id.length % 2))));
  const user = w.clubs[w.userClubId];
  const before = teamStrength(w, user);
  const spread = (g: typeof groups[number]) => { const s = g.map((c) => teamStrength(w, c)); return Math.max(...s) - Math.min(...s); };
  const spreadBefore = Math.max(...groups.map(spread));
  w.version = 2;
  expect(migrateWorld(w)).toBe(true);
  expect(teamStrength(w, user)).toBe(before);
  const spreadAfter = groups.map(spread);
  expect(Math.min(...spreadAfter), 'ogni girone ha squadre forti e deboli').toBeGreaterThan(Math.max(8, spreadBefore + 3));
  const means = groups.map((g) => g.reduce((t, c) => t + teamStrength(w, c), 0) / g.length);
  expect(Math.max(...means) - Math.min(...means), 'i gironi hanno forza media simile').toBeLessThan(7);
  for (const c of groups.flat()) for (const id of c.playerIds) expect(w.players[id].overall).toBeGreaterThan(0);
});
