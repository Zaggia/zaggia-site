// Stato dell'applicazione: il mondo di gioco (mutato in place dal motore), la vista corrente,
// la partita in corso e il salvataggio automatico su IndexedDB.

import { create } from 'zustand';
import type { CareerMeta, World } from '../engine/types';
import { createWorld, type NewCareerOptions } from '../engine/world/generate';
import { blocker, beginNextSeason, continueGame, finishUserMatch, forfeitUserMatch, prepareUserMatch, type Blocker } from '../engine/season/advance';
import { simulateToEnd, stepMatch, type MatchState } from '../engine/match/engine';
import { deleteCareer, getLastCareer, listCareers, loadCareer, renameCareer, saveCareer } from '../db/saves';
import { resolveEvent } from '../engine/events/events';
import { worldRng } from '../engine/world/context';
import { autoLineup } from '../engine/club/lineup';

export type ViewName =
  | 'dashboard' | 'rosa' | 'formazione' | 'tattiche' | 'partite' | 'calendario' | 'classifica' | 'mercato' | 'staff'
  | 'giovani' | 'strutture' | 'finanze' | 'sponsor' | 'competizioni' | 'storia' | 'posta' | 'notizie' | 'player' | 'club'
  | 'match' | 'report' | 'review' | 'impostazioni';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'err' | 'info';
}

export interface LiveMatch {
  fixtureId: string;
  state: MatchState;
  mode: 'live' | 'fast';
  paused: boolean;
  speed: number;
  done: boolean;
  tick: number;
}

interface Store {
  world: World | null;
  meta: CareerMeta | null;
  v: number;
  view: ViewName;
  param?: string;
  stack: { view: ViewName; param?: string }[];
  busy: string | null;
  toasts: Toast[];
  live: LiveMatch | null;
  lastSaved: number;
  saveError: string | null;
  careers: CareerMeta[];
  menuOpen: boolean;

  refreshCareers: () => Promise<void>;
  newCareer: (opts: NewCareerOptions) => Promise<void>;
  openCareer: (id: string) => Promise<boolean>;
  resumeLast: () => Promise<boolean>;
  closeCareer: () => Promise<void>;
  removeCareer: (id: string) => Promise<void>;
  renameCareer: (id: string, name: string) => Promise<void>;
  go: (view: ViewName, param?: string) => void;
  back: () => void;
  touch: () => void;
  act: (fn: (w: World) => string | null | void, ok?: string) => boolean;
  toast: (text: string, kind?: Toast['kind']) => void;
  continueGame: (mode: 'day' | 'auto' | 'week') => Promise<void>;
  startMatch: (mode: 'instant' | 'fast' | 'live') => void;
  liveStep: (steps?: number) => void;
  liveUpdate: (patch: Partial<LiveMatch>) => void;
  finishLive: () => void;
  forfeit: () => void;
  nextSeason: () => void;
  saveNow: () => Promise<void>;
  setMenu: (open: boolean) => void;
  /** Solo per i test automatici (URL con #debug): gioca fino a fine stagione con scelte predefinite. */
  debugAutoplay: () => Promise<number>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 1;

function metaFrom(world: World, prev: CareerMeta | null, name?: string): CareerMeta {
  const club = world.clubs[world.userClubId];
  return {
    id: world.careerId,
    name: name ?? prev?.name ?? club.name,
    clubName: club.name,
    season: world.season,
    day: world.day,
    division: club.division,
    createdAt: prev?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    crest: club.crest,
    difficulty: world.difficulty,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useGame = create<Store>((set, get) => ({
  world: null,
  meta: null,
  v: 0,
  view: 'dashboard',
  stack: [],
  busy: null,
  toasts: [],
  live: null,
  lastSaved: 0,
  saveError: null,
  careers: [],
  menuOpen: false,

  refreshCareers: async () => {
    try {
      set({ careers: await listCareers() });
    } catch {
      set({ careers: [] });
    }
  },

  newCareer: async (opts) => {
    set({ busy: 'Generazione del mondo: società, giocatori, allenatori, calendari…' });
    await sleep(30);
    try {
      const world = createWorld(opts);
      const meta = metaFrom(world, null, opts.careerName);
      set({ world, meta, view: 'dashboard', stack: [], v: get().v + 1, live: null });
      await get().saveNow();
    } catch (e) {
      console.error(e);
      get().toast(`Errore nella creazione della carriera: ${(e as Error).message}`, 'err');
    } finally {
      set({ busy: null });
    }
  },

  openCareer: async (id) => {
    set({ busy: 'Caricamento della carriera…' });
    try {
      const res = await loadCareer(id);
      if (!res) {
        get().toast('Salvataggio non trovato.', 'err');
        return false;
      }
      set({ world: res.world, meta: res.meta, view: 'dashboard', stack: [], v: get().v + 1, live: null });
      return true;
    } catch (e) {
      get().toast(`Impossibile caricare: ${(e as Error).message}`, 'err');
      return false;
    } finally {
      set({ busy: null });
    }
  },

  resumeLast: async () => {
    const id = getLastCareer();
    if (!id) return false;
    return get().openCareer(id);
  },

  closeCareer: async () => {
    await get().saveNow();
    set({ world: null, meta: null, live: null, view: 'dashboard', stack: [] });
    await get().refreshCareers();
  },

  removeCareer: async (id) => {
    await deleteCareer(id);
    await get().refreshCareers();
  },

  renameCareer: async (id, name) => {
    await renameCareer(id, name);
    const meta = get().meta;
    if (meta?.id === id) set({ meta: { ...meta, name } });
    await get().refreshCareers();
  },

  go: (view, param) => {
    const { view: cur, param: curParam, stack } = get();
    if (cur === view && curParam === param) return;
    set({ view, param, stack: [...stack.slice(-30), { view: cur, param: curParam }], menuOpen: false });
    window.scrollTo?.(0, 0);
  },

  back: () => {
    const stack = [...get().stack];
    const prev = stack.pop();
    if (prev) set({ view: prev.view, param: prev.param, stack });
    else set({ view: 'dashboard', param: undefined });
  },

  touch: () => {
    set({ v: get().v + 1 });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().saveNow(), 1500);
  },

  act: (fn, ok) => {
    const w = get().world;
    if (!w) return false;
    try {
      const err = fn(w);
      if (typeof err === 'string' && err) {
        get().toast(err, 'err');
        get().touch();
        return false;
      }
      if (ok) get().toast(ok, 'ok');
      get().touch();
      return true;
    } catch (e) {
      console.error(e);
      get().toast(`Errore: ${(e as Error).message}`, 'err');
      return false;
    }
  },

  toast: (text, kind = 'info') => {
    const t = { id: toastId++, text, kind };
    set({ toasts: [...get().toasts, t].slice(-4) });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), kind === 'err' ? 6000 : 3800);
  },

  continueGame: async (mode) => {
    const w = get().world;
    if (!w || get().busy) return;
    const b0 = blocker(w);
    if (b0) {
      handleBlocker(b0);
      return;
    }
    set({ busy: 'Avanzamento…' });
    const limit = mode === 'day' ? 1 : mode === 'week' ? 7 : 45;
    const importantBefore = w.inbox.filter((m) => m.important && !m.read).length;
    let stop: Blocker | null = null;
    try {
      for (let d = 0; d < limit; d++) {
        const r = continueGame(w, 'day', 1);
        if (r.days === 0) { stop = r.stop; break; }
        set({ v: get().v + 1 });
        const b = blocker(w);
        if (b) { stop = b; break; }
        const imp = w.inbox.filter((m) => m.important && !m.read).length;
        if (mode === 'auto' && imp > importantBefore) {
          get().toast('Ci sono novità importanti nella posta.', 'info');
          break;
        }
        await sleep(0);
      }
    } catch (e) {
      console.error(e);
      get().toast(`Errore durante l’avanzamento: ${(e as Error).message}`, 'err');
    } finally {
      set({ busy: null });
      get().touch();
    }
    if (stop) handleBlocker(stop);
  },

  startMatch: (mode) => {
    const w = get().world;
    if (!w) return;
    const prep = prepareUserMatch(w);
    if ('error' in prep) {
      get().toast(prep.error, 'err');
      return;
    }
    if (mode === 'instant') {
      simulateToEnd(prep.state);
      const rep = finishUserMatch(w, prep.fixture.id, prep.state);
      set({ live: null });
      get().touch();
      if (rep) get().go('report', rep.id);
      return;
    }
    set({
      live: { fixtureId: prep.fixture.id, state: prep.state, mode: mode === 'fast' ? 'fast' : 'live', paused: false, speed: mode === 'fast' ? 60 : 900, done: false, tick: 0 },
    });
    get().go('match');
  },

  liveStep: (steps = 1) => {
    const live = get().live;
    if (!live || live.done) return;
    for (let i = 0; i < steps && !live.state.finished; i++) stepMatch(live.state);
    set({ live: { ...live, tick: live.tick + 1, done: live.state.finished } });
  },

  liveUpdate: (patch) => {
    const live = get().live;
    if (live) set({ live: { ...live, ...patch, tick: live.tick + 1 } });
  },

  finishLive: () => {
    const w = get().world;
    const live = get().live;
    if (!w || !live) return;
    if (!live.state.finished) simulateToEnd(live.state);
    const rep = finishUserMatch(w, live.fixtureId, live.state);
    set({ live: null });
    get().touch();
    if (rep) {
      const { stack } = get();
      set({ view: 'report', param: rep.id, stack: stack.filter((s) => s.view !== 'match') });
    }
  },

  forfeit: () => {
    get().act((w) => forfeitUserMatch(w), 'Partita persa a tavolino.');
  },

  nextSeason: () => {
    get().act((w) => {
      beginNextSeason(w);
    }, 'Inizia la nuova stagione!');
    get().go('dashboard');
  },

  saveNow: async () => {
    const { world, meta } = get();
    if (!world) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const m = metaFrom(world, meta);
    try {
      await saveCareer(world, m);
      set({ meta: m, lastSaved: Date.now(), saveError: null });
    } catch (e) {
      set({ saveError: (e as Error).message });
    }
  },

  setMenu: (open) => set({ menuOpen: open }),

  debugAutoplay: async () => {
    const w = get().world;
    if (!w) return 0;
    const t0 = performance.now();
    let guard = 0;
    while (w.phase === 'regular' && guard++ < 3000) {
      const b = blocker(w);
      if (b?.reason === 'event') {
        const ev = w.events.find((e) => !e.resolved && e.blocking)!;
        resolveEvent(w, ev.id, (ev.choices.find((c) => !c.disabled) ?? ev.choices[0]).id, worldRng(w));
        continue;
      }
      if (b?.reason === 'match') {
        const user = w.clubs[w.userClubId];
        user.lineup = autoLineup(w, user);
        const prep = prepareUserMatch(w);
        if ('error' in prep) { forfeitUserMatch(w); continue; }
        simulateToEnd(prep.state);
        finishUserMatch(w, prep.fixture.id, prep.state);
        continue;
      }
      continueGame(w, 'day', 1);
      if (guard % 10 === 0) { set({ v: get().v + 1 }); await sleep(0); }
    }
    get().touch();
    await get().saveNow();
    return Math.round(performance.now() - t0);
  },
}));

function handleBlocker(b: Blocker) {
  const s = useGame.getState();
  if (b.reason === 'match') s.go('partite');
  else if (b.reason === 'event') s.go('posta', 'decisioni');
  else if (b.reason === 'review') s.go('review');
  else if (b.reason === 'gameover') s.go('review');
}

export function useWorld(): World {
  const w = useGame((s) => s.world);
  useGame((s) => s.v);
  if (!w) throw new Error('Nessuna carriera aperta');
  return w;
}
