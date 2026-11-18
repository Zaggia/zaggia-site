import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { contractTerms, negotiate, wageDemand } from '../engine/transfer/contracts';
import { bidRound, bidTerms } from '../engine/transfer/market';
import type { World } from '../engine/types';

function newWorld(): World {
  return createWorld({
    careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 33,
  });
}

function userPlayer(world: World) {
  const club = world.clubs[world.userClubId];
  const p = club.playerIds.map((id) => world.players[id]).sort((a, b) => b.overall - a.overall)[0];
  p.overall = Math.max(p.overall, 55);
  p.wantsToLeave = false;
  p.morale = 55;
  return { club, p };
}

describe('rinnovi: l’ingaggio non sale sempre', () => {
  it('chi è pagato più del suo valore chiede meno del vecchio stipendio', () => {
    const w = newWorld();
    const { club, p } = userPlayer(w);
    const status = p.contract!.status;
    p.contract!.wage = 400000;
    expect(wageDemand(w, p, club, status, 2)).toBeLessThan(400000);
  });

  it('chi è pagato meno del suo valore chiede di più', () => {
    const w = newWorld();
    const { club, p } = userPlayer(w);
    const status = p.contract!.status;
    p.overall = Math.min(95, p.overall + 15);
    p.contract!.wage = 500;
    expect(wageDemand(w, p, club, status, 2)).toBeGreaterThan(500);
  });

  it('un giocatore in calo chiede meno di uno cresciuto', () => {
    const w = newWorld();
    const { club, p } = userPlayer(w);
    const status = p.contract!.status;
    const base = p.overall;
    p.overall = Math.max(30, base - 12);
    const low = wageDemand(w, p, club, status, 2);
    p.overall = Math.min(95, base + 12);
    const high = wageDemand(w, p, club, status, 2);
    expect(high).toBeGreaterThan(low);
  });
});

describe('trattativa con il giocatore', () => {
  it('la richiesta scende giro dopo giro', () => {
    const w = newWorld();
    const { club, p } = userPlayer(w);
    const status = p.contract!.status;
    const t = contractTerms(w, p, club, { wage: 1, years: 2, status });
    expect(t.ask).toBeGreaterThan(t.reserve);
    const asks: number[] = [];
    for (let i = 0; i < t.patience - 1; i++) {
      const r = negotiate(w, p, club, { wage: Math.round(t.reserve * 0.9), years: 2, status });
      if (r.result !== 'counter') break;
      asks.push(r.demand!.wage);
    }
    expect(asks.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < asks.length; i++) expect(asks[i]).toBeLessThanOrEqual(asks[i - 1]);
  });

  it('accetta la sua controproposta al giro successivo', () => {
    const w = newWorld();
    const { club, p } = userPlayer(w);
    const status = p.contract!.status;
    const t = contractTerms(w, p, club, { wage: 1, years: 2, status });
    const first = negotiate(w, p, club, { wage: Math.round(t.reserve * 0.95), years: 2, status });
    expect(first.result).toBe('counter');
    const second = negotiate(w, p, club, { wage: first.demand!.wage, years: first.demand!.years, status });
    expect(second.result).toBe('accept');
  });

  it('un’offerta offensiva lo irrita e chiude la trattativa', () => {
    const w = newWorld();
    const { club, p } = userPlayer(w);
    const status = p.contract!.status;
    const a = negotiate(w, p, club, { wage: 500, years: 2, status });
    expect(a.mood).toBe('offeso');
    const b = negotiate(w, p, club, { wage: 500, years: 2, status });
    expect(b.result).toBe('reject');
    expect(p.negotiationBlockedUntil).toBeGreaterThan(w.day);
  });

  it('chi paga il minimo all’ultimo giro chiude l’accordo', () => {
    const w = newWorld();
    const { club, p } = userPlayer(w);
    const status = p.contract!.status;
    const t = contractTerms(w, p, club, { wage: 1, years: 2, status });
    let res = negotiate(w, p, club, { wage: t.reserve, years: 2, status });
    for (let i = 1; i < t.patience && res.result === 'counter'; i++) res = negotiate(w, p, club, { wage: t.reserve, years: 2, status });
    expect(res.result).toBe('accept');
  });
});

describe('trattativa con il club venditore', () => {
  function target(w: World) {
    const user = w.clubs[w.userClubId];
    const club = Object.values(w.clubs).find((c) => c.id !== user.id && c.country === user.country && c.playerIds.length >= 15)!;
    const p = w.players[club.playerIds[club.playerIds.length - 1]];
    p.wantsToLeave = false;
    return { user, p };
  }

  it('la richiesta scende e si chiude a una cifra intermedia', () => {
    const w = newWorld();
    const { user, p } = target(w);
    const t = bidTerms(w, p, user);
    expect(t.ask).toBeGreaterThan(t.reserve);
    const first = bidRound(w, p, Math.round(t.reserve * 0.9), user);
    if (first.result === 'counter') {
      expect(first.counterFee!).toBeLessThanOrEqual(t.ask);
      const second = bidRound(w, p, first.counterFee!, user);
      expect(second.result).toBe('accept');
    } else {
      expect(['accept', 'reject']).toContain(first.result);
    }
  });

  it('offerte ridicole fanno alzare il club dal tavolo', () => {
    const w = newWorld();
    const { user, p } = target(w);
    bidRound(w, p, 100, user);
    const r = bidRound(w, p, 100, user);
    expect(r.result).toBe('reject');
    expect(bidRound(w, p, 10_000_000, user).result).toBe('reject');
  });
});
