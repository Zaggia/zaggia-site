// Stato dell'applicazione: il mondo di gioco (mutato in place dal motore), la vista corrente,
// la partita in corso e il salvataggio automatico su IndexedDB.

import { create } from 'zustand';
import type { CareerMeta, World } from '../engine/types';
import { createWorld, type NewCareerOptions } from '../engine/world/generate';
import { fixUserRoster } from '../engine/club/rosterFix';
import { migrateWorld } from '../engine/world/migrate';
import { blocker, beginNextSeason, continueGame, finishUserMatch, forfeitUserMatch, prepareUserMatch, type Blocker } from '../engine/season/advance';
import { simulateToEnd, stepMatch, type MatchState } from '../engine/match/engine';
import { deleteCareer, getLastCareer, listCareers, loadCareer, renameCareer, saveCareer } from '../db/saves';
import { resolveEvent } from '../engine/events/events';
import { worldRng } from '../engine/world/context';
import { autoLineup } from '../engine/club/lineup';
import * as cloud from '../cloud/cloud';
import { CloudError, type Account, type CloudMeta } from '../cloud/cloud';

export type ViewName =
  | 'dashboard' | 'rosa' | 'formazione' | 'tattiche' | 'partite' | 'calendario' | 'classifica' | 'mercato' | 'staff'
  | 'giovani' | 'strutture' | 'finanze' | 'sponsor' | 'competizioni' | 'storia' | 'posta' | 'notizie' | 'player' | 'club'
  | 'match' | 'report' | 'review' | 'impostazioni';

/** Filtri e scheda del mercato: restano memorizzati quando si apre la scheda di un giocatore e si torna indietro. */
export interface MarketUi {
  tab: 'cerca' | 'osservati' | 'offerte' | 'contratti' | 'movimenti';
  role: string;
  minAge: number;
  maxAge: number;
  minOvr: number;
  maxValue: number;
  scope: 'all' | 'free' | 'listed' | 'ita';
  name: string;
}

export const DEFAULT_MARKET_UI: MarketUi = { tab: 'cerca', role: '', minAge: 16, maxAge: 36, minOvr: 30, maxValue: 0, scope: 'all', name: '' };

export interface CloudState {
  list: CloudMeta[];
  status: 'idle' | 'syncing' | 'ok' | 'error';
  error?: string;
  lastSync?: number;
}

/** Una carriera modificata su due dispositivi: l'utente sceglie quale versione tenere. */
export interface CloudConflict {
  id: string;
  cloudUpdatedAt: number;
}

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
  market: MarketUi;
  setMarket: (patch: Partial<MarketUi>) => void;
  busy: string | null;
  toasts: Toast[];
  live: LiveMatch | null;
  lastSaved: number;
  saveError: string | null;
  careers: CareerMeta[];
  menuOpen: boolean;
  account: Account | null;
  cloud: CloudState;
  conflict: CloudConflict | null;
  /** Sincronizzazione sospesa dall'utente ("Decido dopo"): si gioca solo su questo dispositivo finché non si riapre la carriera. */
  cloudPaused: boolean;

  refreshCareers: () => Promise<void>;
  newCareer: (opts: NewCareerOptions) => Promise<void>;
  openCareer: (id: string) => Promise<boolean>;
  resumeLast: () => Promise<boolean>;
  closeCareer: () => Promise<void>;
  removeCareer: (id: string, alsoCloud?: boolean) => Promise<void>;
  initAccount: () => Promise<void>;
  signIn: (mode: 'login' | 'register', email: string, password: string, consent: boolean) => Promise<string | null>;
  signOut: () => Promise<void>;
  removeAccount: (password: string) => Promise<string | null>;
  refreshCloud: () => Promise<void>;
  syncNow: (force?: boolean, retried?: boolean) => Promise<void>;
  pullCareer: (id: string) => Promise<boolean>;
  resolveConflict: (keep: 'cloud' | 'local' | 'later') => Promise<void>;
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
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPush = 0;
/** Caricamento nel cloud in corso: non se ne avviano due insieme (un secondo caricamento con la base vecchia sembrerebbe un conflitto). */
let uploading = false;
let uploadAgain = false;
/** Versioni del cloud create da questo dispositivo: se il "conflitto" riguarda una di queste, non è un altro dispositivo. */
const myUploads = new Set<number>();
/** Versione (`v`) già salvata: senza modifiche non si riscrive la carriera, così `updatedAt` conta solo i cambiamenti veri. */
let savedV = -1;
const PUSH_EVERY_MS = 20_000;
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
  market: { ...DEFAULT_MARKET_UI },
  setMarket: (patch) => set({ market: { ...get().market, ...patch } }),
  busy: null,
  toasts: [],
  live: null,
  lastSaved: 0,
  saveError: null,
  careers: [],
  menuOpen: false,
  account: null,
  cloud: { list: [], status: 'idle' },
  conflict: null,
  cloudPaused: false,

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
      set({ world, meta, view: 'dashboard', stack: [], market: { ...DEFAULT_MARKET_UI }, v: get().v + 1, live: null, conflict: null });
      savedV = -1;
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
      let { world, meta } = res;
      // Con un account: se un altro dispositivo ha salvato una versione più recente, si prende quella.
      let conflict: CloudConflict | null = null;
      const acc = get().account;
      if (acc) {
        await get().refreshCloud();
        const cm = get().cloud.list.find((c) => c.id === id);
        const synced = cloud.syncedAt(id);
        if (cm && cm.updatedAt > synced) {
          if (meta.updatedAt <= synced) {
            try {
              const down = await cloud.downloadCareer(acc, id);
              world = down.world;
              meta = down.meta;
              await saveCareer(world, meta);
              get().toast('Carriera aggiornata con la versione più recente del cloud.', 'info');
            } catch { /* si gioca con la copia locale */ }
          } else {
            conflict = { id, cloudUpdatedAt: cm.updatedAt };
          }
        }
      }
      const fromVersion = world.version ?? 1;
      const migrated = migrateWorld(world);
      if (migrated) {
        get().toast(fromVersion < 4
          ? 'Salvataggio aggiornato: società e giocatori reali, risultati più realistici, playoff in Serie B e coppe europee vere (Champions League, Euro Cup, Conference Cup).'
          : fromVersion < 7
            ? 'Salvataggio aggiornato: coppe europee vere (Champions League con Final Four, Euro Cup, Conference Cup, Super Cup) con club e giocatori europei reali.'
            : 'Salvataggio aggiornato.', 'info');
      }
      set({ world, meta, view: 'dashboard', stack: [], market: { ...DEFAULT_MARKET_UI }, v: get().v + 1, live: null, conflict, cloudPaused: false });
      savedV = migrated ? -1 : get().v;
      if (migrated) await get().saveNow();
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
    if (get().account && get().world && !get().conflict && !get().cloudPaused) await get().syncNow();
    set({ world: null, meta: null, live: null, view: 'dashboard', stack: [], conflict: null, cloudPaused: false });
    await get().refreshCareers();
    void get().refreshCloud();
  },

  removeCareer: async (id, alsoCloud = false) => {
    await deleteCareer(id);
    const acc = get().account;
    if (acc && alsoCloud) {
      try {
        await cloud.removeCloud(acc, id);
        await get().refreshCloud();
      } catch (e) {
        get().toast(`Eliminata da questo dispositivo, ma non dal cloud: ${(e as Error).message}`, 'err');
      }
    }
    await get().refreshCareers();
  },

  // ─── Account e cloud ──────────────────────────────────────────────────────

  initAccount: async () => {
    const acc = cloud.loadAccount();
    if (!acc) return;
    if (!(await cloud.checkSession(acc))) {
      cloud.storeAccount(null);
      return;
    }
    set({ account: acc });
    await get().refreshCloud();
  },

  signIn: async (mode, email, password, consent) => {
    try {
      const acc = mode === 'register' ? await cloud.register(email, password, consent) : await cloud.login(email, password);
      cloud.storeAccount(acc);
      set({ account: acc });
      await get().refreshCloud();
      // Le carriere di questo dispositivo che nel cloud non ci sono ancora vengono caricate in background.
      void (async () => {
        for (const c of get().careers) {
          if (get().cloud.list.some((x) => x.id === c.id)) continue;
          try {
            const res = await loadCareer(c.id);
            if (res) await cloud.uploadCareer(acc, res.world, res.meta);
          } catch { /* si riproverà al prossimo salvataggio */ }
        }
        await get().refreshCloud();
      })();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  },

  signOut: async () => {
    const acc = get().account;
    if (acc) await cloud.logout(acc);
    cloud.storeAccount(null);
    if (pushTimer) clearTimeout(pushTimer);
    set({ account: null, cloud: { list: [], status: 'idle' }, conflict: null });
  },

  removeAccount: async (password) => {
    const acc = get().account;
    if (!acc) return null;
    try {
      await cloud.deleteAccount(acc, password);
      cloud.storeAccount(null);
      for (const c of get().careers) cloud.setSyncedAt(c.id, null);
      set({ account: null, cloud: { list: [], status: 'idle' }, conflict: null });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  },

  refreshCloud: async () => {
    const acc = get().account;
    if (!acc) return;
    try {
      const list = await cloud.listCloud(acc);
      set({ cloud: { ...get().cloud, list, status: get().cloud.status === 'error' ? 'idle' : get().cloud.status, error: undefined } });
    } catch (e) {
      if (e instanceof CloudError && e.status === 401) {
        cloud.storeAccount(null);
        set({ account: null, cloud: { list: [], status: 'idle' } });
        get().toast('La sessione è scaduta: accedi di nuovo per usare il cloud.', 'info');
      } else {
        set({ cloud: { ...get().cloud, status: 'error', error: (e as Error).message } });
      }
    }
  },

  syncNow: async (force = false, retried = false) => {
    const { account: acc, world, meta } = get();
    if (!acc || !world || !meta) return;
    if (get().cloudPaused && !force) return;
    if (get().conflict && !force) return;
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    // Un caricamento è già in corso: se ne farà un altro appena finisce.
    if (uploading) { uploadAgain = true; return; }
    uploading = true;
    set({ cloud: { ...get().cloud, status: 'syncing', error: undefined } });
    try {
      const saved = await cloud.uploadCareer(acc, world, meta, force);
      myUploads.add(saved.updatedAt);
      lastPush = Date.now();
      set({ conflict: null, cloud: { list: [saved, ...get().cloud.list.filter((c) => c.id !== saved.id)], status: 'ok', lastSync: Date.now() } });
    } catch (e) {
      if (e instanceof CloudError && e.code === 'cloud_newer') {
        const theirs = Number(e.params?.updatedAt ?? 0);
        if (myUploads.has(theirs) && !retried) {
          // La versione "più recente" l'ha caricata questo stesso dispositivo (caricamenti sovrapposti): nessun conflitto vero.
          cloud.setSyncedAt(meta.id, theirs);
          uploading = false;
          return await get().syncNow(force, true);
        }
        set({ conflict: { id: meta.id, cloudUpdatedAt: theirs }, cloud: { ...get().cloud, status: 'error', error: e.message } });
      } else if (e instanceof CloudError && e.status === 401) {
        cloud.storeAccount(null);
        set({ account: null, cloud: { list: [], status: 'idle' } });
        get().toast('La sessione è scaduta: accedi di nuovo per usare il cloud.', 'info');
      } else {
        set({ cloud: { ...get().cloud, status: 'error', error: (e as Error).message } });
      }
    } finally {
      uploading = false;
      if (uploadAgain) {
        uploadAgain = false;
        if (!get().conflict && !get().cloudPaused) pushTimer = setTimeout(() => void get().syncNow(), 2000);
      }
    }
  },

  pullCareer: async (id) => {
    const acc = get().account;
    if (!acc) return false;
    set({ busy: 'Scarico la carriera dal cloud…' });
    try {
      const { world, meta } = await cloud.downloadCareer(acc, id);
      await saveCareer(world, meta);
      await get().refreshCareers();
      set({ busy: null });
      return get().openCareer(id);
    } catch (e) {
      get().toast(`Download non riuscito: ${(e as Error).message}`, 'err');
      return false;
    } finally {
      set({ busy: null });
    }
  },

  resolveConflict: async (keep) => {
    const { conflict } = get();
    if (!conflict) return;
    if (keep === 'later') {
      // L'altro dispositivo è spento: si continua qui, senza chiedere di nuovo e senza toccare il cloud.
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      set({ conflict: null, cloudPaused: true });
      get().toast('Cloud in pausa: continui a giocare su questo dispositivo, senza altre domande. Potrai scegliere quando riapri la carriera.', 'info');
      return;
    }
    if (keep === 'local') {
      set({ conflict: null, cloudPaused: false });
      await get().saveNow();
      await get().syncNow(true);
      get().toast('Versione di questo dispositivo salvata nel cloud.', 'ok');
    } else {
      const ok = await get().pullCareer(conflict.id);
      if (ok) get().toast('Caricata la versione più recente del cloud.', 'ok');
    }
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
    window.scrollTo?.(0, 0);
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
    if (meta && get().v === savedV) return;
    const m = metaFrom(world, meta);
    const v = get().v;
    try {
      await saveCareer(world, m);
      savedV = v;
      set({ meta: m, lastSaved: Date.now(), saveError: null });
      if (get().account && !get().conflict && !get().cloudPaused) {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => void get().syncNow(), Math.max(1500, PUSH_EVERY_MS - (Date.now() - lastPush)));
      }
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
      if (b?.reason === 'roster') {
        fixUserRoster(w);
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
  else if (b.reason === 'roster') { s.go('rosa'); s.toast(b.text, 'err'); }
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
