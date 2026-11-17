import { describe, it } from 'vitest';
import { createMatch, simulateToEnd } from '../engine/match/engine';
import { testCtx, testSetup, testTeam } from './helpers';

function run(la: number, lb: number, n = 300, ta = {}, tb = {}) {
  const ctx = testCtx(42 + la * 7 + lb);
  const A = testTeam(ctx, la, 'Casa', ta);
  const B = testTeam(ctx, lb, 'Ospiti', tb);
  let w = 0, d = 0, l = 0, gf = 0, ga = 0, excl = 0, mu = 0, mug = 0, shots = 0, poss = 0, counters = 0, cg = 0, pens = 0, saves = 0, tos = 0;
  for (let i = 0; i < n; i++) {
    const st = createMatch(testSetup(A, B, 1000 + i));
    simulateToEnd(st);
    const [h, a] = st.score;
    if (h > a) w++; else if (h === a) d++; else l++;
    gf += h; ga += a;
    for (const s of st.sides) {
      excl += s.stats.exclusionsDrawn; mu += s.stats.manUp; mug += s.stats.manUpGoals; shots += s.stats.shots; poss += s.stats.possessions;
      counters += s.stats.counters; cg += s.stats.counterGoals; pens += s.stats.penalties; saves += s.stats.saves; tos += s.stats.turnovers;
    }
  }
  const per = (x: number) => (x / n / 2).toFixed(1);
  console.log(`${la} vs ${lb}: W${(w / n * 100).toFixed(0)}% D${(d / n * 100).toFixed(0)}% L${(l / n * 100).toFixed(0)}% | gol ${(gf / n).toFixed(1)}-${(ga / n).toFixed(1)} | poss ${per(poss)} tiri ${per(shots)} parate ${per(saves)} espulsioni ${per(excl)} sup ${per(mu)} gol sup ${(mug / Math.max(1, mu) * 100).toFixed(0)}% contropiedi ${per(counters)} (gol ${per(cg)}) rigori ${per(pens)} perse ${per(tos)}`);
}

describe('calibrazione', () => {
  it('stampa statistiche', () => {
    run(50, 50);
    run(75, 75);
    run(35, 35);
    run(55, 50);
    run(60, 50);
    run(70, 50);
    run(80, 35, 100);
    run(45, 40);
  });
});
