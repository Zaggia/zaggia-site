import { describe, expect, it } from 'vitest';
import { createWorld } from '../engine/world/generate';
import { autoplaySeason } from './autoplay';
import { beginNextSeason } from '../engine/season/advance';
import { ledgerTotals } from '../engine/economy/ledger';
import { teamStrength } from '../engine/club/lineup';
import { computeStandings } from '../engine/competition/standings';
import type { World } from '../engine/types';

function newWorld(seed = 7): World {
  return createWorld({
    careerName: 'Test', presidentName: 'Test', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
    colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
    poolName: 'Piscina Test', founded: 2025, fansName: 'Delfini', objective: 'metaClassifica', difficulty: 'normale', seed,
  });
}

function divisionCounts(world: World) {
  const out: Record<string, number> = {};
  for (const c of Object.values(world.clubs)) out[c.division] = (out[c.division] ?? 0) + 1;
  return out;
}

describe('mondo di gioco', () => {
  it('genera il mondo con le categorie previste', () => {
    const w = newWorld();
    expect(divisionCounts(w)).toMatchObject({ A1: 14, A2: 24, B: 40, C: 40 });
    const user = w.clubs[w.userClubId];
    expect(user.division).toBe('C');
    const ovr = user.playerIds.map((id) => w.players[id].overall);
    expect(Math.max(...ovr)).toBeLessThanOrEqual(52);
    expect(Math.min(...ovr)).toBeGreaterThanOrEqual(20);
    // Stesso numero di giocatori (15) in ogni squadra di ogni categoria.
    for (const c of Object.values(w.clubs)) expect(c.playerIds.length, c.name).toBe(15);
    // Tutte le società italiane sono reali (nessun nome generato).
    for (const c of Object.values(w.clubs)) if (!c.isUser) expect(c.name, c.name).not.toMatch(/^Pallanuoto .+ \d+$/);
    expect(Object.values(w.clubs).some((c) => c.name === 'Pro Recco' && c.division === 'A1')).toBe(true);
    const avgStrength = (div: string) => {
      const cs = Object.values(w.clubs).filter((c) => c.division === div);
      return cs.reduce((t, c) => t + teamStrength(w, c), 0) / cs.length;
    };
    console.log('forza media', { A1: avgStrength('A1'), A2: avgStrength('A2'), B: avgStrength('B'), C: avgStrength('C'), utente: teamStrength(w, user) });
    expect(avgStrength('A1')).toBeGreaterThan(avgStrength('A2'));
    expect(avgStrength('A2')).toBeGreaterThan(avgStrength('B'));
    expect(avgStrength('B')).toBeGreaterThan(avgStrength('C'));
    expect(Object.keys(w.competitions).length).toBeGreaterThanOrEqual(8);
  });

  it('gioca più stagioni complete mantenendo il mondo coerente', () => {
    const w = newWorld(11);
    const t0 = Date.now();
    for (let s = 0; s < 5; s++) {
      const season = w.season;
      const ts = Date.now();
      let checked = false;
      autoplaySeason(w, (ww) => {
        // A metà stagione tutte le squadre devono avere la rosa regolamentare (15).
        if (checked || ww.day < 120) return;
        checked = true;
        for (const c of Object.values(ww.clubs)) expect(c.playerIds.length, c.name + (c.isUser ? ' (utente)' : '')).toBe(15);
      });
      if (w.phase === 'gameover') { console.log('GAME OVER', w.gameOverReason); break; }
      const econ: Record<string, { inc: number; exp: number; n: number }> = {};
      for (const c of Object.values(w.clubs)) {
        const t = ledgerTotals(c.finances.ledger);
        const e = (econ[c.division] ||= { inc: 0, exp: 0, n: 0 });
        e.inc += t.income; e.exp += t.expense; e.n++;
      }
      console.log('   economia media per categoria', Object.fromEntries(Object.entries(econ).map(([k, v]) => [k, `+${Math.round(v.inc / v.n / 1000)}k −${Math.round(v.exp / v.n / 1000)}k`])));
      beginNextSeason(w);
      // Niente inflazione: la forza media di ogni categoria resta quella di partenza (il computer non migliora a oltranza).
      for (const [div, target] of Object.entries({ A1: 70, A2: 55, B: 43, C: 35 })) {
        const cs = Object.values(w.clubs).filter((c) => c.division === div && c.country === 'ITA' && !c.isUser);
        const mean = cs.reduce((t, c) => t + teamStrength(w, c), 0) / cs.length;
        expect(Math.abs(mean - target), `${div} forza media ${mean.toFixed(1)}`).toBeLessThanOrEqual(3);
      }
      const prev = season;
      const serieB = w.competitions[`B-${prev}`];
      // In Serie B la promozione si decide ai playoff: una serie per girone, 4 promosse in tutto.
      expect(serieB?.phases.filter((p) => p.purpose === 'promotion').length).toBe(4);
      expect(serieB?.promoted.length).toBe(4);
      const a1 = w.competitions[`A1-${prev}`];
      expect(a1?.finished).toBe(true);
      expect(a1?.winnerId).toBeTruthy();
      const cup = w.competitions[`COPPA-${prev}`];
      const cl = w.competitions[`CL-${prev}`];
      const user = w.clubs[w.userClubId];
      const rec = user.history[user.history.length - 1];
      const players = Object.values(w.players).filter((p) => !p.retired);
      const clubbed = players.filter((p) => p.clubId);
      console.log(`Stagione ${prev}: ${((Date.now() - ts) / 1000).toFixed(1)}s | Campione A1 ${w.clubs[a1!.winnerId!].name} | Coppa ${cup?.winnerId ? w.clubs[cup.winnerId].name : '—'} | CL ${cl?.winnerId ? w.clubs[cl.winnerId].name : '—'} | Utente: ${rec.division} ${rec.outcome} (${rec.points} pt, ${rec.w}-${rec.d}-${rec.l}), saldo ${Math.round(user.finances.balance)} | giocatori ${players.length} (in club ${clubbed.length}) | divisioni ${JSON.stringify(divisionCounts(w))}`);
      expect(divisionCounts(w)).toMatchObject({ A1: 14, A2: 24, B: 40, C: 40 });
      for (const c of Object.values(w.clubs)) {
        for (const id of c.playerIds) expect(w.players[id]?.clubId).toBe(c.id);
      }
      // Finanze AI: quante società in crisi?
      const crisis = Object.values(w.clubs).filter((c) => c.finances.balance < 0).length;
      const byDiv: Record<string, number[]> = {};
      for (const c of Object.values(w.clubs)) (byDiv[c.division] ||= []).push(c.finances.balance);
      console.log('   club in rosso:', crisis, Object.fromEntries(Object.entries(byDiv).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)])));
    }
    console.log('totale', ((Date.now() - t0) / 1000).toFixed(1), 's');
    // La classifica corrente è valida.
    const comp = w.competitions[`C-${w.season}`] ?? w.competitions[`B-${w.season}`];
    expect(computeStandings(w, comp!, 0, 0).length).toBeGreaterThan(5);
  });
});
