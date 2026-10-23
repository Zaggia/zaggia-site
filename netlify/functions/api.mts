import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { currentZone, distanceM, insideZone, timeline } from "../../public/geo.js";

// Layout dello store (ogni chiave ha un solo scrittore, niente read-modify-write condiviso):
//   g/{code}/game     -> configurazione partita, la scrive solo l'host
//   g/{code}/p/{id}   -> giocatore e posizione, la scrive solo quel giocatore (o l'host per kick)
//   g/{code}/c/{id}   -> cattura del giocatore {id}, creata una sola volta

type LatLng = { lat: number; lng: number };
type Zone = { type: "circle"; center: LatLng; radius: number } | { type: "polygon"; points: LatLng[] };
type Role = "hunter" | "runner" | "referee";

type Settings = {
  durationMin: number;
  headStartMin: number;
  revealEveryMin: number;
  runnersSeeHunters: boolean;
  hunterRevealEveryMin: number;
  autoCatch: boolean;
  catchRadiusM: number;
  dangerRadiusM: number;
  infection: boolean;
  shrinkTo: number;
  outsideReveal: boolean;
};

type Game = {
  code: string;
  hostId: string;
  createdAt: number;
  status: "lobby" | "running" | "ended";
  startedAt?: number;
  endedAt?: number;
  zone: Zone | null;
  settings: Settings;
  roles: Record<string, Role>;
};

type Player = {
  id: string;
  token: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
  pos?: LatLng & { acc: number; at: number };
  ping?: LatLng & { at: number };
  pingKey?: string;
  pingTick?: number;
  outsideSince?: number | null;
};

type Catch = { target: string; by: string; at: number; self?: boolean; auto?: boolean };
type Near = { since: number };

const GAME_TTL_MS = 24 * 3600 * 1000;
const ONLINE_MS = 45 * 1000;
// Cattura automatica: il cacciatore deve restare entro la distanza per questo tempo,
// e le posizioni devono essere recenti (il GPS fermo non basta a prendere qualcuno).
const AUTO_HOLD_MS = 5 * 1000;
const AUTO_FRESH_MS = 25 * 1000;

const DEFAULT_SETTINGS: Settings = {
  durationMin: 60,
  headStartMin: 5,
  revealEveryMin: 5,
  runnersSeeHunters: false,
  hunterRevealEveryMin: 0,
  autoCatch: false,
  catchRadiusM: 30,
  dangerRadiusM: 200,
  infection: false,
  shrinkTo: 100,
  outsideReveal: true,
};

const store = () => getStore({ name: "manhunt", consistency: "strong" });

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const rnd = (alphabet: string, n: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};
const newCode = () => rnd("ABCDEFGHJKLMNPQRSTUVWXYZ", 5);
const newId = () => rnd("abcdefghijklmnopqrstuvwxyz0123456789", 10);
const newToken = () => rnd("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 32);

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const cleanName = (v: unknown) => {
  const name = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
  if (!name) throw new HttpError(400, "Scrivi un nome per giocare.");
  return name;
};

const cleanCode = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");

const cleanLatLng = (v: any): LatLng | null => {
  const lat = Number(v?.lat);
  const lng = Number(v?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

const cleanZone = (v: any): Zone | null => {
  if (!v) return null;
  if (v.type === "circle") {
    const center = cleanLatLng(v.center);
    if (!center) throw new HttpError(400, "Centro della zona non valido.");
    return { type: "circle", center, radius: clamp(v.radius, 50, 20000, 1000) };
  }
  if (v.type === "polygon" && Array.isArray(v.points)) {
    const points = v.points.map(cleanLatLng).filter(Boolean).slice(0, 200) as LatLng[];
    if (points.length < 3) throw new HttpError(400, "Il poligono deve avere almeno 3 punti.");
    return { type: "polygon", points };
  }
  throw new HttpError(400, "Zona non valida.");
};

const cleanSettings = (v: any, prev: Settings): Settings => ({
  durationMin: clamp(v?.durationMin, 5, 600, prev.durationMin),
  headStartMin: clamp(v?.headStartMin, 0, 60, prev.headStartMin),
  revealEveryMin: clamp(v?.revealEveryMin, 0, 60, prev.revealEveryMin),
  runnersSeeHunters: typeof v?.runnersSeeHunters === "boolean" ? v.runnersSeeHunters : prev.runnersSeeHunters,
  hunterRevealEveryMin: clamp(v?.hunterRevealEveryMin, 0, 60, prev.hunterRevealEveryMin),
  autoCatch: typeof v?.autoCatch === "boolean" ? v.autoCatch : prev.autoCatch,
  catchRadiusM: clamp(v?.catchRadiusM, 5, 200, prev.catchRadiusM),
  dangerRadiusM: clamp(v?.dangerRadiusM, 0, 2000, prev.dangerRadiusM),
  infection: typeof v?.infection === "boolean" ? v.infection : prev.infection,
  shrinkTo: clamp(v?.shrinkTo, 10, 100, prev.shrinkTo),
  outsideReveal: typeof v?.outsideReveal === "boolean" ? v.outsideReveal : prev.outsideReveal,
});

async function loadGame(code: string) {
  const s = store();
  const prefix = `g/${code}/`;
  const { blobs } = await s.list({ prefix });
  const gameKey = `${prefix}game`;
  if (!blobs.some((b) => b.key === gameKey)) throw new HttpError(404, "Partita non trovata. Controlla il codice.");

  const entries = await Promise.all(
    blobs.map(async (b) => [b.key, await s.get(b.key, { type: "json" })] as const),
  );
  let game: Game | null = null;
  const players: Record<string, Player> = {};
  const catches: Record<string, Catch> = {};
  const nears: Record<string, Near> = {};
  for (const [key, value] of entries) {
    if (!value) continue;
    const rest = key.slice(prefix.length);
    if (rest === "game") game = value as Game;
    else if (rest.startsWith("p/")) players[rest.slice(2)] = value as Player;
    else if (rest.startsWith("c/")) catches[rest.slice(2)] = value as Catch;
    else if (rest.startsWith("n/")) nears[rest.slice(2)] = value as Near;
  }
  if (!game) throw new HttpError(404, "Partita non trovata. Controlla il codice.");

  if (Date.now() - game.createdAt > GAME_TTL_MS) {
    await Promise.all(blobs.map((b) => s.delete(b.key)));
    throw new HttpError(404, "Questa partita è scaduta (dura al massimo 24 ore).");
  }
  return { game, players, catches, nears, keys: blobs.map((b) => b.key) };
}

function auth(players: Record<string, Player>, id: unknown, token: unknown) {
  const me = players[String(id)];
  if (!me || me.token !== token) throw new HttpError(403, "Non fai più parte di questa partita.");
  return me;
}

function requireHost(game: Game, me: Player) {
  if (game.hostId !== me.id) throw new HttpError(403, "Solo chi ha creato la partita può farlo.");
}

const baseRole = (game: Game, id: string): Role => game.roles[id] ?? "runner";

// Ruolo in gioco: una preda catturata diventa cacciatore (modalità infezione) o resta fuori.
function effectiveRole(game: Game, catches: Record<string, Catch>, id: string) {
  const base = baseRole(game, id);
  if (base === "runner" && catches[id]) return game.settings.infection ? "hunter" : "caught";
  return base;
}

function phaseOf(game: Game, players: Record<string, Player>, catches: Record<string, Catch>, now: number) {
  if (game.status === "lobby") return { phase: "lobby" as const };
  if (game.status === "ended") return { phase: "ended" as const, winner: null, endedAt: game.endedAt ?? now };
  const t = timeline(game);
  const runners = Object.keys(players).filter((id) => baseRole(game, id) === "runner");
  const caught = runners.filter((id) => catches[id]);
  if (runners.length > 0 && caught.length === runners.length) {
    const endedAt = Math.max(...caught.map((id) => catches[id].at));
    return { phase: "ended" as const, winner: "hunters", endedAt };
  }
  if (now >= t.endsAt) return { phase: "ended" as const, winner: "runners", endedAt: t.endsAt };
  if (now < t.huntStart) return { phase: "headstart" as const };
  return { phase: "hunt" as const };
}

const isFresh = (p: Player, now: number) => !!p.pos && now - p.pos.at < 2 * ONLINE_MS;

function buildState(
  game: Game,
  players: Record<string, Player>,
  catches: Record<string, Catch>,
  me: Player,
  now: number,
  nears: Record<string, Near> = {},
) {
  const { phase, ...end } = phaseOf(game, players, catches, now) as any;
  const t = game.status === "lobby" ? null : timeline(game);
  const myRole = effectiveRole(game, catches, me.id);
  const playing = phase === "headstart" || phase === "hunt";
  const seesAll = !playing || myRole === "referee" || myRole === "caught";

  const list = Object.values(players).map((p) => {
    const role = effectiveRole(game, catches, p.id);
    const out: any = {
      id: p.id,
      name: p.name,
      role,
      baseRole: baseRole(game, p.id),
      isHost: p.id === game.hostId,
      online: now - p.lastSeen < ONLINE_MS,
      outside: playing && !!p.outsideSince,
      visibility: "hidden",
    };
    let pos: any = null;
    if (p.id === me.id || seesAll || role === "caught" || role === "referee") {
      pos = p.pos ?? null;
      out.visibility = "live";
    } else if (myRole === "hunter" && role === "runner") {
      if (phase === "headstart") {
        // Vantaggio iniziale: i cacciatori non vedono nulla.
      } else if (game.settings.outsideReveal && p.outsideSince) {
        pos = p.pos ?? null;
        out.visibility = "live";
      } else if (game.settings.revealEveryMin === 0) {
        pos = p.pos ?? null;
        out.visibility = "live";
      } else if (p.ping && p.pingKey === `${game.startedAt}:runner`) {
        pos = p.ping;
        out.visibility = "ping";
      }
    } else if (myRole === "runner" && role === "hunter") {
      if (game.settings.runnersSeeHunters) {
        pos = p.pos ?? null;
        out.visibility = "live";
      } else if (phase === "hunt" && game.settings.hunterRevealEveryMin > 0 && p.ping && p.pingKey === `${game.startedAt}:hunter`) {
        pos = p.ping;
        out.visibility = "ping";
      }
    } else if (myRole === role) {
      pos = p.pos ?? null;
      out.visibility = "live";
    }
    if (pos) out.pos = { lat: pos.lat, lng: pos.lng, acc: pos.acc ?? null, at: pos.at };
    else if (out.visibility !== "hidden") out.visibility = "hidden";
    return out;
  });

  // Allarme vicinanza per le prede e lista prede catturabili per i cacciatori.
  // Calcolati sulle posizioni reali, senza rivelarle.
  let danger: number | null = null;
  let capturing: number | null = null;
  let catchable: { id: string; name: string; dist: number }[] = [];
  if (phase === "hunt" && me.pos && isFresh(me, now)) {
    const others = Object.values(players).filter((p) => p.id !== me.id && isFresh(p, now));
    if (myRole === "runner" && game.settings.dangerRadiusM > 0) {
      const d = others
        .filter((p) => effectiveRole(game, catches, p.id) === "hunter")
        .map((p) => distanceM(me.pos!, p.pos!));
      const min = d.length ? Math.min(...d) : Infinity;
      if (min <= game.settings.dangerRadiusM) danger = Math.ceil(min / 25) * 25;
    }
    if (myRole === "runner" && game.settings.autoCatch && nears[me.id]) {
      capturing = Math.max(0, Math.ceil((nears[me.id].since + AUTO_HOLD_MS - now) / 1000));
    }
    if (myRole === "hunter") {
      catchable = others
        .filter((p) => effectiveRole(game, catches, p.id) === "runner")
        .map((p) => ({ id: p.id, name: p.name, dist: Math.round(distanceM(me.pos!, p.pos!)) }))
        .filter((c) => c.dist <= game.settings.catchRadiusM)
        .sort((a, b) => a.dist - b.dist);
    }
  }

  const name = (id: string) => players[id]?.name ?? "Qualcuno";
  const events: { at: number; text: string; kind: string }[] = [];
  if (t) {
    events.push({ at: t.startedAt, kind: "start", text: "Partita iniziata: le prede scappano." });
    if (now >= t.huntStart) events.push({ at: t.huntStart, kind: "hunt", text: "I cacciatori sono partiti." });
    for (const c of Object.values(catches)) {
      events.push({
        at: c.at,
        kind: "catch",
        text: c.self ? `${name(c.target)} si è arreso.` : `${name(c.by)} ha catturato ${name(c.target)}.`,
      });
    }
    if (playing) {
      for (const p of Object.values(players)) {
        if (p.outsideSince) events.push({ at: p.outsideSince, kind: "outside", text: `${p.name} è fuori zona.` });
      }
    }
    if (phase === "ended") {
      const text =
        end.winner === "hunters"
          ? "Tutte le prede catturate: vincono i cacciatori."
          : end.winner === "runners"
            ? "Tempo scaduto: vincono le prede."
            : "Partita terminata dall'host.";
      events.push({ at: end.endedAt, kind: "end", text });
    }
  }
  const rank: Record<string, number> = { start: 0, hunt: 1, outside: 2, catch: 3, end: 4 };
  events.sort((a, b) => b.at - a.at || rank[b.kind] - rank[a.kind]);

  return {
    now,
    code: game.code,
    phase,
    winner: end.winner ?? null,
    endedAt: end.endedAt ?? null,
    hostId: game.hostId,
    isHost: me.id === game.hostId,
    me: { id: me.id, name: me.name, role: myRole, baseRole: baseRole(game, me.id) },
    settings: game.settings,
    zone: game.zone,
    currentZone: playing ? currentZone(game, now) : game.zone,
    timeline: t,
    players: list,
    catches: Object.values(catches).map((c) => ({ target: c.target, by: c.by, at: c.at, self: !!c.self })),
    danger,
    capturing,
    catchable,
    events: events.slice(0, 30),
  };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Cattura automatica: una preda con un cacciatore entro la distanza di cattura per AUTO_HOLD_MS viene presa.
// Lo stato "sta per essere presa" sta in g/{codice}/n/{id}; può scriverlo chiunque faccia sync,
// il valore è sempre lo stesso istante di inizio, quindi le scritture concorrenti non confliggono.
async function autoCatchPass(
  code: string,
  game: Game,
  players: Record<string, Player>,
  catches: Record<string, Catch>,
  nears: Record<string, Near>,
  now: number,
) {
  const s = store();
  const fresh = (p: Player) => !!p.pos && now - p.pos.at < AUTO_FRESH_MS;
  const all = Object.values(players);
  const hunters = all.filter((p) => effectiveRole(game, catches, p.id) === "hunter" && fresh(p));
  const runners = all.filter((p) => effectiveRole(game, catches, p.id) === "runner" && fresh(p));

  for (const r of runners) {
    let nearest: Player | null = null;
    let best = Infinity;
    for (const h of hunters) {
      const d = distanceM(h.pos!, r.pos!);
      if (d <= game.settings.catchRadiusM && d < best) {
        best = d;
        nearest = h;
      }
    }
    const near = nears[r.id];
    if (!nearest) {
      if (near) {
        delete nears[r.id];
        await s.delete(`g/${code}/n/${r.id}`);
      }
      continue;
    }
    // Un "since" troppo vecchio vuol dire che nessuno ha controllato per un po': si riparte da capo.
    if (!near || now - near.since > 6 * AUTO_HOLD_MS) {
      nears[r.id] = { since: now };
      await s.setJSON(`g/${code}/n/${r.id}`, nears[r.id]);
    } else if (now - near.since >= AUTO_HOLD_MS) {
      const c: Catch = { target: r.id, by: nearest.id, at: now, auto: true };
      const { modified } = await s.setJSON(`g/${code}/c/${r.id}`, c, { onlyIfNew: true });
      catches[r.id] = modified ? c : (catches[r.id] ?? c);
      delete nears[r.id];
      await s.delete(`g/${code}/n/${r.id}`);
    }
  }
}

async function handle(action: string, body: any) {
  const s = store();
  const now = Date.now();

  if (action === "create") {
    const name = cleanName(body.name);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const id = newId();
      const token = newToken();
      const game: Game = {
        code,
        hostId: id,
        createdAt: now,
        status: "lobby",
        zone: null,
        settings: { ...DEFAULT_SETTINGS },
        roles: { [id]: "hunter" },
      };
      const { modified } = await s.setJSON(`g/${code}/game`, game, { onlyIfNew: true });
      if (!modified) continue;
      const player: Player = { id, token, name, joinedAt: now, lastSeen: now };
      await s.setJSON(`g/${code}/p/${id}`, player);
      return { code, id, token };
    }
    throw new HttpError(503, "Non sono riuscito a creare la partita, riprova.");
  }

  const code = cleanCode(body.code);
  if (code.length !== 5) throw new HttpError(400, "Il codice partita ha 5 lettere.");

  if (action === "join") {
    const name = cleanName(body.name);
    const { players } = await loadGame(code);
    if (Object.keys(players).length >= 40) throw new HttpError(409, "La partita è piena (max 40 giocatori).");
    const id = newId();
    const token = newToken();
    await s.setJSON(`g/${code}/p/${id}`, { id, token, name, joinedAt: now, lastSeen: now } satisfies Player);
    return { code, id, token };
  }

  const { game, players, catches, nears, keys } = await loadGame(code);
  const me = auth(players, body.id, body.token);
  const saveGame = () => s.setJSON(`g/${code}/game`, game);
  const clearCatches = () =>
    Promise.all(keys.filter((k) => /^g\/[A-Z]+\/[cn]\//.test(k)).map((k) => s.delete(k)));

  switch (action) {
    case "sync": {
      me.lastSeen = now;
      const pos = cleanLatLng(body.pos);
      if (pos) me.pos = { ...pos, acc: clamp(body.pos.acc, 0, 10000, 0), at: now };

      const { phase } = phaseOf(game, players, catches, now);
      const playing = phase === "headstart" || phase === "hunt";
      const role = effectiveRole(game, catches, me.id);
      if (playing && me.pos && role === "runner") {
        me.outsideSince = insideZone(currentZone(game, now), me.pos) ? null : (me.outsideSince ?? now);
      } else {
        me.outsideSince = null;
      }

      // Segnale periodico: la prima posizione dopo ogni scatto viene mostrata agli avversari.
      // Vale per le prede (verso i cacciatori) e, se l'host lo vuole, per i cacciatori (verso le prede).
      if (phase === "hunt" && me.pos && (role === "runner" || role === "hunter")) {
        const every = (role === "hunter" ? game.settings.hunterRevealEveryMin : game.settings.revealEveryMin) * 60000;
        if (every > 0) {
          const key = `${game.startedAt}:${role}`;
          if (me.pingKey !== key) {
            me.pingKey = key;
            me.pingTick = -1;
            me.ping = undefined;
          }
          const tick = Math.floor((now - timeline(game).huntStart) / every);
          if (tick > (me.pingTick ?? -1)) {
            me.ping = { lat: me.pos.lat, lng: me.pos.lng, at: now };
            me.pingTick = tick;
          }
        }
      }
      await s.setJSON(`g/${code}/p/${me.id}`, me);

      if (phase === "hunt" && game.settings.autoCatch) await autoCatchPass(code, game, players, catches, nears, now);
      return buildState(game, players, catches, me, now, nears);
    }

    case "config": {
      requireHost(game, me);
      if (game.status !== "lobby") throw new HttpError(409, "Puoi cambiare le regole solo prima di iniziare.");
      if ("zone" in body) game.zone = cleanZone(body.zone);
      if (body.settings) game.settings = cleanSettings(body.settings, game.settings);
      if (body.roles && typeof body.roles === "object") {
        for (const [pid, role] of Object.entries(body.roles)) {
          if (players[pid] && ["hunter", "runner", "referee"].includes(role as string)) game.roles[pid] = role as Role;
        }
      }
      await saveGame();
      break;
    }

    case "start": {
      requireHost(game, me);
      if (game.status === "running" && phaseOf(game, players, catches, now).phase !== "ended") break;
      if (!game.zone) throw new HttpError(409, "Prima disegna la zona di gioco sulla mappa.");
      const ids = Object.keys(players);
      if (!ids.some((id) => baseRole(game, id) === "hunter")) throw new HttpError(409, "Serve almeno un cacciatore.");
      if (!ids.some((id) => baseRole(game, id) === "runner")) throw new HttpError(409, "Serve almeno una preda.");
      await clearCatches();
      game.status = "running";
      game.startedAt = now;
      game.endedAt = undefined;
      await saveGame();
      break;
    }

    case "stop": {
      requireHost(game, me);
      if (game.status !== "running") break;
      const ph = phaseOf(game, players, catches, now) as any;
      game.status = "ended";
      game.endedAt = ph.phase === "ended" ? ph.endedAt : now;
      await saveGame();
      break;
    }

    case "reset": {
      requireHost(game, me);
      await clearCatches();
      game.status = "lobby";
      game.startedAt = undefined;
      game.endedAt = undefined;
      await saveGame();
      break;
    }

    case "catch": {
      const target = players[String(body.target)];
      if (!target) throw new HttpError(404, "Giocatore non trovato.");
      const { phase } = phaseOf(game, players, catches, now);
      if (phase !== "hunt") throw new HttpError(409, "Ora non si può catturare nessuno.");
      if (effectiveRole(game, catches, target.id) !== "runner") throw new HttpError(409, `${target.name} non è una preda in gioco.`);
      const myRole = effectiveRole(game, catches, me.id);
      const self = target.id === me.id;
      if (!self && myRole !== "referee") {
        if (myRole !== "hunter") throw new HttpError(403, "Solo i cacciatori possono catturare.");
        if (!isFresh(me, now) || !isFresh(target, now)) throw new HttpError(409, "Posizione non aggiornata, riprova tra poco.");
        const d = distanceM(me.pos!, target.pos!);
        if (d > game.settings.catchRadiusM * 1.5) throw new HttpError(409, `${target.name} è a ${Math.round(d)} m: avvicinati.`);
      }
      const c: Catch = { target: target.id, by: me.id, at: now, self };
      await s.setJSON(`g/${code}/c/${target.id}`, c, { onlyIfNew: true });
      break;
    }

    case "uncatch": {
      requireHost(game, me);
      await s.delete(`g/${code}/c/${String(body.target)}`);
      break;
    }

    case "kick": {
      requireHost(game, me);
      const target = String(body.target);
      if (target === me.id) throw new HttpError(400, "Non puoi espellere te stesso.");
      await s.delete(`g/${code}/p/${target}`);
      await s.delete(`g/${code}/c/${target}`);
      await s.delete(`g/${code}/n/${target}`);
      break;
    }

    case "leave": {
      if (me.id === game.hostId) throw new HttpError(409, "Sei l'host: chiudi la partita invece di uscire.");
      await s.delete(`g/${code}/p/${me.id}`);
      await s.delete(`g/${code}/c/${me.id}`);
      await s.delete(`g/${code}/n/${me.id}`);
      return { ok: true };
    }

    case "delete": {
      requireHost(game, me);
      await Promise.all(keys.map((k) => s.delete(k)));
      return { ok: true };
    }

    default:
      throw new HttpError(404, "Azione sconosciuta.");
  }

  // Dopo ogni azione l'interfaccia riceve lo stato aggiornato.
  const fresh = await loadGame(code);
  return buildState(fresh.game, fresh.players, fresh.catches, fresh.players[me.id] ?? me, Date.now(), fresh.nears);
}

export default async (req: Request) => {
  const action = new URL(req.url).pathname.split("/").pop() ?? "";
  try {
    const body = await req.json().catch(() => ({}));
    return json(await handle(action, body));
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Errore del server, riprova." }, 500);
  }
};

export const config: Config = {
  path: "/api/:action",
  method: "POST",
};
