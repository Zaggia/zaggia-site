import { dayOf, nextWeekday, seasonLength } from '../calendar';
import type { Rng } from '../rng';
import type { Fixture, World } from '../types';
import { newId } from '../world/context';

/** Calendario all'italiana (metodo del cerchio). Restituisce le giornate di andata. */
export function roundRobin(ids: string[], rng: Rng): [string, string][][] {
  const teams: (string | null)[] = rng.shuffle([...ids]);
  if (teams.length % 2 === 1) teams.push(null);
  const n = teams.length;
  const rounds: [string, string][][] = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        // Alternanza casa/trasferta per equilibrio.
        const flip = (r + i) % 2 === 1 || (i === 0 && r % 2 === 1);
        round.push(flip ? [b, a] : [a, b]);
      }
    }
    rounds.push(round);
    // Rotazione: il primo resta fermo.
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

export function isBlackout(world: World, day: number): boolean {
  for (const [a, b] of world.rules.blackouts) {
    if (day >= dayOf(world.season, a) && day <= dayOf(world.season, b)) return true;
  }
  return false;
}

/** Giorni di gioco settimanali (sabato) a partire da una data, saltando le pause. */
export function weeklyDates(world: World, startMmdd: string, count: number, weekdayN = 6): number[] {
  const out: number[] = [];
  let d = nextWeekday(world.season, dayOf(world.season, startMmdd), weekdayN);
  const len = seasonLength(world.season);
  while (out.length < count && d < len - 1) {
    if (!isBlackout(world, d)) out.push(d);
    d += 7;
  }
  // Se la stagione non basta (regolamento con molte giornate), turni infrasettimanali.
  let extra = out.length ? out[out.length - 1] + 3 : 100;
  while (out.length < count) {
    out.push(Math.min(len - 2, extra));
    extra += 3;
  }
  return out.sort((a, b) => a - b);
}

export function createFixture(
  world: World, f: Omit<Fixture, 'id' | 'played' | 'hg' | 'ag'>,
): Fixture {
  const fx: Fixture = { ...f, id: newId(world, 'f'), played: false, hg: 0, ag: 0 };
  world.fixtures[fx.id] = fx;
  return fx;
}

/** Indice dei giorni già occupati da ciascun club. */
export function busyDays(world: World): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>();
  for (const f of Object.values(world.fixtures)) {
    if (f.cancelled) continue;
    for (const c of [f.homeId, f.awayId]) {
      let s = m.get(c);
      if (!s) m.set(c, (s = new Set()));
      s.add(f.day);
    }
  }
  return m;
}

/** Primo giorno ≥ day in cui nessuno dei club gioca nel giorno stesso o in quelli adiacenti. */
export function freeDay(busy: Map<string, Set<number>>, clubs: string[], day: number, maxShift = 10): number {
  for (let d = day; d <= day + maxShift; d++) {
    let ok = true;
    for (const c of clubs) {
      const s = busy.get(c);
      if (s && (s.has(d) || s.has(d - 1) || s.has(d + 1))) { ok = false; break; }
    }
    if (ok) return d;
  }
  return day + maxShift;
}

export function markBusy(busy: Map<string, Set<number>>, clubs: string[], day: number) {
  for (const c of clubs) {
    let s = busy.get(c);
    if (!s) busy.set(c, (s = new Set()));
    s.add(day);
  }
}
