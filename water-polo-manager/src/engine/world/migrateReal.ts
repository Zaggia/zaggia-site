// Migrazione v4: porta le carriere nate prima delle società e dei giocatori reali al mondo reale.
// - Le società inventate prendono l'identità di una società vera della stessa categoria (nome, città, colori, stemma).
// - Le società con una rosa pubblica (REAL_ROSTERS) schierano i loro giocatori veri, con la forza di squadra di prima.
// La società e i giocatori dell'utente non vengono toccati.

import { FOREIGN_CITY_SIZE, REAL_FOREIGN, REAL_LEAGUES, type RealClub } from '../data/realClubs';
import { ITALIAN_CITIES } from '../data/cities';
import { NATIONS } from '../data/names';
import { REAL_ROSTERS } from '../data/realPlayers';
import { crestFor } from '../club/crest';
import { assignNumbers, assignStatuses, generateRealRoster } from '../club/generate';
import { autoLineup, teamStrength } from '../club/lineup';
import { Rng } from '../rng';
import type { Club, World } from '../types';
import { ctxOf } from './context';
import { shiftClub } from './migrate';

void FOREIGN_CITY_SIZE;

function allRealNames(): Set<string> {
  const names = new Set<string>();
  for (const list of Object.values(REAL_LEAGUES)) for (const c of list) names.add(c.name.toLowerCase());
  for (const c of REAL_FOREIGN) names.add(c.name.toLowerCase());
  return names;
}

function applyIdentity(world: World, club: Club, rc: RealClub, used: Set<string>, foreignNation?: string) {
  const city = ITALIAN_CITIES.find((c) => c.name === rc.city);
  club.name = rc.name;
  let short = rc.short.toUpperCase();
  if (used.has(short)) {
    for (let i = 0; i < 26 && used.has(short); i++) short = rc.short.slice(0, 2).toUpperCase() + String.fromCharCode(65 + i);
  }
  used.add(short);
  club.short = short;
  club.city = rc.city;
  if (foreignNation) {
    club.region = NATIONS[foreignNation]?.name ?? 'Estero';
  } else {
    club.region = city?.region ?? club.region;
    if (city) { club.lat = city.lat; club.lon = city.lon; }
  }
  club.colors = [...rc.colors];
  club.crest = crestFor(rc.name, short, rc.colors);
  if (rc.founded) club.founded = rc.founded;
  if (rc.philosophy) club.philosophy = rc.philosophy;
  club.poolName = `Piscina di ${rc.city}`;
  void world;
}

/** Società inventate → società reali della stessa categoria. Restituisce quante identità sono state assegnate. */
function assignRealClubs(world: World, rng: Rng): number {
  const real = allRealNames();
  const clubs = Object.values(world.clubs);
  const usedShort = new Set(clubs.map((c) => c.short));
  const usedNames = new Set(clubs.map((c) => c.name.toLowerCase()));
  let done = 0;
  // Italiane, per categoria.
  for (const key of ['A1', 'A2', 'B', 'C']) {
    const need = clubs.filter((c) => c.country === 'ITA' && c.division === key && !c.isUser && !real.has(c.name.toLowerCase()));
    let candidates = (REAL_LEAGUES[key] ?? []).filter((r) => !usedNames.has(r.name.toLowerCase()));
    if (!need.length || !candidates.length) continue;
    // In A1 l'elenco è in ordine di forza: la più forte prende il primo nome. Altrove conta la regione di provenienza.
    const order = key === 'A1' ? [...need].sort((a, b) => teamStrength(world, b) - teamStrength(world, a)) : rng.shuffle([...need]);
    for (const club of order) {
      if (!candidates.length) break;
      let pick = 0;
      if (key !== 'A1') {
        const same = candidates.findIndex((r) => ITALIAN_CITIES.find((c) => c.name === r.city)?.region === club.region);
        if (same >= 0) pick = same;
      }
      const rc = candidates[pick];
      candidates = candidates.filter((_, i) => i !== pick);
      usedNames.add(rc.name.toLowerCase());
      applyIdentity(world, club, rc, usedShort);
      done++;
    }
  }
  // Estere, per nazione.
  const needForeign = clubs.filter((c) => c.country !== 'ITA' && !real.has(c.name.toLowerCase()));
  for (const club of rng.shuffle([...needForeign])) {
    const free = REAL_FOREIGN.filter((r) => !usedNames.has(r.name.toLowerCase()));
    const rc = free.find((r) => r.nation === club.country) ?? free[0];
    if (!rc) break;
    usedNames.add(rc.name.toLowerCase());
    applyIdentity(world, club, rc, usedShort, rc.nation);
    club.country = rc.nation;
    done++;
  }
  return done;
}

/** Sostituisce i giocatori inventati con quelli veri per le società che hanno una rosa pubblica. */
export function assignRealRosters(world: World): number {
  let done = 0;
  const ctx = ctxOf(world);
  for (const club of Object.values(world.clubs)) {
    if (club.isUser) continue;
    const roster = REAL_ROSTERS[club.name];
    if (!roster) continue;
    const old = club.playerIds.map((id) => world.players[id]).filter(Boolean);
    if (old.length && old.every((p) => p.real)) continue;
    const target = teamStrength(world, club);
    const players = generateRealRoster(ctx, club.id, target, club.country, roster.players, world.rules.rosterSize ?? 15, club.country === 'ITA' ? 0.2 : 0);
    for (const p of old) {
      if (p.loan) continue;
      p.retired = true;
      p.clubId = null;
      p.contract = null;
      p.transferListed = false;
      p.loanListed = false;
      p.wantsToLeave = false;
    }
    const kept = old.filter((p) => p.loan).map((p) => p.id);
    for (const p of players) world.players[p.id] = p;
    club.playerIds = [...players.map((p) => p.id), ...kept];
    assignNumbers(players);
    assignStatuses(players);
    shiftClub(world, club.id, target);
    club.lineup = autoLineup(world, club);
    done++;
  }
  // Osservati, offerte e scouting non devono puntare a giocatori ritirati.
  world.shortlist = world.shortlist.filter((id) => world.players[id] && !world.players[id].retired);
  world.offers = world.offers.filter((o) => world.players[o.playerId] && !world.players[o.playerId].retired);
  world.scouting = world.scouting.filter((a) => world.players[a.playerId] && !world.players[a.playerId].retired);
  return done;
}

export function realifyWorld(world: World): { clubs: number; rosters: number } {
  const rng = Rng.fromSeed((world.seed ^ 0x7ea1c1ab) | 0);
  const clubs = assignRealClubs(world, rng);
  const rosters = assignRealRosters(world);
  return { clubs, rosters };
}
