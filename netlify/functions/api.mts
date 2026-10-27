import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { centroid, currentZone, distanceM, insideZone, offsetM, timeline } from "../../public/geo.js";

// Layout dello store (ogni chiave ha un solo scrittore, niente read-modify-write condiviso):
//   g/{code}/game     -> configurazione partita, la scrive solo l'host
//   g/{code}/p/{id}   -> giocatore e posizione, la scrive solo quel giocatore (o l'host per kick)
//   g/{code}/c/{id}   -> cattura del giocatore {id}, creata una sola volta
//   g/{code}/c/x-{id} -> eliminazione del cacciatore {id} da parte del kamikaze
//   g/{code}/n/{id}   -> preda {id} con un cacciatore vicino (cattura automatica)
//   g/{code}/z/{k}    -> k-esima zona di interesse, creata una sola volta da chi fa sync per primo
//   u/{sha256(email)} -> account (password con PBKDF2), s/{sha256(token)} -> sessione dell'account

type LatLng = { lat: number; lng: number };
type Zone = { type: "circle"; center: LatLng; radius: number } | { type: "polygon"; points: LatLng[] };
type Role = "hunter" | "runner" | "referee";

type Settings = {
  durationMin: number;
  headStartMin: number;
  revealEveryMin: number;
  runnersSeeHunters: boolean;
  hunterRevealEveryMin: number;
  kamikaze: boolean;
  poiEveryMin: number;
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
  kamikazeId?: string;
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
  // Zone di interesse e bonus della partita in corso (validi solo se bonusRound === game.startedAt).
  bonusRound?: number;
  poi?: { index: number; since: number | null; done: boolean };
  bonuses?: { index: number; type: BonusType; at: number }[];
  stealthUntil?: number;
  seeHuntersUntil?: number;
  radarUntil?: number;
  quickIndex?: number;
};

type Catch = { target: string; by: string; at: number; self?: boolean; auto?: boolean; eliminated?: boolean };
type Near = { since: number };
type BonusType = "stealth" | "seeHunters" | "radar" | "quick";
type Poi = { index: number; center: LatLng; radius: number; openedAt: number; arriveBy: number; endsAt: number };

const GAME_TTL_MS = 24 * 3600 * 1000;
const ONLINE_MS = 45 * 1000;
// Cattura automatica (sempre attiva): il cacciatore deve restare entro la distanza per questo tempo,
// e le posizioni devono essere recenti (il GPS fermo non basta a prendere qualcuno).
const AUTO_HOLD_MS = 3 * 1000;
const AUTO_FRESH_MS = 25 * 1000;
// Kamikaze: serve più di 10 giocatori (arbitri esclusi).
const KAMIKAZE_MIN_PLAYERS = 11;
// Zone di interesse: compaiono vicino a una preda; 40 s per entrare, 30 s dentro per il bonus.
const POI_ARRIVE_MS = 40 * 1000;
const POI_HOLD_MS = 30 * 1000;
const POI_QUICK_MS = 4 * 1000; // bonus "4 secondi in meno" nella zona successiva
const POI_GRACE_MS = 15 * 1000; // margine per chi completa tra un sync e l'altro
const POI_RADIUS_M = 40;
const POI_NEAR_MIN_M = 60;
const POI_NEAR_MAX_M = 200;
const BONUS_STEALTH_TURNS = 3;
const BONUS_STEALTH_LIVE_MS = 3 * 60 * 1000; // se le prede sono in diretta non ci sono "turni": 3 minuti
const BONUS_SEE_HUNTERS_MS = 60 * 1000;
const BONUS_RADAR_MS = 5 * 60 * 1000;
const BONUS_RADAR_M = 300;

const DEFAULT_SETTINGS: Settings = {
  durationMin: 60,
  headStartMin: 5,
  revealEveryMin: 5,
  runnersSeeHunters: false,
  hunterRevealEveryMin: 0,
  kamikaze: false,
  poiEveryMin: 5,
  catchRadiusM: 30,
  dangerRadiusM: 200,
  infection: false,
  shrinkTo: 100,
  outsideReveal: true,
};

const store = () => getStore({ name: "manhunt", consistency: "strong" });

// Gli errori viaggiano come codici (es. "need_zone"): il testo lo sceglie l'app nella lingua di chi gioca.
class HttpError extends Error {
  status: number;
  code: string;
  params?: Record<string, string | number>;
  constructor(status: number, code: string, params?: Record<string, string | number>) {
    super(code);
    this.status = status;
    this.code = code;
    this.params = params;
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
  if (!name) throw new HttpError(400, "name_required");
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
    if (!center) throw new HttpError(400, "zone_center_invalid");
    return { type: "circle", center, radius: clamp(v.radius, 50, 20000, 1000) };
  }
  if (v.type === "polygon" && Array.isArray(v.points)) {
    const points = v.points.map(cleanLatLng).filter(Boolean).slice(0, 200) as LatLng[];
    if (points.length < 3) throw new HttpError(400, "polygon_min");
    return { type: "polygon", points };
  }
  throw new HttpError(400, "zone_invalid");
};

const cleanSettings = (v: any, prev: Settings): Settings => ({
  durationMin: clamp(v?.durationMin, 5, 600, prev.durationMin),
  headStartMin: clamp(v?.headStartMin, 0, 60, prev.headStartMin),
  revealEveryMin: clamp(v?.revealEveryMin, 0, 60, prev.revealEveryMin),
  runnersSeeHunters: typeof v?.runnersSeeHunters === "boolean" ? v.runnersSeeHunters : prev.runnersSeeHunters,
  hunterRevealEveryMin: clamp(v?.hunterRevealEveryMin, 0, 60, prev.hunterRevealEveryMin),
  kamikaze: typeof v?.kamikaze === "boolean" ? v.kamikaze : prev.kamikaze,
  poiEveryMin: clamp(v?.poiEveryMin, 0, 30, prev.poiEveryMin ?? DEFAULT_SETTINGS.poiEveryMin),
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
  if (!blobs.some((b) => b.key === gameKey)) throw new HttpError(404, "game_not_found");

  const entries = await Promise.all(
    blobs.map(async (b) => [b.key, await s.get(b.key, { type: "json" })] as const),
  );
  let game: Game | null = null;
  const players: Record<string, Player> = {};
  const catches: Record<string, Catch> = {};
  const nears: Record<string, Near> = {};
  const pois: Record<number, Poi> = {};
  for (const [key, value] of entries) {
    if (!value) continue;
    const rest = key.slice(prefix.length);
    if (rest === "game") game = value as Game;
    else if (rest.startsWith("p/")) players[rest.slice(2)] = value as Player;
    else if (rest.startsWith("c/")) catches[rest.slice(2)] = value as Catch;
    else if (rest.startsWith("n/")) nears[rest.slice(2)] = value as Near;
    else if (rest.startsWith("z/")) pois[Number(rest.slice(2))] = value as Poi;
  }
  if (!game) throw new HttpError(404, "game_not_found");

  if (Date.now() - game.createdAt > GAME_TTL_MS) {
    await Promise.all(blobs.map((b) => s.delete(b.key)));
    throw new HttpError(404, "game_expired");
  }
  return { game, players, catches, nears, pois, keys: blobs.map((b) => b.key) };
}

function auth(players: Record<string, Player>, id: unknown, token: unknown) {
  const me = players[String(id)];
  if (!me || me.token !== token) throw new HttpError(403, "not_member");
  return me;
}

function requireHost(game: Game, me: Player) {
  if (game.hostId !== me.id) throw new HttpError(403, "host_only");
}

const baseRole = (game: Game, id: string): Role => game.roles[id] ?? "runner";

// L'opzione kamikaze esiste solo con più di 10 giocatori (arbitri esclusi).
const kamikazeAvailable = (game: Game, players: Record<string, Player>) =>
  Object.keys(players).filter((id) => baseRole(game, id) !== "referee").length >= KAMIKAZE_MIN_PLAYERS;

const elimKey = (id: string) => `x-${id}`;

// Ruolo in gioco: una preda catturata diventa cacciatore (modalità infezione) o resta fuori;
// un cacciatore eliminato dal kamikaze è fuori per sempre. Il kamikaze preso non viene mai infettato.
function effectiveRole(game: Game, catches: Record<string, Catch>, id: string) {
  if (catches[elimKey(id)]) return "eliminated";
  const base = baseRole(game, id);
  if (base === "runner" && catches[id]) return game.settings.infection && id !== game.kamikazeId ? "hunter" : "caught";
  return base;
}

function phaseOf(game: Game, players: Record<string, Player>, catches: Record<string, Catch>, now: number) {
  if (game.status === "lobby") return { phase: "lobby" as const };
  if (game.status === "ended") return { phase: "ended" as const, winner: null, endedAt: game.endedAt ?? now };
  const t = timeline(game);
  const ids = Object.keys(players);
  const runners = ids.filter((id) => baseRole(game, id) === "runner");
  const caught = runners.filter((id) => catches[id]);
  const allCaught = runners.length > 0 && caught.length === runners.length;
  const eliminated = ids.filter((id) => catches[elimKey(id)]);
  const noHunterLeft = eliminated.length > 0 && !ids.some((id) => effectiveRole(game, catches, id) === "hunter");
  const lastAt = (list: string[], key: (id: string) => string) => Math.max(...list.map((id) => catches[key(id)].at));
  if (allCaught && noHunterLeft) {
    const endedAt = Math.max(lastAt(caught, (id) => id), lastAt(eliminated, elimKey));
    return { phase: "ended" as const, winner: "draw", endedAt };
  }
  if (allCaught) return { phase: "ended" as const, winner: "hunters", endedAt: lastAt(caught, (id) => id) };
  if (noHunterLeft) return { phase: "ended" as const, winner: "runners", reason: "eliminated", endedAt: lastAt(eliminated, elimKey) };
  if (now >= t.endsAt) return { phase: "ended" as const, winner: "runners", reason: "time", endedAt: t.endsAt };
  if (now < t.huntStart) return { phase: "headstart" as const };
  return { phase: "hunt" as const };
}

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

// I bonus valgono solo per la partita in corso: dopo "Nuova partita" i vecchi campi vengono ignorati.
const hasBonus = (game: Game, p: Player, field: "stealthUntil" | "seeHuntersUntil" | "radarUntil", now: number) =>
  p.bonusRound === game.startedAt && (p[field] ?? 0) > now;

function poiIndexAt(game: Game, now: number) {
  const every = (game.settings.poiEveryMin ?? 0) * 60000;
  return every ? Math.floor((now - timeline(game).huntStart) / every) : 0;
}

// La zona di interesse attiva adesso, se è già stata creata.
function activePoi(game: Game, pois: Record<number, Poi>, now: number) {
  const poi = pois[poiIndexAt(game, now)];
  return poi && now >= poi.openedAt && now <= poi.endsAt + POI_GRACE_MS ? poi : null;
}

const poiHoldMs = (game: Game, me: Player, poi: Poi) =>
  POI_HOLD_MS - (me.bonusRound === game.startedAt && me.quickIndex === poi.index ? POI_QUICK_MS : 0);

const isFresh = (p: Player, now: number) => !!p.pos && now - p.pos.at < 2 * ONLINE_MS;

function buildState(
  game: Game,
  players: Record<string, Player>,
  catches: Record<string, Catch>,
  me: Player,
  now: number,
  nears: Record<string, Near> = {},
  pois: Record<number, Poi> = {},
) {
  const { phase, ...end } = phaseOf(game, players, catches, now) as any;
  const t = game.status === "lobby" ? null : timeline(game);
  const myRole = effectiveRole(game, catches, me.id);
  const playing = phase === "headstart" || phase === "hunt";
  const seesAll = !playing || myRole === "referee" || myRole === "caught" || myRole === "eliminated";
  const poi = phase === "hunt" ? activePoi(game, pois, now) : null;
  // Dentro la zona di interesse si è sempre visibili, prede e cacciatori.
  const inPoi = (p: Player) => !!poi && !!p.pos && now - p.pos.at < AUTO_FRESH_MS && distanceM(p.pos, poi.center) <= poi.radius;

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
      inPoi: inPoi(p),
      visibility: "hidden",
    };
    let pos: any = null;
    if (p.id === me.id || seesAll || role === "caught" || role === "eliminated" || role === "referee") {
      pos = p.pos ?? null;
      out.visibility = "live";
    } else if (myRole === "hunter" && role === "runner") {
      if (phase === "headstart") {
        // Vantaggio iniziale: i cacciatori non vedono nulla.
      } else if (inPoi(p) || (game.settings.outsideReveal && p.outsideSince)) {
        pos = p.pos ?? null;
        out.visibility = "live";
      } else if (hasBonus(game, p, "stealthUntil", now)) {
        // Bonus: non viene rilevata per qualche turno.
      } else if (game.settings.revealEveryMin === 0) {
        pos = p.pos ?? null;
        out.visibility = "live";
      } else if (p.ping && p.pingKey === `${game.startedAt}:runner`) {
        pos = p.ping;
        out.visibility = "ping";
      }
    } else if (myRole === "runner" && role === "hunter") {
      if (game.settings.runnersSeeHunters || inPoi(p) || hasBonus(game, me, "seeHuntersUntil", now)) {
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
    // Bonus radar: allarme a 300 m (o più, se la regola della partita è già più larga).
    const dangerRadius = hasBonus(game, me, "radarUntil", now)
      ? Math.max(BONUS_RADAR_M, game.settings.dangerRadiusM)
      : game.settings.dangerRadiusM;
    if (myRole === "runner" && dangerRadius > 0) {
      const d = others
        .filter((p) => effectiveRole(game, catches, p.id) === "hunter")
        .map((p) => distanceM(me.pos!, p.pos!));
      const min = d.length ? Math.min(...d) : Infinity;
      if (min <= dangerRadius) danger = Math.ceil(min / 25) * 25;
    }
    if (myRole === "runner" && nears[me.id]) {
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

  const name = (id: string) => players[id]?.name ?? "";
  // Gli eventi portano un codice e i nomi: la frase la compone l'app nella lingua di chi legge.
  const events: { at: number; kind: string; code: string; a?: string; b?: string }[] = [];
  if (t) {
    events.push({ at: t.startedAt, kind: "start", code: "start" });
    if (now >= t.huntStart) events.push({ at: t.huntStart, kind: "hunt", code: "hunt" });
    for (const c of Object.values(catches)) {
      if (c.eliminated) {
        events.push({ at: c.at, kind: "boom", code: "boom", a: name(c.by), b: name(c.target) });
        continue;
      }
      events.push(
        c.self
          ? { at: c.at, kind: "catch", code: "surrender", a: name(c.target) }
          : { at: c.at, kind: "catch", code: "catch", a: name(c.by), b: name(c.target) },
      );
    }
    for (const z of Object.values(pois)) if (z.openedAt <= now) events.push({ at: z.openedAt, kind: "poi", code: "poi" });
    for (const p of Object.values(players)) {
      if (p.bonusRound !== game.startedAt) continue;
      for (const b of p.bonuses ?? []) events.push({ at: b.at, kind: "bonus", code: "bonus", a: p.name });
    }
    if (playing) {
      for (const p of Object.values(players)) {
        if (p.outsideSince) events.push({ at: p.outsideSince, kind: "outside", code: "outside", a: p.name });
      }
    }
    if (phase === "ended") {
      const code =
        end.winner === "hunters"
          ? "end_hunters"
          : end.winner === "draw"
            ? "end_draw"
            : end.winner === "runners"
              ? end.reason === "eliminated"
                ? "end_runners_elim"
                : "end_runners_time"
              : "end_stopped";
      events.push({ at: end.endedAt, kind: "end", code });
    }
  }
  const rank: Record<string, number> = { start: 0, hunt: 1, poi: 2, outside: 3, bonus: 4, catch: 5, boom: 6, end: 7 };
  events.sort((a, b) => b.at - a.at || rank[b.kind] - rank[a.kind]);

  return {
    now,
    code: game.code,
    phase,
    winner: end.winner ?? null,
    endedAt: end.endedAt ?? null,
    hostId: game.hostId,
    isHost: me.id === game.hostId,
    me: {
      id: me.id,
      name: me.name,
      role: myRole,
      baseRole: baseRole(game, me.id),
      kamikaze: game.status !== "lobby" && game.kamikazeId === me.id,
      poi: poi ? myPoiProgress(game, me, poi) : null,
      bonus: me.bonusRound === game.startedAt
        ? {
            stealthUntil: me.stealthUntil ?? null,
            seeHuntersUntil: me.seeHuntersUntil ?? null,
            radarUntil: me.radarUntil ?? null,
            quickNext: me.quickIndex != null && me.quickIndex >= poiIndexAt(game, now),
            list: me.bonuses ?? [],
          }
        : { stealthUntil: null, seeHuntersUntil: null, radarUntil: null, quickNext: false, list: [] },
    },
    poi: poi ? { index: poi.index, center: poi.center, radius: poi.radius, openedAt: poi.openedAt, arriveBy: poi.arriveBy, endsAt: poi.endsAt } : null,
    kamikazeActive: game.status !== "lobby" && !!game.kamikazeId,
    kamikazeName: phase === "ended" && game.kamikazeId ? (players[game.kamikazeId]?.name ?? null) : null,
    settings: { ...game.settings, kamikaze: game.settings.kamikaze && kamikazeAvailable(game, players) },
    kamikazeAvailable: kamikazeAvailable(game, players),
    zone: game.zone,
    currentZone: playing ? currentZone(game, now) : game.zone,
    timeline: t,
    players: list,
    catches: Object.values(catches).map((c) => ({ target: c.target, by: c.by, at: c.at, self: !!c.self, eliminated: !!c.eliminated })),
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

// Crea la zona di interesse del turno, se non c'è ancora: vicino a una preda scelta a caso, dentro la zona di gioco.
// La crea chi fa sync per primo; onlyIfNew garantisce che ne esista una sola.
async function ensurePoi(code: string, game: Game, players: Record<string, Player>, catches: Record<string, Catch>, pois: Record<number, Poi>, now: number) {
  const every = (game.settings.poiEveryMin ?? 0) * 60000;
  if (!every) return;
  const tl = timeline(game);
  const k = Math.floor((now - tl.huntStart) / every);
  if (k < 1 || pois[k]) return;
  const openedAt = tl.huntStart + k * every;
  const endsAt = openedAt + POI_ARRIVE_MS + POI_HOLD_MS;
  if (now > endsAt || endsAt > tl.endsAt) return;

  const zone = currentZone(game, now) as Zone | null;
  const runners = Object.values(players).filter(
    (p) => effectiveRole(game, catches, p.id) === "runner" && p.pos && now - p.pos.at < 60000,
  );
  let center: LatLng | null = null;
  if (runners.length) {
    const r = runners[Math.floor(rand() * runners.length)];
    for (let i = 0; i < 12 && !center; i++) {
      const p = offsetM(r.pos!, POI_NEAR_MIN_M + rand() * (POI_NEAR_MAX_M - POI_NEAR_MIN_M), rand() * 2 * Math.PI);
      if (insideZone(zone, p)) center = p;
    }
    if (!center && insideZone(zone, r.pos!)) center = { lat: r.pos!.lat, lng: r.pos!.lng };
  }
  if (!center && zone) center = zone.type === "circle" ? zone.center : centroid(zone.points);
  if (!center) return;

  const poi: Poi = {
    index: k,
    center: { lat: +center.lat.toFixed(6), lng: +center.lng.toFixed(6) },
    radius: POI_RADIUS_M,
    openedAt,
    arriveBy: openedAt + POI_ARRIVE_MS,
    endsAt,
  };
  const s = store();
  const key = `g/${code}/z/${k}`;
  const { modified } = await s.setJSON(key, poi, { onlyIfNew: true });
  pois[k] = modified ? poi : (((await s.get(key, { type: "json" })) as Poi | null) ?? poi);
}

// Una preda deve entrare entro 40 s e restare dentro 30 s di fila; se esce, il conto riparte (solo entro i 40 s).
function trackPoi(game: Game, me: Player, poi: Poi, now: number) {
  const track = me.poi?.index === poi.index ? me.poi : { index: poi.index, since: null, done: false };
  if (!track.done && me.pos) {
    const inside = distanceM(me.pos, poi.center) <= poi.radius;
    if (!inside) track.since = null;
    else if (track.since == null) {
      if (now <= poi.arriveBy) track.since = now;
    } else if (now - track.since >= poiHoldMs(game, me, poi)) {
      track.done = true;
      awardBonus(game, me, poi, now);
    }
  }
  me.poi = track;
}

// Bonus estratto a caso; "4 secondi in meno" non può uscire due volte di fila.
function awardBonus(game: Game, me: Player, poi: Poi, now: number) {
  const last = me.bonuses?.[me.bonuses.length - 1]?.type;
  const options = (["stealth", "seeHunters", "radar", "quick"] as BonusType[]).filter((b) => b !== "quick" || last !== "quick");
  const type = options[Math.floor(rand() * options.length)];
  if (type === "stealth") {
    // Salta i prossimi 3 segnali: invisibile fino all'inizio del quarto turno.
    const every = game.settings.revealEveryMin * 60000;
    const huntStart = timeline(game).huntStart;
    me.stealthUntil = every
      ? huntStart + (Math.floor((now - huntStart) / every) + BONUS_STEALTH_TURNS + 1) * every
      : now + BONUS_STEALTH_LIVE_MS;
  } else if (type === "seeHunters") me.seeHuntersUntil = now + BONUS_SEE_HUNTERS_MS;
  else if (type === "radar") me.radarUntil = now + BONUS_RADAR_MS;
  else me.quickIndex = poi.index + 1;
  me.bonuses = [...(me.bonuses ?? []), { index: poi.index, type, at: now }];
}

function myPoiProgress(game: Game, me: Player, poi: Poi) {
  const track = me.bonusRound === game.startedAt && me.poi?.index === poi.index ? me.poi : null;
  return {
    since: track?.since ?? null,
    done: !!track?.done,
    holdMs: poiHoldMs(game, me, poi),
    inside: !!me.pos && distanceM(me.pos, poi.center) <= poi.radius,
  };
}

// Kamikaze: se la preda segreta viene presa da un cacciatore, il cacciatore viene eliminato.
async function maybeBoom(code: string, game: Game, catches: Record<string, Catch>, targetId: string, byId: string, now: number) {
  if (!game.kamikazeId || game.kamikazeId !== targetId || byId === targetId) return;
  if (effectiveRole(game, catches, byId) !== "hunter") return;
  const c: Catch = { target: byId, by: targetId, at: now, eliminated: true };
  await store().setJSON(`g/${code}/c/${elimKey(byId)}`, c, { onlyIfNew: true });
  catches[elimKey(byId)] = c;
}

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
      if (modified) await maybeBoom(code, game, catches, r.id, nearest.id, now);
      delete nears[r.id];
      await s.delete(`g/${code}/n/${r.id}`);
    }
  }
}

// ---------- Account ----------
// Registrazione facoltativa con email e password. La password non viene mai salvata: solo PBKDF2-SHA256 con sale.
// Nessuna email viene inviata; l'account si può eliminare in qualsiasi momento.

type User = {
  firstName: string;
  lastName: string;
  age: number;
  language: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: number;
  fails?: number;
  lockedUntil?: number;
};
type Session = { userKey: string; createdAt: number };

const LANGUAGES = ["it", "en", "es", "fr", "de"];
const SESSION_TTL_MS = 90 * 24 * 3600 * 1000;
const LOCK_AFTER_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const PBKDF2_ITERATIONS = 210_000;
const ACCOUNT_ACTIONS = new Set(["register", "login", "me", "logout", "deleteAccount", "setLanguage"]);

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));
const sha256 = async (v: string) => toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))));

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

const sameString = (a: string, b: string) => {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
};

const cleanPersonName = (v: unknown, code: string) => {
  const name = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) throw new HttpError(400, code);
  return name;
};

const cleanEmail = (v: unknown) => {
  const email = String(v ?? "").trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "email_invalid");
  return email;
};

const profileOf = (u: User) => ({ firstName: u.firstName, lastName: u.lastName, age: u.age, language: u.language, email: u.email });

async function account(action: string, body: any, now: number) {
  const s = store();
  const userKeyOf = async (email: string) => `u/${await sha256(email)}`;

  const openSession = async (userKey: string) => {
    const token = newToken();
    await s.setJSON(`s/${await sha256(token)}`, { userKey, createdAt: now } satisfies Session);
    return token;
  };

  const sessionUser = async () => {
    const token = body.userToken;
    if (typeof token !== "string" || token.length < 20) throw new HttpError(401, "login_again");
    const sessionKey = `s/${await sha256(token)}`;
    const session = (await s.get(sessionKey, { type: "json" })) as Session | null;
    if (!session || now - session.createdAt > SESSION_TTL_MS) {
      if (session) await s.delete(sessionKey);
      throw new HttpError(401, "login_again");
    }
    const user = (await s.get(session.userKey, { type: "json" })) as User | null;
    if (!user) {
      await s.delete(sessionKey);
      throw new HttpError(401, "account_missing");
    }
    return { user, userKey: session.userKey, sessionKey };
  };

  const checkPassword = async (key: string, user: User | null, password: string) => {
    if (!user) {
      await hashPassword(password, new Uint8Array(16)); // stesso tempo di risposta anche se l'email non esiste
      throw new HttpError(401, "login_failed");
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new HttpError(429, "locked", { minutes: Math.ceil((user.lockedUntil - now) / 60000) });
    }
    if (!sameString(await hashPassword(password, fromHex(user.salt)), user.hash)) {
      user.fails = (user.fails ?? 0) + 1;
      if (user.fails >= LOCK_AFTER_FAILS) {
        user.lockedUntil = now + LOCK_MS;
        user.fails = 0;
      }
      await s.setJSON(key, user);
      throw new HttpError(401, "login_failed");
    }
    if (user.fails || user.lockedUntil) {
      user.fails = 0;
      user.lockedUntil = undefined;
      await s.setJSON(key, user);
    }
  };

  switch (action) {
    case "register": {
      const firstName = cleanPersonName(body.firstName, "first_name_required");
      const lastName = cleanPersonName(body.lastName, "last_name_required");
      const age = Math.round(Number(body.age));
      if (!Number.isFinite(age) || age < 5 || age > 120) throw new HttpError(400, "age_invalid");
      const language = LANGUAGES.includes(body.language) ? body.language : "it";
      const email = cleanEmail(body.email);
      const password = String(body.password ?? "");
      if (password.length < 8) throw new HttpError(400, "password_short");
      if (password.length > 200) throw new HttpError(400, "password_long");
      if (body.consent !== true) throw new HttpError(400, "consent_required");

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const user: User = {
        firstName,
        lastName,
        age,
        language,
        email,
        salt: toHex(salt),
        hash: await hashPassword(password, salt),
        createdAt: now,
      };
      const key = await userKeyOf(email);
      const { modified } = await s.setJSON(key, user, { onlyIfNew: true });
      if (!modified) throw new HttpError(409, "email_taken");
      return { token: await openSession(key), profile: profileOf(user) };
    }

    case "login": {
      const email = cleanEmail(body.email);
      const key = await userKeyOf(email);
      const user = (await s.get(key, { type: "json" })) as User | null;
      await checkPassword(key, user, String(body.password ?? ""));
      return { token: await openSession(key), profile: profileOf(user!) };
    }

    case "me": {
      const { user } = await sessionUser();
      return { profile: profileOf(user) };
    }

    case "setLanguage": {
      const { user, userKey } = await sessionUser();
      if (LANGUAGES.includes(body.language) && user.language !== body.language) {
        user.language = body.language;
        await s.setJSON(userKey, user);
      }
      return { profile: profileOf(user) };
    }

    case "logout": {
      try {
        const { sessionKey } = await sessionUser();
        await s.delete(sessionKey);
      } catch {}
      return { ok: true };
    }

    case "deleteAccount": {
      const { user, userKey, sessionKey } = await sessionUser();
      await checkPassword(userKey, user, String(body.password ?? ""));
      await s.delete(userKey);
      await s.delete(sessionKey);
      return { ok: true };
    }
  }
  throw new HttpError(404, "unknown_action");
}

async function handle(action: string, body: any) {
  const s = store();
  const now = Date.now();

  if (ACCOUNT_ACTIONS.has(action)) return account(action, body, now);

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
    throw new HttpError(503, "create_failed");
  }

  const code = cleanCode(body.code);
  if (code.length !== 5) throw new HttpError(400, "code_length");

  if (action === "join") {
    const name = cleanName(body.name);
    const { players } = await loadGame(code);
    if (Object.keys(players).length >= 40) throw new HttpError(409, "game_full");
    const id = newId();
    const token = newToken();
    await s.setJSON(`g/${code}/p/${id}`, { id, token, name, joinedAt: now, lastSeen: now } satisfies Player);
    return { code, id, token };
  }

  const { game, players, catches, nears, pois, keys } = await loadGame(code);
  const me = auth(players, body.id, body.token);
  const saveGame = () => s.setJSON(`g/${code}/game`, game);
  const clearCatches = () =>
    Promise.all(keys.filter((k) => /^g\/[A-Z]+\/[cnz]\//.test(k)).map((k) => s.delete(k)));

  switch (action) {
    case "sync": {
      me.lastSeen = now;
      const pos = cleanLatLng(body.pos);
      if (pos) me.pos = { ...pos, acc: clamp(body.pos.acc, 0, 10000, 0), at: now };

      const { phase } = phaseOf(game, players, catches, now);
      const playing = phase === "headstart" || phase === "hunt";
      const role = effectiveRole(game, catches, me.id);
      if (game.status === "running" && me.bonusRound !== game.startedAt) {
        me.bonusRound = game.startedAt;
        me.poi = undefined;
        me.bonuses = [];
        me.stealthUntil = undefined;
        me.seeHuntersUntil = undefined;
        me.radarUntil = undefined;
        me.quickIndex = undefined;
      }
      if (playing && me.pos && role === "runner") {
        me.outsideSince = insideZone(currentZone(game, now), me.pos) ? null : (me.outsideSince ?? now);
      } else {
        me.outsideSince = null;
      }

      // Segnale periodico: la prima posizione dopo ogni scatto viene mostrata agli avversari.
      // Vale per le prede (verso i cacciatori) e, se l'host lo vuole, per i cacciatori (verso le prede).
      if (phase === "hunt" && me.pos && (role === "runner" || role === "hunter")) {
        const every = (role === "hunter" ? game.settings.hunterRevealEveryMin : game.settings.revealEveryMin) * 60000;
        // Con il bonus "invisibile" la preda non lascia segnali finché dura.
        if (every > 0 && !(role === "runner" && hasBonus(game, me, "stealthUntil", now))) {
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
      if (phase === "hunt") {
        await ensurePoi(code, game, players, catches, pois, now);
        const poi = activePoi(game, pois, now);
        if (poi && role === "runner") trackPoi(game, me, poi, now);
      }
      await s.setJSON(`g/${code}/p/${me.id}`, me);

      if (phase === "hunt") await autoCatchPass(code, game, players, catches, nears, now);
      return buildState(game, players, catches, me, now, nears, pois);
    }

    case "config": {
      requireHost(game, me);
      if (game.status !== "lobby") throw new HttpError(409, "lobby_only");
      if ("zone" in body) game.zone = cleanZone(body.zone);
      if (body.settings) game.settings = cleanSettings(body.settings, game.settings);
      if (body.roles && typeof body.roles === "object") {
        for (const [pid, role] of Object.entries(body.roles)) {
          if (players[pid] && ["hunter", "runner", "referee"].includes(role as string)) game.roles[pid] = role as Role;
        }
      }
      if (!kamikazeAvailable(game, players)) game.settings.kamikaze = false;
      await saveGame();
      break;
    }

    case "start": {
      requireHost(game, me);
      if (game.status === "running" && phaseOf(game, players, catches, now).phase !== "ended") break;
      if (!game.zone) throw new HttpError(409, "need_zone");
      const ids = Object.keys(players);
      if (!ids.some((id) => baseRole(game, id) === "hunter")) throw new HttpError(409, "need_hunter");
      if (!ids.some((id) => baseRole(game, id) === "runner")) throw new HttpError(409, "need_runner");
      await clearCatches();
      game.status = "running";
      game.startedAt = now;
      game.endedAt = undefined;
      game.kamikazeId = undefined;
      if (game.settings.kamikaze && kamikazeAvailable(game, players)) {
        const runners = ids.filter((id) => baseRole(game, id) === "runner");
        game.kamikazeId = runners[crypto.getRandomValues(new Uint32Array(1))[0] % runners.length];
      }
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
      game.kamikazeId = undefined;
      await saveGame();
      break;
    }

    case "catch": {
      const target = players[String(body.target)];
      if (!target) throw new HttpError(404, "player_not_found");
      const { phase } = phaseOf(game, players, catches, now);
      if (phase !== "hunt") throw new HttpError(409, "no_catch_now");
      if (effectiveRole(game, catches, target.id) !== "runner") throw new HttpError(409, "target_not_runner", { name: target.name });
      const myRole = effectiveRole(game, catches, me.id);
      const self = target.id === me.id;
      if (!self && myRole !== "referee") {
        if (myRole !== "hunter") throw new HttpError(403, "hunters_only");
        if (!isFresh(me, now) || !isFresh(target, now)) throw new HttpError(409, "stale_position");
        const d = distanceM(me.pos!, target.pos!);
        if (d > game.settings.catchRadiusM * 1.5) throw new HttpError(409, "too_far", { name: target.name, dist: Math.round(d) });
      }
      const c: Catch = { target: target.id, by: me.id, at: now, self };
      const { modified } = await s.setJSON(`g/${code}/c/${target.id}`, c, { onlyIfNew: true });
      if (modified && !self) await maybeBoom(code, game, catches, target.id, me.id, now);
      break;
    }

    case "uncatch": {
      requireHost(game, me);
      const target = String(body.target);
      await s.delete(body.elim ? `g/${code}/c/${elimKey(target)}` : `g/${code}/c/${target}`);
      break;
    }

    case "kick": {
      requireHost(game, me);
      const target = String(body.target);
      if (target === me.id) throw new HttpError(400, "cant_kick_self");
      await s.delete(`g/${code}/p/${target}`);
      await s.delete(`g/${code}/c/${target}`);
      await s.delete(`g/${code}/c/${elimKey(target)}`);
      await s.delete(`g/${code}/n/${target}`);
      break;
    }

    case "leave": {
      if (me.id === game.hostId) throw new HttpError(409, "host_cant_leave");
      await s.delete(`g/${code}/p/${me.id}`);
      await s.delete(`g/${code}/c/${me.id}`);
      await s.delete(`g/${code}/c/${elimKey(me.id)}`);
      await s.delete(`g/${code}/n/${me.id}`);
      return { ok: true };
    }

    case "delete": {
      requireHost(game, me);
      await Promise.all(keys.map((k) => s.delete(k)));
      return { ok: true };
    }

    default:
      throw new HttpError(404, "unknown_action");
  }

  // Dopo ogni azione l'interfaccia riceve lo stato aggiornato.
  const fresh = await loadGame(code);
  return buildState(fresh.game, fresh.players, fresh.catches, fresh.players[me.id] ?? me, Date.now(), fresh.nears, fresh.pois);
}

export default async (req: Request) => {
  const action = new URL(req.url).pathname.split("/").pop() ?? "";
  try {
    const body = await req.json().catch(() => ({}));
    return json(await handle(action, body));
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code, params: err.params }, err.status);
    console.error(err);
    return json({ error: "server_error" }, 500);
  }
};

export const config: Config = {
  path: "/api/:action",
  method: "POST",
};
