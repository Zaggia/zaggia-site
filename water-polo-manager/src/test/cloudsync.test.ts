import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerMeta } from '../engine/types';

// Server finto con lo stesso controllo del vero: il caricamento deve partire dall'ultima versione che il dispositivo conosce (x-wpm-base).
const server = { updatedAt: 0, uploads: 0 };
const synced = new Map<string, number>();
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

vi.mock('../cloud/cloud', async () => {
  const actual = await vi.importActual<typeof import('../cloud/cloud')>('../cloud/cloud');
  return {
    ...actual,
    loadAccount: () => null,
    storeAccount: () => {},
    syncedAt: (id: string) => synced.get(id) ?? 0,
    setSyncedAt: (id: string, at: number | null) => { if (at == null) synced.delete(id); else synced.set(id, at); },
    listCloud: async () => [],
    checkSession: async () => true,
    uploadCareer: async (_a: unknown, _w: unknown, meta: CareerMeta, force = false) => {
      const base = synced.get(meta.id) ?? 0;
      await delay(60); // caricamento lento
      if (!force && server.updatedAt && base !== server.updatedAt) throw new actual.CloudError('cloud_newer', 409, { updatedAt: server.updatedAt });
      server.updatedAt = meta.updatedAt;
      server.uploads++;
      synced.set(meta.id, meta.updatedAt);
      return { ...meta, size: 1 };
    },
  };
});

describe('sincronizzazione cloud', () => {
  beforeEach(() => { server.updatedAt = 0; server.uploads = 0; synced.clear(); });

  async function setup() {
    const { useGame } = await import('../store/game');
    const { createWorld } = await import('../engine/world/generate');
    const world = createWorld({
      careerName: 'T', presidentName: 'T', clubName: 'Aquatica Test', short: 'AQT', city: 'Savona',
      colors: ['#0b3d91', '#ffffff'], crest: { shape: 'scudo', pattern: 'strisce', symbol: 'palla', primary: '#0b3d91', secondary: '#ffffff', initials: 'AQT' },
      poolName: 'P', founded: 2025, fansName: 'D', objective: 'metaClassifica', difficulty: 'normale', seed: 4,
    });
    const meta: CareerMeta = { id: 'career-test-1', name: 'T', clubName: 'Aquatica Test', division: 'C', season: 2026, day: 0, difficulty: 'normale', crest: world.clubs[world.userClubId].crest, createdAt: 1, updatedAt: 1000 };
    useGame.setState({ account: { email: 'a@b.it', token: 'x'.repeat(30) }, world, meta, conflict: null, cloudPaused: false });
    return useGame;
  }

  it('due caricamenti sovrapposti (connessione lenta) non creano un falso conflitto', async () => {
    const useGame = await setup();
    const s = useGame.getState();
    const p1 = s.syncNow();
    // Mentre il primo caricamento è in corso la carriera cambia e parte il secondo (come ogni 20 secondi con un caricamento lento).
    useGame.setState({ meta: { ...useGame.getState().meta!, updatedAt: 2000 } });
    const p2 = useGame.getState().syncNow();
    await Promise.all([p1, p2]);
    await delay(2500); // il caricamento rimandato parte da solo
    expect(useGame.getState().conflict).toBeNull();
    expect(server.uploads).toBeGreaterThanOrEqual(2);
    expect(server.updatedAt).toBe(2000);
  });

  it('se la versione "più recente" l’ha caricata questo stesso dispositivo non si chiede nulla', async () => {
    const useGame = await setup();
    await useGame.getState().syncNow();
    // Il dispositivo ha perso il ricordo dell'ultima versione (per esempio un carico finito dopo l'errore di rete).
    synced.set('career-test-1', 5);
    useGame.setState({ meta: { ...useGame.getState().meta!, updatedAt: 3000 } });
    await useGame.getState().syncNow();
    // Il server ha 1000, che questo dispositivo ha caricato: si riallinea e riprova senza domande.
    expect(useGame.getState().conflict).toBeNull();
    expect(server.updatedAt).toBe(3000);
  });

  it('un altro dispositivo ha davvero salvato: il conflitto compare e "Decido dopo" lo mette in pausa senza richiederlo', async () => {
    const useGame = await setup();
    server.updatedAt = 777; // salvato dal computer
    await useGame.getState().syncNow();
    expect(useGame.getState().conflict?.cloudUpdatedAt).toBe(777);
    await useGame.getState().resolveConflict('later');
    expect(useGame.getState().conflict).toBeNull();
    expect(useGame.getState().cloudPaused).toBe(true);
    const before = server.uploads;
    for (let i = 0; i < 3; i++) await useGame.getState().syncNow();
    expect(useGame.getState().conflict).toBeNull();
    expect(server.uploads).toBe(before);
  });
});
