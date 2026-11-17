import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Account e salvataggi nel cloud di Water Polo Manager (separati dagli account di Manhunt).
// Layout dello store "pallanuoto":
//   u/{sha256(email)}              -> account (password con PBKDF2-SHA256 e sale)
//   s/{sha256(token)}              -> sessione
//   m/{sha256(email)}/{careerId}   -> metadati della carriera (JSON)
//   c/{sha256(email)}/{careerId}   -> mondo di gioco compresso con gzip (binario)
// Nessuna email viene inviata. L'account e tutte le carriere si eliminano in qualsiasi momento.

const store = () => getStore({ name: "pallanuoto", consistency: "strong" });

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

type User = { email: string; salt: string; hash: string; createdAt: number; fails?: number; lockedUntil?: number };
type Session = { userKey: string; userId: string; createdAt: number };
export type CloudMeta = {
  id: string;
  name: string;
  clubName: string;
  division: string;
  season: number;
  day: number;
  difficulty: string;
  crest: unknown;
  createdAt: number;
  updatedAt: number;
  size: number;
};

const SESSION_TTL_MS = 90 * 24 * 3600 * 1000;
const LOCK_AFTER_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const PBKDF2_ITERATIONS = 210_000;
const MAX_CAREERS = 10;
const MAX_BYTES = 4 * 1024 * 1024; // un mondo compresso pesa circa 1 MB
const ID_RE = /^[A-Za-z0-9_-]{6,60}$/;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));
const sha256 = async (v: string) => toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))));
const newToken = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(new Uint8Array(bits));
}

const sameString = (a: string, b: string) => {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
};

const cleanEmail = (v: unknown) => {
  const email = String(v ?? "").trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "email_invalid");
  return email;
};

const text = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

async function sessionOf(req: Request, now: number) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token.length < 20) throw new HttpError(401, "login_again");
  const s = store();
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
  return { user, userKey: session.userKey, userId: session.userId, sessionKey };
}

async function checkPassword(key: string, user: User | null, password: string, now: number) {
  const s = store();
  if (!user) {
    await hashPassword(password, new Uint8Array(16)); // stesso tempo di risposta anche se l'email non esiste
    throw new HttpError(401, "login_failed");
  }
  if (user.lockedUntil && user.lockedUntil > now) throw new HttpError(429, "locked", { minutes: Math.ceil((user.lockedUntil - now) / 60000) });
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
}

async function listMetas(userId: string): Promise<CloudMeta[]> {
  const s = store();
  const { blobs } = await s.list({ prefix: `m/${userId}/` });
  const metas = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }) as Promise<CloudMeta | null>));
  return metas.filter((m): m is CloudMeta => !!m).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function openSession(userKey: string, userId: string, now: number) {
  const token = newToken();
  await store().setJSON(`s/${await sha256(token)}`, { userKey, userId, createdAt: now } satisfies Session);
  return token;
}

async function handle(action: string, req: Request, now: number): Promise<Response> {
  const s = store();
  const url = new URL(req.url);

  if (action === "register" || action === "login") {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = cleanEmail(body.email);
    const password = String(body.password ?? "");
    const userId = await sha256(email);
    const userKey = `u/${userId}`;
    if (action === "register") {
      if (password.length < 8) throw new HttpError(400, "password_short");
      if (password.length > 200) throw new HttpError(400, "password_long");
      if (body.consent !== true) throw new HttpError(400, "consent_required");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const user: User = { email, salt: toHex(salt), hash: await hashPassword(password, salt), createdAt: now };
      const { modified } = await s.setJSON(userKey, user, { onlyIfNew: true });
      if (!modified) throw new HttpError(409, "email_taken");
      return json({ token: await openSession(userKey, userId, now), email });
    }
    const user = (await s.get(userKey, { type: "json" })) as User | null;
    await checkPassword(userKey, user, password, now);
    return json({ token: await openSession(userKey, userId, now), email });
  }

  const { user, userKey, userId, sessionKey } = await sessionOf(req, now);

  switch (action) {
    case "me":
      return json({ email: user.email });

    case "logout":
      await s.delete(sessionKey);
      return json({ ok: true });

    case "deleteAccount": {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      await checkPassword(userKey, user, String(body.password ?? ""), now);
      for (const prefix of [`m/${userId}/`, `c/${userId}/`]) {
        const { blobs } = await s.list({ prefix });
        await Promise.all(blobs.map((b) => s.delete(b.key)));
      }
      await s.delete(userKey);
      await s.delete(sessionKey);
      return json({ ok: true });
    }

    case "list":
      return json({ careers: await listMetas(userId) });

    case "put": {
      const id = url.searchParams.get("id") ?? "";
      if (!ID_RE.test(id)) throw new HttpError(400, "bad_id");
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.length) throw new HttpError(400, "empty");
      if (bytes.length > MAX_BYTES) throw new HttpError(413, "too_big");
      // I dati sono gzip: si controlla la firma, così non si salvano file qualsiasi.
      if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new HttpError(400, "not_gzip");
      let raw: Record<string, unknown> = {};
      try {
        raw = JSON.parse(decodeURIComponent(req.headers.get("x-wpm-meta") ?? "{}"));
      } catch {
        throw new HttpError(400, "bad_meta");
      }
      const existing = (await s.get(`m/${userId}/${id}`, { type: "json" })) as CloudMeta | null;
      const updatedAt = num(raw.updatedAt) || now;
      // Il dispositivo deve partire dall'ultima versione del cloud che conosce (x-wpm-base):
      // se nel frattempo un altro dispositivo ha salvato, non si sovrascrive senza conferma.
      if (existing && req.headers.get("x-wpm-force") !== "1" && num(req.headers.get("x-wpm-base")) !== existing.updatedAt) {
        throw new HttpError(409, "cloud_newer", { updatedAt: existing.updatedAt });
      }
      if (!existing && (await listMetas(userId)).length >= MAX_CAREERS) throw new HttpError(409, "too_many", { max: MAX_CAREERS });
      const meta: CloudMeta = {
        id,
        name: text(raw.name, 60),
        clubName: text(raw.clubName, 60),
        division: text(raw.division, 10),
        season: num(raw.season),
        day: num(raw.day),
        difficulty: text(raw.difficulty, 20),
        crest: raw.crest && typeof raw.crest === "object" ? raw.crest : null,
        createdAt: existing?.createdAt ?? (num(raw.createdAt) || now),
        updatedAt,
        size: bytes.length,
      };
      await s.set(`c/${userId}/${id}`, bytes as unknown as ArrayBuffer);
      await s.setJSON(`m/${userId}/${id}`, meta);
      return json({ meta });
    }

    case "get": {
      const id = url.searchParams.get("id") ?? "";
      if (!ID_RE.test(id)) throw new HttpError(400, "bad_id");
      const data = await s.get(`c/${userId}/${id}`, { type: "arrayBuffer" });
      const meta = (await s.get(`m/${userId}/${id}`, { type: "json" })) as CloudMeta | null;
      if (!data || !meta) throw new HttpError(404, "not_found");
      return new Response(data, {
        headers: { "content-type": "application/octet-stream", "cache-control": "no-store", "x-wpm-meta": encodeURIComponent(JSON.stringify(meta)) },
      });
    }

    case "remove": {
      const id = url.searchParams.get("id") ?? "";
      if (!ID_RE.test(id)) throw new HttpError(400, "bad_id");
      await s.delete(`c/${userId}/${id}`);
      await s.delete(`m/${userId}/${id}`);
      return json({ ok: true });
    }
  }
  throw new HttpError(404, "unknown_action");
}

export default async (req: Request) => {
  const action = new URL(req.url).pathname.split("/").pop() ?? "";
  try {
    return await handle(action, req, Date.now());
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code, params: err.params }, err.status);
    console.error(err);
    return json({ error: "server_error" }, 500);
  }
};

export const config: Config = {
  path: "/api/pallanuoto/:action",
  method: "POST",
};
