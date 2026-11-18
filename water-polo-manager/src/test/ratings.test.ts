import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { migrateWorld } from '../engine/world/migrate';
import { teamStrength } from '../engine/club/lineup';
import { developWeekly, devContext } from '../engine/player/development';
import { Rng } from '../engine/rng';
import type { World } from '../engine/types';

function newWorld(seed: number): World {
  return createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed,
  });
}
const byLast = (w: World, last: string) => Object.values(w.players).find((p) => p.lastName === last && p.clubId && !p.retired)!;
const top = (w: World, n: number) => Object.values(w.players).filter((p) => p.clubId && !p.retired).sort((a, b) => b.overall - a.overall).slice(0, n);

describe('overall precisi dei giocatori veri', () => {
  it('Granados è il migliore del mondo e i fuoriclasse dominano la classifica dei giocatori', () => {
    const w = newWorld(5);
    const best = top(w, 1)[0];
    expect(best.lastName).toBe('Granados');
    expect(best.overall).toBe(97);
    const names = top(w, 10).map((p) => p.lastName);
    for (const n of ['Argyropoulos', 'Skoumpakis', 'Mandić', 'Manhercz', 'Kakaris']) expect(names, n).toContain(n);
    // Nessun giocatore generato (non famoso) tra i primi 25.
    expect(top(w, 25).every((p) => p.real)).toBe(true);
  });

  it('un giocatore vero ha lo stesso overall in ogni carriera (nessuna casualità) nei club di vertice', () => {
    const a = newWorld(1);
    const b = newWorld(99);
    for (const club of ['Pro Recco', 'Ferencváros', 'CN Atlètic-Barceloneta', 'AN Brescia']) {
      const ca = Object.values(a.clubs).find((c) => c.name === club)!;
      const cb = Object.values(b.clubs).find((c) => c.name === club)!;
      const ra = Object.fromEntries(ca.playerIds.map((id) => [`${a.players[id].firstName} ${a.players[id].lastName}`, a.players[id].overall]));
      const rb = Object.fromEntries(cb.playerIds.map((id) => [`${b.players[id].firstName} ${b.players[id].lastName}`, b.players[id].overall]));
      const real = ca.playerIds.map((id) => a.players[id]).filter((p) => p.real).map((p) => `${p.firstName} ${p.lastName}`);
      expect(real.length, club).toBeGreaterThanOrEqual(8);
      for (const n of real) if (n in rb) expect(rb[n], `${club}: ${n}`).toBe(ra[n]);
      // I loro giocatori veri sono "fissi": il bilanciamento non li tocca.
      expect(ca.playerIds.map((id) => a.players[id]).filter((p) => p.real).every((p) => p.rated), club).toBe(true);
    }
  });

  it('le squadre di vertice sono molto più forti: Recco, Ferencváros, Barceloneta e Olympiacos sopra 84', () => {
    const w = newWorld(7);
    for (const n of ['Pro Recco', 'Ferencváros', 'CN Atlètic-Barceloneta', 'Olympiacos']) {
      const c = Object.values(w.clubs).find((x) => x.name === n)!;
      expect(teamStrength(w, c), n).toBeGreaterThanOrEqual(84);
    }
    const reco = Object.values(w.clubs).find((x) => x.name === 'Pro Recco')!;
    const lastA1 = Object.values(w.clubs).filter((c) => c.division === 'A1' && !c.isUser).map((c) => teamStrength(w, c)).sort((a, b) => a - b)[0];
    expect(teamStrength(w, reco) - lastA1).toBeGreaterThanOrEqual(15);
  });

  it('le vecchie carriere ricevono i valori precisi con la migrazione v9', () => {
    const w = newWorld(3);
    const g = byLast(w, 'Granados');
    for (const k of Object.keys(g.attrs) as (keyof typeof g.attrs)[]) g.attrs[k] = 60;
    g.overall = 60; g.rated = false;
    w.version = 8;
    expect(migrateWorld(w)).toBe(true);
    expect(g.overall).toBe(97);
    expect(g.rated).toBe(true);
    expect(w.version).toBe(9);
  });
});

describe('allenamento', () => {
  it('l’allenamento mirato fa crescere molto di più la caratteristica scelta', () => {
    const w = newWorld(11);
    const club = w.clubs[w.userClubId];
    const base = Object.values(w.players).find((p) => p.clubId === club.id && p.role === 'ALA' && !p.retired)!;
    const mk = (targeted: boolean) => {
      const p = structuredClone(base);
      p.birthYear = w.season - 19; p.potential = 95; p.overall = 50; p.playingTime = 1; p.attrs.tiro = 50;
      if (targeted) p.devAttrs = ['tiro'];
      return p;
    };
    const ctx = devContext(w, club);
    const a = mk(false), b = mk(true);
    const rngA = Rng.fromSeed(5), rngB = Rng.fromSeed(5);
    for (let i = 0; i < 42; i++) { developWeekly(w, a, ctx, rngA); developWeekly(w, b, ctx, rngB); }
    expect(b.attrs.tiro - 50).toBeGreaterThan((a.attrs.tiro - 50) * 1.8);
    expect(b.overall).toBeGreaterThanOrEqual(a.overall);
  });
});
