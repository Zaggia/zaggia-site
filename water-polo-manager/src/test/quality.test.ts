import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { REAL_FOREIGN } from '../engine/data/realClubs';
import { TOP_CLUB_LEVELS } from '../engine/data/playerRatings';
import { stretchOverall } from '../engine/player/scale';
import { migrateWorld } from '../engine/world/migrate';
import { teamStrength } from '../engine/club/lineup';
import { buildMatchSetup } from '../engine/match/setup';
import { createMatch, simulateToEnd } from '../engine/match/engine';
it('la squadra migliore del girone batte quasi sempre le ultime (ma la sorpresa resta possibile)', () => {
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
    expect(top3bot3.up / top3bot3.n, `${div}: le prime tre perdono con le ultime tre`).toBeLessThan(0.1);
    expect(top3bot3.fav / top3bot3.n, `${div}: le prime tre vincono con le ultime tre`).toBeGreaterThan(0.86);
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
  // La tua squadra non perde terreno: sale come tutte le altre sulla scala nuova degli overall (migrazione v13).
  expect(Math.abs(teamStrength(w, user) - Math.round(stretchOverall(before)))).toBeLessThanOrEqual(2);
  const spreadAfter = groups.map(spread);
  expect(Math.min(...spreadAfter), 'ogni girone ha squadre forti e deboli').toBeGreaterThan(Math.max(8, spreadBefore + 3));
  const means = groups.map((g) => g.reduce((t, c) => t + teamStrength(w, c), 0) / g.length);
  expect(Math.max(...means) - Math.min(...means), 'i gironi hanno forza media simile').toBeLessThan(7);
  for (const c of groups.flat()) for (const id of c.playerIds) expect(w.players[id].overall).toBeGreaterThan(0);
});

it('una carriera creata con società e giocatori inventati passa al mondo reale senza rompere nulla', async () => {
  const { migrateWorld } = await import('../engine/world/migrate');
  const { REAL_ROSTERS } = await import('../engine/data/realPlayers');
  const { REAL_LEAGUES } = await import('../engine/data/realClubs');
  const { autoplaySeason } = await import('./autoplay');
  const w = createWorld({ careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona', colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' }, poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 31 });
  // Torna al "vecchio" mondo: società con nomi inventati e giocatori senza dati reali.
  let n = 0;
  for (const c of Object.values(w.clubs)) {
    if (c.isUser) continue;
    c.name = `Pallanuoto Inventata ${++n}`;
    c.short = `X${n.toString(36).toUpperCase().padStart(2, '0')}`.slice(0, 3);
    for (const id of c.playerIds) { w.players[id].real = false; w.players[id].firstName = 'Mario'; w.players[id].lastName = `Rossi${id}`; }
  }
  const counts = (key: string) => Object.values(w.clubs).filter((c) => c.division === key).length;
  const before = { A1: counts('A1'), A2: counts('A2'), B: counts('B'), C: counts('C'), EST: counts('EST') };
  const strengthBefore = Object.fromEntries(Object.values(w.clubs).map((c) => [c.id, teamStrength(w, c)]));
  const user = w.clubs[w.userClubId];
  const userPlayers = [...user.playerIds];
  const total = Object.keys(w.players).length;
  w.version = 3;
  expect(migrateWorld(w)).toBe(true);
  // Nomi reali, categorie e numero di società invariati, società dell'utente intatta.
  const a1 = Object.values(w.clubs).filter((c) => c.division === 'A1').map((c) => c.name);
  for (const rc of REAL_LEAGUES.A1) expect(a1, rc.name).toContain(rc.name);
  expect({ A1: counts('A1'), A2: counts('A2'), B: counts('B'), C: counts('C'), EST: counts('EST') }).toEqual(before);
  expect(user.name).toBe('Aquatica Test');
  expect(user.playerIds).toEqual(userPlayers);
  expect(new Set(Object.values(w.clubs).map((c) => c.short)).size, 'sigle uniche').toBe(Object.keys(w.clubs).length);
  // Giocatori veri dove c'è una rosa pubblica, con la forza di prima e 15 in rosa.
  const recco = Object.values(w.clubs).find((c) => c.name === 'Pro Recco')!;
  expect(recco.playerIds.length).toBe(15);
  expect(recco.playerIds.every((id) => w.players[id].real)).toBe(true);
  for (const [name] of Object.entries(REAL_ROSTERS)) {
    const c = Object.values(w.clubs).find((x) => x.name === name);
    // I grandi club europei guadagnano il loro bonus di forza (migrazione v7).
    const bonus = REAL_FOREIGN.find((f) => f.name === name)?.bonus ?? 0;
    // I club di vertice e quelli di A1 vengono anche rinforzati (migrazioni v9 e v12): possono solo salire.
    if (c && (TOP_CLUB_LEVELS[name] != null || c.division === 'A1')) expect(teamStrength(w, c) - strengthBefore[c.id], name).toBeGreaterThanOrEqual(-3);
    // Le altre categorie e i club esteri salgono sulla scala nuova (migrazione v13).
    else if (c) {
      const d = teamStrength(w, c) - strengthBefore[c.id];
      // I club esteri sono stati ritarati sulla scala europea (v15): rispetto al mondo di partenza, già ritarato, possono scostarsi di più.
      expect(d, name).toBeGreaterThanOrEqual(c.country === 'ITA' ? -6 : -14);
      expect(d, name).toBeLessThanOrEqual(15 + bonus);
    }
  }
  // I giocatori inventati sostituiti sono ritirati: non entrano nel mercato come svincolati.
  const freeAgents = Object.values(w.players).filter((p) => !p.clubId && !p.retired).length;
  expect(freeAgents).toBeLessThan(500);
  expect(Object.keys(w.players).length).toBeGreaterThan(total);
  // Il mondo migrato regge un'intera stagione.
  autoplaySeason(w);
  expect(w.phase === 'review' || w.phase === 'gameover').toBe(true);
}, 120000);

describe('playoff promozione in Serie B', () => {
  const mk = () => createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 5,
  });

  it('le regole di una nuova carriera prevedono i playoff in Serie B', () => {
    const b = mk().rules.leagues.find((l) => l.key === 'B')!;
    expect(b.directPromotion).toBe(0);
    expect(b.postseason.find((p) => p.purpose === 'promotion')?.positions).toEqual([1, 2, 3, 4]);
  });

  it('le carriere esistenti vengono aggiornate dalla migrazione v5', () => {
    const w = mk();
    const b = w.rules.leagues.find((l) => l.key === 'B')!;
    b.directPromotion = 1;
    b.postseason = [];
    w.version = 4;
    expect(migrateWorld(w)).toBe(true);
    expect(w.version).toBe(15);
    expect(b.directPromotion).toBe(0);
    expect(b.postseason).toHaveLength(1);
  });
});

describe('piramide dei livelli', () => {
  it('un titolare dell’ultima di A1 vale più del miglior giocatore di B, e la migrazione v6 sistema i vecchi salvataggi', async () => {
    const { balancePyramid, PYRAMID_BANDS } = await import('../engine/world/pyramid');
    const w = createWorld({
      careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
      colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
      poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 9,
    });
    // Si rovina apposta una squadra di B con un fuoriclasse e una di A1 con un titolare scarso.
    const clubs = Object.values(w.clubs).filter((c) => c.country === 'ITA' && !c.isUser);
    const b = clubs.find((c) => c.division === 'B')!;
    const a1 = clubs.find((c) => c.division === 'A1')!;
    const star = w.players[b.playerIds.find((id) => w.players[id].role !== 'POR')!];
    for (const k of Object.keys(star.attrs) as (keyof typeof star.attrs)[]) star.attrs[k] = 95;
    star.overall = 95;
    const weak = w.players[a1.playerIds.find((id) => w.players[id].role === 'CEN')!];
    for (const k of Object.keys(weak.attrs) as (keyof typeof weak.attrs)[]) weak.attrs[k] = 15;
    weak.overall = 15;
    w.version = 5;
    expect(migrateWorld(w)).toBe(true);
    expect(balancePyramid(w)).toBeGreaterThanOrEqual(0);
    expect(star.overall).toBeLessThan(65);
    expect(weak.overall).toBeGreaterThan(45);
    for (const c of clubs) {
      const s = teamStrength(w, c);
      const [lo, hi] = PYRAMID_BANDS[c.division];
      expect(s).toBeGreaterThanOrEqual(lo - 2);
      expect(s).toBeLessThanOrEqual(hi + 2);
    }
    const best = (div: string) => Math.max(...clubs.filter((c) => c.division === div).flatMap((c) => c.playerIds.map((id) => w.players[id].overall)));
    const worstStarter = (div: string) => Math.min(...clubs.filter((c) => c.division === div).map((c) => w.players[c.playerIds.filter((id) => w.players[id].role === 'CEN')[0]]?.overall ?? 99));
    expect(worstStarter('A1')).toBeGreaterThan(best('B') - 12);
  });
});

describe('prime giornate di campionato', () => {
  it('l’ordine alfabetico della classifica a zero punti non influisce sull’importanza delle partite', async () => {
    const { dynamicImportance } = await import('../engine/match/setup');
    const w = createWorld({
      careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
      colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
      poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 3,
    });
    const first = Object.values(w.fixtures).filter((f) => f.phase === 0 && f.round === 0 && w.competitions[f.compId]?.kind === 'league');
    expect(first.length).toBeGreaterThan(10);
    // Alla prima giornata (round 0) l'importanza è quella di base (0.25, +0.05 se derby di regione), mai quella di uno scontro al vertice.
    for (const f of first) expect(dynamicImportance(w, f)).toBeLessThanOrEqual(0.3001);
  });
});

describe('punteggi realistici', () => {
  it('in una stagione intera i gol per partita restano realistici: niente punteggi folli e i grandi scarti solo con divari enormi', async () => {
    const { autoplaySeason } = await import('./autoplay');
    const w = createWorld({
      careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
      colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
      poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 21,
    });
    autoplaySeason(w);
    let n = 0, tot = 0, huge = 0, rout = 0, max = 0;
    for (const f of Object.values(w.fixtures)) {
      if (!f.played || w.competitions[f.compId]?.kind !== 'league') continue;
      n++; tot += f.hg + f.ag;
      const top = Math.max(f.hg, f.ag);
      max = Math.max(max, top);
      if (top >= 25) huge++;
      if (Math.abs(f.hg - f.ag) >= 14) rout++;
    }
    console.log(`PUNTEGGI ${n} partite, gol medi ${(tot / n).toFixed(1)}, massimo ${max}, 25+ gol: ${huge}, scarto >=14: ${rout} (${((100 * rout) / n).toFixed(1)}%)`);
    expect(tot / n).toBeGreaterThan(19);
    expect(tot / n).toBeLessThan(25);
    expect(max).toBeLessThanOrEqual(24);
    expect(rout / n).toBeLessThan(0.03);
  }, 120000);
});
