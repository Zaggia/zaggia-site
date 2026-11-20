// Generazione dell'intero ecosistema sportivo all'inizio di una carriera.

import { ITALIAN_CITIES, type City } from '../data/cities';
import { FOREIGN_CITY_SIZE, REAL_FOREIGN, REAL_LEAGUES, type RealForeignClub } from '../data/realClubs';
import { crestFor } from '../club/crest';
import { REAL_ROSTERS } from '../data/realPlayers';
import { DEFAULT_RULES, DIFFICULTIES } from '../data/config';
import { NATIONS } from '../data/names';
import { Rng } from '../rng';
import type { CrestSpec, Difficulty, ObjectiveKind, World } from '../types';
import { clamp, lerp } from '../util';
import { generateClub } from '../club/generate';
import { generateCoach, generateStaff, STAFF_ROLES } from '../staff/coach';
import { generatePlayer } from '../player/generate';
import { startSeason } from '../season/start';
import { balancePyramid } from './pyramid';
import { capForeignStrength } from './migrate';
import { addMessage, addNews, fmtMoney } from '../news';
import { autoLineup } from '../club/lineup';
import { ctxOf, type GenCtx } from './context';
import { setTicketPrices } from '../club/manage';
import { newFinances } from '../economy/ledger';

export const WORLD_VERSION = 12;

export interface NewCareerOptions {
  careerName: string;
  presidentName: string;
  clubName: string;
  short: string;
  city: string;
  colors: [string, string];
  crest: CrestSpec;
  poolName: string;
  founded: number;
  fansName: string;
  objective: ObjectiveKind;
  difficulty: Difficulty;
  seed?: number;
  season?: number;
}

function makeShort(name: string, used: Set<string>): string {
  const clean = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').toUpperCase();
  const words = clean.split(' ').filter(Boolean);
  const candidates = [
    clean.replace(/ /g, '').slice(0, 3),
    words.length > 1 ? words[0][0] + words[1].slice(0, 2) : clean.slice(0, 3),
    clean.replace(/[AEIOUÀÈÉÌÒÙ ]/g, '').slice(0, 3),
  ];
  for (const c of candidates) if (c.length === 3 && !used.has(c)) { used.add(c); return c; }
  for (let i = 0; i < 26; i++) {
    const c = clean.slice(0, 2) + String.fromCharCode(65 + i);
    if (!used.has(c)) { used.add(c); return c; }
  }
  return clean.slice(0, 3);
}

export function createWorld(opts: NewCareerOptions): World {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const season = opts.season ?? 2026;
  const diff = DIFFICULTIES[opts.difficulty];
  const world: World = {
    version: WORLD_VERSION,
    careerId: `car${seed.toString(36)}${Date.now().toString(36)}`,
    seed,
    rng: seed,
    nextId: 1,
    season,
    day: 0,
    startSeason: season,
    difficulty: opts.difficulty,
    userClubId: '',
    presidentName: opts.presidentName,
    presidentWealth: diff.presidentWealth,
    rules: structuredClone(DEFAULT_RULES),
    clubs: {},
    players: {},
    coaches: {},
    staff: {},
    competitions: {},
    fixtures: {},
    reports: {},
    offers: [],
    transfers: [],
    sponsorOffers: [],
    events: [],
    inbox: [],
    news: [],
    shortlist: [],
    scouting: [],
    knowledge: {},
    negotiations: {},
    phase: 'regular',
    seasonSummaries: [],
    rollOfHonour: {},
    legends: [],
    eventCooldowns: {},
    flags: { coachAdjusts: true },
  };
  const ctx = ctxOf(world);
  const rng = ctx.rng;
  const userCity = ITALIAN_CITIES.find((c) => c.name === opts.city) ?? ITALIAN_CITIES[0];
  const usedShort = new Set<string>([opts.short.toUpperCase()]);
  const cityOf = (name: string): City => ITALIAN_CITIES.find((c) => c.name === name) ?? { name, region: 'Italia', lat: 41.9, lon: 12.5, size: 2 };
  // Società italiane reali: dalla A1 alla C (in ordine di forza dentro ogni categoria).
  for (const rules of world.rules.leagues) {
    const count = rules.groups * rules.teamsPerGroup - (rules.key === 'C' ? 1 : 0);
    const real = (REAL_LEAGUES[rules.key] ?? []).filter((c) => c.name.toLowerCase() !== opts.clubName.trim().toLowerCase());
    // In A1 l'ordine dell'elenco è l'ordine di forza. Nelle categorie a gironi l'elenco è per zona geografica:
    // la forza si assegna a caso, così ogni girone ha squadre forti, medie e deboli.
    const order = Array.from({ length: count }, (_, k) => k);
    if (rules.key !== 'A1') rng.shuffle(order);
    for (let i = 0; i < count; i++) {
      // Distribuzione: poche big, molte medie, qualche squadra debole.
      const t = clamp(1 - Math.pow(order[i] / Math.max(1, count - 1), 0.8) + rng.gauss(0, 0.04), 0, 1);
      const rc = real[i];
      const city = cityOf(rc?.city ?? rng.pick(ITALIAN_CITIES).name);
      const name = rc?.name ?? `Pallanuoto ${city.name} ${i + 1}`;
      const short = rc && !usedShort.has(rc.short) ? (usedShort.add(rc.short), rc.short) : makeShort(city.name, usedShort);
      const level = lerp(rules.strength[0], rules.strength[1], t) + rng.gauss(0, 1.2);
      const g = generateClub(ctx, {
        name,
        short,
        city: city.name,
        region: city.region,
        country: 'ITA',
        lat: city.lat,
        lon: city.lon,
        division: rules.key,
        level,
        reputation: lerp(rules.reputation[0], rules.reputation[1], t) + rng.gauss(0, 2),
        fans: lerp(rules.fans[0], rules.fans[1], t) * (0.7 + city.size * 0.12) * rng.float(0.85, 1.15),
        budget: lerp(rules.budget[0], rules.budget[1], t),
        facilityLevel: rules.tier === 1 ? 2.6 + t * 2.2 : rules.tier === 2 ? 1.9 + t : rules.tier === 3 ? 1.3 + t * 0.6 : 1,
        devPoints: [0, 900, 420, 180, 40][rules.tier] * (0.7 + t * 0.6),
        ticketPrice: rules.ticketPrice,
        foreignChance: rules.tier === 1 ? 0.22 : rules.tier === 2 ? 0.08 : 0.03,
        staffRoles: rules.tier === 1 ? 8 : rules.tier === 2 ? 6 : rules.tier === 3 ? 4 : 2,
        colors: rc?.colors,
        realRoster: rc ? REAL_ROSTERS[rc.name]?.players : undefined,
        crest: rc ? crestFor(rc.name, short, rc.colors) : undefined,
        founded: rc?.founded,
        philosophy: rc?.philosophy,
        poolName: `Piscina di ${city.name}`,
        rosterSize: world.rules.rosterSize,
      });
      register(world, g);
    }
  }
  // Società del giocatore (Serie C).
  const cRules = world.rules.leagues.find((l) => l.key === 'C')!;
  const userLevel = lerp(diff.squadLevel[0], diff.squadLevel[1], 0.33);
  const userGen = generateClub(ctx, {
    name: opts.clubName,
    short: opts.short.toUpperCase().slice(0, 3),
    city: userCity.name,
    region: userCity.region,
    country: 'ITA',
    lat: userCity.lat,
    lon: userCity.lon,
    division: 'C',
    level: userLevel,
    reputation: 6,
    fans: 90 + userCity.size * 20,
    budget: cRules.budget[0],
    facilityLevel: 1,
    devPoints: 0,
    isUser: true,
    colors: opts.colors,
    crest: opts.crest,
    poolName: opts.poolName,
    founded: opts.founded,
    fansName: opts.fansName,
    objective: opts.objective,
    ticketPrice: cRules.ticketPrice,
    foreignChance: 0.02,
    staffRoles: 2,
    balance: diff.startBalance,
    philosophy: 'equilibrata',
    rosterSize: world.rules.rosterSize,
  });
  // La rosa iniziale deve essere davvero debole: overall tra 25 e 50, nessun campione nascosto.
  for (const p of userGen.players) {
    if (p.youth) {
      p.potential = Math.min(p.potential, 72);
      continue;
    }
    if (p.overall > diff.squadLevel[1] + 3 || p.overall < 22) {
      const target = clamp(p.overall, diff.squadLevel[0], diff.squadLevel[1]);
      const delta = target - p.overall;
      for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) p.attrs[k] = clamp(p.attrs[k] + delta, 1, 99);
      p.overall = clamp(p.overall + delta, 20, 52);
    }
    p.potential = Math.min(p.potential, Math.max(p.overall + 2, 66));
  }
  userGen.club.finances = newFinances(season, diff.startBalance, cRules.ticketPrice);
  register(world, userGen);
  world.userClubId = userGen.club.id;
  setTicketPrices(userGen.club, cRules.ticketPrice, cRules.ticketPrice * 8);
  // Club esteri reali per le coppe europee.
  const rankInNation = new Map<string, number>();
  for (const fc of REAL_FOREIGN) {
    const rank = rankInNation.get(fc.nation) ?? 0;
    rankInNation.set(fc.nation, rank + 1);
    addForeignClub(world, ctx, fc, rank, usedShort);
  }
  // Svincolati, allenatori e staff senza squadra.
  for (let i = 0; i < 180; i++) {
    const p = generatePlayer(ctx, { level: clamp(rng.gauss(36, 11), 18, 72), foreignChance: 0.25 });
    world.players[p.id] = p;
  }
  for (let i = 0; i < 40; i++) {
    const c = generateCoach(ctx, clamp(rng.gauss(48, 16), 18, 90), null);
    world.coaches[c.id] = c;
  }
  for (const role of STAFF_ROLES) {
    for (let i = 0; i < 10; i++) {
      const s = generateStaff(ctx, role, clamp(rng.gauss(45, 17), 10, 90), null);
      world.staff[s.id] = s;
    }
  }
  // Formazioni iniziali
  for (const club of Object.values(world.clubs)) club.lineup = autoLineup(world, club);
  balancePyramid(world);
  startSeason(world, rng, true);
  const user = world.clubs[world.userClubId];
  addMessage(world, 'societa', `Benvenuto, presidente ${opts.presidentName}!`,
    `Sei il nuovo presidente di ${user.name}, iscritta alla Serie C. In cassa ci sono ${fmtMoney(user.finances.balance)} e la rosa è modesta: la strada verso la Serie A1 è lunga. Imposta formazione e tattiche, valuta gli sponsor e sfrutta il mercato estivo, aperto fino al 30 settembre.`,
    { important: true });
  addNews(world, `Nasce un nuovo progetto a ${user.city}`, `${user.name} si presenta ai nastri di partenza della Serie C con il presidente ${opts.presidentName}.`, 'societa');
  return world;
}

/** Crea un club estero reale (con la rosa pubblica se c'è) e lo aggiunge al mondo. `rank` = posizione nella classifica della sua nazione. */
export function addForeignClub(world: World, ctx: GenCtx, fc: RealForeignClub, rank: number, usedShort: Set<string>) {
  const nation = NATIONS[fc.nation];
  const size = FOREIGN_CITY_SIZE[fc.city] ?? 2;
  const level = clamp(52 + nation.school * 4.2 - rank * 2.4 + size * 0.8 + (fc.bonus ?? 0) + ctx.rng.gauss(0, 1.5), 48, 82);
  const short = !usedShort.has(fc.short) ? (usedShort.add(fc.short), fc.short) : makeShort(fc.city, usedShort);
  const g = generateClub(ctx, {
    name: fc.name,
    short,
    city: fc.city,
    region: nation.name,
    country: fc.nation,
    lat: 0,
    lon: 0,
    division: 'EST',
    level,
    reputation: clamp(level * 1.05 - 8, 30, 95),
    fans: 800 + size * 900,
    budget: 400_000 + (level - 50) * 60_000,
    facilityLevel: 2 + size * 0.5,
    devPoints: 400 + level * 10,
    ticketPrice: 8,
    foreignChance: 0,
    staffRoles: 8,
    colors: fc.colors,
    crest: crestFor(fc.name, short, fc.colors),
    realRoster: REAL_ROSTERS[fc.name]?.players,
    poolName: `Piscina di ${fc.city}`,
    rosterSize: world.rules.rosterSize,
  });
  register(world, g);
  capForeignStrength(world, g.club.id);
  return g.club;
}

function register(world: World, g: ReturnType<typeof generateClub>) {
  world.clubs[g.club.id] = g.club;
  for (const p of g.players) world.players[p.id] = p;
  world.coaches[g.coach.id] = g.coach;
  for (const s of g.staff) world.staff[s.id] = s;
}

export { Rng };
