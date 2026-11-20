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

describe('offerte con la rosa piena', () => {
  it('si può fare un’offerta anche con 15 giocatori; per firmare si libera un posto', async () => {
    const { userBid, finalizeUserSigning } = await import('../engine/transfer/market');
    const { releasePlayer } = await import('../engine/transfer/contracts');
    const w = newWorld();
    w.day = 5; // mercato estivo aperto
    const user = w.clubs[w.userClubId];
    expect(user.playerIds.length).toBe(15);
    const target = Object.values(w.clubs)
      .filter((c) => c.id !== user.id && c.country === user.country && c.division === user.division)
      .flatMap((c) => c.playerIds.map((id) => w.players[id]))
      .find((p) => !p.youth && p.overall <= 45)!;
    const r = userBid(w, target.id, 10_000_000 > user.finances.balance ? Math.round(user.finances.balance * 0.9) : 10_000_000, false);
    expect('error' in r, 'error' in r ? r.error : '').toBe(false);
    // Accordo (cifra molto alta): si firma solo dopo aver liberato un posto.
    const rich = userBid(w, target.id, Math.max(1000, user.finances.balance - 1000), false);
    if (!('error' in rich) && rich.offer.status === 'accepted') {
      expect(finalizeUserSigning(w, rich.offer.id, { wage: 2000, years: 2, status: 'rotazione' })).toMatch(/Rosa al completo/);
      const out = w.players[user.playerIds[user.playerIds.length - 1]];
      releasePlayer(w, out);
      expect(finalizeUserSigning(w, rich.offer.id, { wage: 2000, years: 2, status: 'rotazione' })).toBeNull();
      expect(user.playerIds).toContain(target.id);
      expect(user.playerIds.length).toBe(15);
    }
  });
});

describe('motivo dell’interesse', () => {
  it('con interesse basso non dice mai "è disposto ad ascoltare": spiega il motivo, anche nel rifiuto della trattativa', async () => {
    const { interestIn } = await import('../engine/transfer/contracts');
    const w = newWorld();
    const user = w.clubs[w.userClubId];
    // Un giocatore di un club di prestigio, ambizioso e fedele, verso un club piccolo.
    const top = Object.values(w.clubs).find((c) => c.name === 'Pro Recco')!;
    const p = w.players[top.playerIds.find((id) => w.players[id].overall >= 70)!];
    p.personality.lealta = 18; p.personality.ambizione = 18;
    const i = interestIn(w, p, user);
    expect(i.value).toBeLessThan(45);
    expect(i.reason).not.toMatch(/disposto ad ascoltare/);
    const r = negotiate(w, p, user, { wage: 50000, years: 2, status: 'titolare' });
    expect(r.result).toBe('reject');
    expect(r.message).toMatch(/non è interessato: /);
    expect(r.message).not.toMatch(/disposto ad ascoltare/);
  });
});
