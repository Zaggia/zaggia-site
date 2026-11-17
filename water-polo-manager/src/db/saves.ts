// Persistenza delle carriere in IndexedDB: metadati separati dal mondo (più leggeri da elencare).

import type { CareerMeta, World } from '../engine/types';

const DB_NAME = 'water-polo-manager';
const DB_VERSION = 1;
const META = 'careers';
const WORLDS = 'worlds';
const LAST_KEY = 'wpm:last-career';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(WORLDS)) db.createObjectStore(WORLDS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        let result: T | undefined;
        const req = fn(t);
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => {
          db.close();
          resolve(result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
        t.onabort = () => {
          db.close();
          reject(t.error ?? new Error('Salvataggio annullato'));
        };
      }),
  );
}

export async function listCareers(): Promise<CareerMeta[]> {
  const list = (await tx<CareerMeta[]>([META], 'readonly', (t) => t.objectStore(META).getAll())) ?? [];
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCareer(world: World, meta: CareerMeta): Promise<void> {
  await tx([META, WORLDS], 'readwrite', (t) => {
    t.objectStore(META).put(meta);
    t.objectStore(WORLDS).put(world, meta.id);
  });
  setLastCareer(meta.id);
}

export async function loadCareer(id: string): Promise<{ world: World; meta: CareerMeta } | null> {
  const meta = await tx<CareerMeta>([META], 'readonly', (t) => t.objectStore(META).get(id));
  const world = await tx<World>([WORLDS], 'readonly', (t) => t.objectStore(WORLDS).get(id));
  if (!meta || !world) return null;
  return { world, meta };
}

export async function renameCareer(id: string, name: string): Promise<void> {
  const meta = await tx<CareerMeta>([META], 'readonly', (t) => t.objectStore(META).get(id));
  if (!meta) return;
  meta.name = name;
  await tx([META], 'readwrite', (t) => t.objectStore(META).put(meta));
}

export async function deleteCareer(id: string): Promise<void> {
  await tx([META, WORLDS], 'readwrite', (t) => {
    t.objectStore(META).delete(id);
    t.objectStore(WORLDS).delete(id);
  });
  if (getLastCareer() === id) {
    try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ }
  }
}

export function getLastCareer(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

export function setLastCareer(id: string) {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ }
}
