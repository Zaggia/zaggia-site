import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { migrateWorld } from '../engine/world/migrate';
import { blocker, continueGame } from '../engine/season/advance';
import { promoteYouth } from '../engine/club/manage';
import { signFreeAgent } from '../engine/transfer/market';
import { releasePlayer } from '../engine/transfer/contracts';
import { fillRoster } from '../engine/ai/clubAI';
import { resolveEvent } from '../engine/events/events';
import { worldRng } from '../engine/world/context';
import { REAL_LEAGUES, REAL_FOREIGN } from '../engine/data/realClubs';
import { REAL_ROSTERS } from '../engine/data/realPlayers';
import { ROLES } from '../engine/player/attributes';
import type { World } from '../engine/types';

function newWorld(seed = 3): World {
  return createWorld({
    careerName: 'Test', presidentName: 'Test', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'Piscina Test', founded: 2025, fansName: 'Delfini', objective: 'metaClassifica', difficulty: 'normale', seed,
  });
}

describe('società reali, rose da 15 e ruoli della pallanuoto', () => {
  it('ogni categoria usa le società reali previste', () => {
    const w = newWorld();
    for (const l of w.rules.leagues) {
      const names = new Set(Object.values(w.clubs).filter((c) => c.division === l.key && !c.isUser).map((c) => c.name));
      for (const rc of REAL_LEAGUES[l.key].slice(0, l.groups * l.teamsPerGroup - (l.key === 'C' ? 1 : 0))) expect(names.has(rc.name), rc.name).toBe(true);
    }
    const foreign = new Set(Object.values(w.clubs).filter((c) => c.country !== 'ITA').map((c) => c.name));
    for (const fc of REAL_FOREIGN) expect(foreign.has(fc.name), fc.name).toBe(true);
  });

  it('i club con una rosa pubblica schierano i loro giocatori veri', () => {
    const w = newWorld();
    for (const [name, roster] of Object.entries(REAL_ROSTERS)) {
      const c = Object.values(w.clubs).find((x) => x.name === name);
      if (!c) continue;
      const real = new Set(roster.players.map((p) => p.n));
      const players = c.playerIds.map((id) => w.players[id]);
      const reali = players.filter((p) => p.real);
      expect(reali.length, name).toBeGreaterThanOrEqual(Math.min(13, roster.players.length));
      for (const p of reali) expect(real.has(`${p.firstName} ${p.lastName}`.trim()), `${name}: ${p.firstName} ${p.lastName}`).toBe(true);
    }
    const recco = Object.values(w.clubs).find((x) => x.name === 'Pro Recco')!;
    expect(recco.playerIds.every((id) => w.players[id].real)).toBe(true);
  });

  it('tutte le squadre hanno 15 giocatori con una rosa equilibrata per ruolo', () => {
    const w = newWorld();
    for (const c of Object.values(w.clubs)) {
      const squad = c.playerIds.map((id) => w.players[id]);
      expect(squad.length, c.name).toBe(15);
      expect(squad.filter((p) => p.role === 'POR').length, c.name).toBeGreaterThanOrEqual(2);
      for (const p of squad) expect(ROLES).toContain(p.role);
      for (const p of squad.filter((x) => x.role === 'MAN')) expect(p.hand, 'il mancino tira di sinistro').toBe('L');
    }
  });

  it('la rosa dell’utente non supera il limite e va completata prima delle partite', () => {
    const w = newWorld();
    const user = w.clubs[w.userClubId];
    const youth = user.youthIds.map((id) => w.players[id])[0];
    if (youth) expect(promoteYouth(w, user, youth)).toMatch(/Rosa al completo/);
    const free = Object.values(w.players).find((p) => !p.clubId && !p.retired)!;
    expect(signFreeAgent(w, free, user, { wage: 1000, years: 1, status: 'riserva' })).toMatch(/Rosa al completo/);
    expect(user.playerIds.length).toBe(15);
    // Svincolando un giocatore la rosa scende a 14: il giorno della partita il gioco chiede di completarla.
    releasePlayer(w, w.players[user.playerIds[14]]);
    let guard = 0;
    while (guard++ < 400) {
      const b = blocker(w);
      if (b?.reason === 'roster' || b?.reason === 'match') break;
      if (b?.reason === 'event') {
        // Decisioni casuali: si sceglie un'opzione che non tocca la rosa.
        const ev = w.events.find((e) => !e.resolved && e.blocking)!;
        const choice = ev.choices.filter((c) => !c.disabled && c.id !== 'contratto').at(-1) ?? ev.choices[0];
        resolveEvent(w, ev.id, choice.id, worldRng(w));
        continue;
      }
      if (b) throw new Error('blocco inatteso: ' + b.reason);
      continueGame(w, 'day', 1);
    }
    expect(user.playerIds.length).toBe(14);
    expect(blocker(w)?.reason).toBe('roster');
    expect(fillRoster(w, user).length).toBe(1);
    expect(blocker(w)?.reason).toBe('match');
  });

  it('i vecchi salvataggi vengono aggiornati ai nuovi ruoli', () => {
    const w = newWorld();
    const ids = Object.keys(w.players).slice(0, 40);
    ids.forEach((id, i) => { (w.players[id] as { role: string }).role = i % 2 ? 'ESD' : 'ESS'; });
    w.version = 1;
    expect(migrateWorld(w)).toBe(true);
    for (const id of ids) expect(ROLES).toContain(w.players[id].role);
    expect(w.version).toBe(11);
    expect(migrateWorld(w)).toBe(false);
  });
});
