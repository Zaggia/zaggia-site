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
    // Nessun giocatore generato (non famoso) tra i primi 7 (poi ci sono anche gli svincolati di lusso generati).
    expect(top(w, 7).every((p) => p.real)).toBe(true);
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
    expect(w.version).toBe(12);
  });
});

describe('età dei giocatori veri', () => {
  it('le età sono credibili: nessuno oltre i 44 anni, i veterani oltre i 37 non sono più dei fuoriclasse e i giovani sono tra i 17 e i 44', () => {
    const w = newWorld(5);
    const real = Object.values(w.players).filter((p) => p.real && !p.retired && !p.youth);
    expect(real.length).toBeGreaterThan(500);
    for (const p of real) {
      const age = w.season - p.birthYear;
      expect(age, `${p.firstName} ${p.lastName}`).toBeGreaterThanOrEqual(16);
      expect(age, `${p.firstName} ${p.lastName}`).toBeLessThanOrEqual(44);
      if (age >= 38) expect(p.overall, `${p.firstName} ${p.lastName} (${age} anni)`).toBeLessThanOrEqual(82);
    }
    // I campioni di cui si conosce l'anno di nascita hanno l'età giusta.
    expect(w.season - byLast(w, 'Granados').birthYear).toBe(w.season - 1998);
    expect(w.season - byLast(w, 'Mandić').birthYear).toBe(w.season - 1994);
    expect(w.season - byLast(w, 'Argyropoulos').birthYear).toBe(w.season - 1996);
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

describe('mercato ricco', () => {
  it('una carriera vecchia senza campioni (il migliore è un 84) riceve fuoriclasse e svincolati di livello con la migrazione v11', () => {
    const w = newWorld(8);
    // Si simula una carriera lunga: nessuno sopra 84, mercato degli svincolati povero.
    for (const p of Object.values(w.players)) {
      if (p.clubId === w.userClubId) continue;
      if (p.overall > 84) { for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = Math.max(1, p.attrs[k] - (p.overall - 84)); p.overall = 84; p.rated = false; }
      if (!p.clubId) p.overall = Math.min(p.overall, 60);
    }
    w.version = 10;
    expect(migrateWorld(w)).toBe(true);
    const live = Object.values(w.players).filter((p) => !p.retired && !p.youth);
    expect(Math.max(...live.map((p) => p.overall))).toBeGreaterThanOrEqual(93);
    expect(live.filter((p) => p.clubId && p.overall >= 90).length).toBeGreaterThanOrEqual(8);
    expect(live.filter((p) => !p.clubId && p.overall >= 80).length).toBeGreaterThanOrEqual(4);
    expect(live.filter((p) => !p.clubId && p.overall >= 86).length).toBeGreaterThanOrEqual(1);
  });
});

describe('allenamento e declino', () => {
  it('con palestra, centro di allenamento e intensità alta un veterano perde molto meno e chi è al potenziale continua a migliorare', () => {
    const w = newWorld(3);
    const club = w.clubs[w.userClubId];
    const base = Object.values(w.players).find((p) => p.clubId === club.id && p.role === 'ALA' && !p.retired)!;
    const run = (age: number, potential: number, ctxSetup: () => void) => {
      ctxSetup();
      const ctx = devContext(w, club);
      let tot = 0;
      const n = 25;
      for (let i = 0; i < n; i++) {
        const p = structuredClone(base);
        p.birthYear = w.season - age; p.potential = potential; p.playingTime = 0.9;
        for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = 78;
        p.overall = 78;
        const rng = Rng.fromSeed(500 + i);
        for (let wk = 0; wk < 42; wk++) developWeekly(w, p, ctx, rng);
        tot += p.overall - 78;
      }
      return tot / n;
    };
    const poor = () => { club.facilities.palestra.level = 1; club.facilities.allenamento.level = 1; club.training.intensity = 'media'; };
    const best = () => { club.facilities.palestra.level = 5; club.facilities.allenamento.level = 5; club.training.intensity = 'alta'; };
    const poorOld = run(33, 78, poor), bestOld = run(33, 78, best);
    expect(bestOld).toBeGreaterThan(poorOld + 0.8);
    // Un giocatore nel pieno della carriera già al potenziale, con le strutture al massimo, guadagna ancora qualcosa ogni anno.
    expect(run(27, 78, best)).toBeGreaterThanOrEqual(0.5);
    // E nessuno scende di colpo: un trentunenne con strutture al massimo perde meno di un punto.
    expect(run(31, 78, best)).toBeGreaterThan(-1);
  });
});

