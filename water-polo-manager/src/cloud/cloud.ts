// Account e salvataggi nel cloud (funzione Netlify "pallanuoto"). Le carriere restano sempre salvate
// anche nel browser: il cloud è una copia che permette di continuare da un altro dispositivo.

import type { CareerMeta, World } from '../engine/types';

const API = '/api/pallanuoto/';
const ACCOUNT_KEY = 'wpm:account';
const SYNC_KEY = 'wpm:sync';

export interface CloudMeta extends CareerMeta {
  size: number;
}

export interface Account {
  email: string;
  token: string;
}

export class CloudError extends Error {
  code: string;
  status: number;
  params?: Record<string, number | string>;
  constructor(code: string, status: number, params?: Record<string, number | string>) {
    super(describeError(code, params));
    this.code = code;
    this.status = status;
    this.params = params;
  }
}

export function describeError(code: string, params?: Record<string, number | string>): string {
  switch (code) {
    case 'email_invalid': return 'Indirizzo email non valido.';
    case 'password_short': return 'La password deve avere almeno 8 caratteri.';
    case 'password_long': return 'La password è troppo lunga.';
    case 'consent_required': return 'Per creare l’account devi accettare l’informativa.';
    case 'email_taken': return 'Esiste già un account con questa email: prova ad accedere.';
    case 'login_failed': return 'Email o password non corretti.';
    case 'locked': return `Troppi tentativi: riprova tra ${params?.minutes ?? 10} minuti.`;
    case 'login_again': return 'La sessione è scaduta: accedi di nuovo.';
    case 'account_missing': return 'L’account non esiste più.';
    case 'cloud_newer': return 'Su un altro dispositivo c’è una versione più recente di questa carriera.';
    case 'too_many': return `Puoi tenere al massimo ${params?.max ?? 10} carriere nel cloud: elimina quelle che non usi.`;
    case 'too_big': return 'La carriera è troppo grande per il cloud.';
    case 'not_found': return 'Carriera non trovata nel cloud.';
    case 'offline': return 'Non riesco a raggiungere il server: controlla la connessione.';
    default: return 'Errore del server: riprova tra poco.';
  }
}

// ─── Sessione ───────────────────────────────────────────────────────────────

export function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Account;
    return a?.token && a?.email ? a : null;
  } catch {
    return null;
  }
}

export function storeAccount(a: Account | null) {
  try {
    if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch { /* ignore */ }
}

// ─── Versione sincronizzata di ogni carriera ────────────────────────────────

type SyncMap = Record<string, number>;

function syncMap(): SyncMap {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) ?? '{}') as SyncMap; } catch { return {}; }
}

/** `updatedAt` dell'ultima versione del cloud che questo dispositivo ha scaricato o caricato. */
export function syncedAt(id: string): number {
  return syncMap()[id] ?? 0;
}

export function setSyncedAt(id: string, at: number | null) {
  try {
    const m = syncMap();
    if (at == null) delete m[id]; else m[id] = at;
    localStorage.setItem(SYNC_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}

// ─── Rete ───────────────────────────────────────────────────────────────────

async function call(action: string, init: { token?: string; body?: unknown; raw?: Uint8Array; query?: string; headers?: Record<string, string> } = {}): Promise<Response> {
  let res: Response;
  // Senza un limite di tempo, una risposta che non arriva bloccherebbe l'app (e l'avvio) all'infinito.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init.raw ? 90_000 : action === 'me' || action === 'list' ? 8_000 : 25_000);
  try {
    res = await fetch(`${API}${action}${init.query ?? ''}`, {
      signal: ctl.signal,
      method: 'POST',
      headers: {
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(init.raw ? { 'content-type': 'application/octet-stream' } : {}),
        ...init.headers,
      },
      body: init.raw ? (init.raw as unknown as BodyInit) : init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    clearTimeout(timer);
    throw new CloudError('offline', 0);
  }
  clearTimeout(timer);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; params?: Record<string, number | string> };
    throw new CloudError(data.error ?? 'server_error', res.status, data.params);
  }
  return res;
}

async function jsonCall<T>(action: string, init?: Parameters<typeof call>[1]): Promise<T> {
  return (await call(action, init)).json() as Promise<T>;
}

export async function register(email: string, password: string, consent: boolean): Promise<Account> {
  const r = await jsonCall<{ token: string; email: string }>('register', { body: { email, password, consent } });
  return { token: r.token, email: r.email };
}

export async function login(email: string, password: string): Promise<Account> {
  const r = await jsonCall<{ token: string; email: string }>('login', { body: { email, password } });
  return { token: r.token, email: r.email };
}

export async function checkSession(a: Account): Promise<boolean> {
  try {
    await call('me', { token: a.token });
    return true;
  } catch (e) {
    if (e instanceof CloudError && e.status === 401) return false;
    return true; // offline: si tiene la sessione, la verifica avviene alla prossima richiesta
  }
}

export async function logout(a: Account): Promise<void> {
  try { await call('logout', { token: a.token }); } catch { /* la sessione scade da sola */ }
}

export async function deleteAccount(a: Account, password: string): Promise<void> {
  await call('deleteAccount', { token: a.token, body: { password } });
}

export async function listCloud(a: Account): Promise<CloudMeta[]> {
  const r = await jsonCall<{ careers: CloudMeta[] }>('list', { token: a.token });
  return r.careers;
}

export async function removeCloud(a: Account, id: string): Promise<void> {
  await call('remove', { token: a.token, query: `?id=${encodeURIComponent(id)}` });
  setSyncedAt(id, null);
}

// ─── Compressione ───────────────────────────────────────────────────────────

async function pipe(data: BufferSource | string, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([data]);
  const out = await new Response(blob.stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)).arrayBuffer();
  return new Uint8Array(out);
}

export const gzip = (json: string) => pipe(json, new CompressionStream('gzip'));
export async function gunzipText(bytes: Uint8Array): Promise<string> {
  return new TextDecoder().decode(await pipe(bytes as unknown as BufferSource, new DecompressionStream('gzip')));
}

// ─── Carriere ───────────────────────────────────────────────────────────────

/** Carica la carriera nel cloud. Con `force` sovrascrive anche se un altro dispositivo ha salvato nel frattempo. */
export async function uploadCareer(a: Account, world: World, meta: CareerMeta, force = false): Promise<CloudMeta> {
  const bytes = await gzip(JSON.stringify(world));
  const r = await jsonCall<{ meta: CloudMeta }>('put', {
    token: a.token,
    raw: bytes,
    query: `?id=${encodeURIComponent(meta.id)}`,
    headers: {
      'x-wpm-meta': encodeURIComponent(JSON.stringify(meta)),
      'x-wpm-base': String(syncedAt(meta.id)),
      ...(force ? { 'x-wpm-force': '1' } : {}),
    },
  });
  setSyncedAt(meta.id, r.meta.updatedAt);
  return r.meta;
}

export async function downloadCareer(a: Account, id: string): Promise<{ world: World; meta: CloudMeta }> {
  const res = await call('get', { token: a.token, query: `?id=${encodeURIComponent(id)}` });
  const meta = JSON.parse(decodeURIComponent(res.headers.get('x-wpm-meta') ?? '{}')) as CloudMeta;
  const world = JSON.parse(await gunzipText(new Uint8Array(await res.arrayBuffer()))) as World;
  setSyncedAt(id, meta.updatedAt);
  return { world, meta };
}
