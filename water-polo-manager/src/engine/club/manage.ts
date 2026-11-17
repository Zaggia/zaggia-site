// Azioni gestionali: strutture, allenatore e staff, allenamento, prezzi, giovanili.

import { expense } from '../economy/ledger';
import { addMessage, addNews, fmtMoney } from '../news';
import type { Club, Coach, FacilityKey, Player, StaffMember, StaffRole, World } from '../types';
import { clamp, niceMoney } from '../util';
import { FACILITIES, MAX_FACILITY_LEVEL, maxFacilityLevel, upgradeCost } from './facilities';
import { coachRating, coachWage, staffWage, STAFF_LABELS } from '../staff/coach';
import { sanitizeTactics, clubLevel } from '../tactics/tactics';
import { removeFromClub } from '../transfer/contracts';
import { expectedWage } from '../player/value';
import { assignNumbers } from './generate';

export function canUpgrade(world: World, club: Club, key: FacilityKey): string | null {
  const f = club.facilities[key];
  if (f.upgrading) return 'Lavori già in corso.';
  if (f.level >= MAX_FACILITY_LEVEL) return 'Livello massimo raggiunto.';
  if (f.level >= maxFacilityLevel(club)) return `Serve un livello societario più alto (attuale ${clubLevel(club)}) per ampliare ancora.`;
  const cost = upgradeCost(club, key);
  if (club.finances.balance < cost) return `Servono ${fmtMoney(cost)} di liquidità.`;
  void world;
  return null;
}

export function startUpgrade(world: World, club: Club, key: FacilityKey): string | null {
  const err = canUpgrade(world, club, key);
  if (err) return err;
  const cost = upgradeCost(club, key);
  const days = FACILITIES[key].days(club.facilities[key].level + 1);
  expense(club, 'strutture', cost);
  club.facilities[key].upgrading = { daysLeft: days, totalDays: days, cost };
  if (club.isUser) addMessage(world, 'societa', `Lavori avviati: ${FACILITIES[key].name}`, `Investimento di ${fmtMoney(cost)}. Fine prevista tra ${days} giorni.`, { link: { view: 'strutture' } });
  return null;
}

export function dailyFacilities(world: World, club: Club) {
  for (const key of Object.keys(club.facilities) as FacilityKey[]) {
    const f = club.facilities[key];
    if (!f.upgrading) continue;
    f.upgrading.daysLeft--;
    if (f.upgrading.daysLeft <= 0) {
      f.level++;
      f.upgrading = undefined;
      club.devPoints += 15;
      if (club.isUser) {
        addMessage(world, 'societa', `${FACILITIES[key].name}: lavori completati`, `La struttura è ora al livello ${f.level}: ${FACILITIES[key].levels[f.level - 1]}.`, { link: { view: 'strutture' } });
      }
    }
  }
}

// ─── Allenatore e staff ─────────────────────────────────────────────────────

export function coachInterest(world: World, c: Coach, club: Club): number {
  const rating = coachRating(c);
  let v = 60 + (club.reputation - c.attrs.reputazione) * 0.8;
  if (rating > 70 && club.division === 'C') v -= 25;
  if (rating > 80 && club.division === 'B') v -= 15;
  if (!c.clubId) v += 10;
  return clamp(Math.round(v), 0, 100);
}

export function coachDemand(world: World, c: Coach, club: Club): number {
  const base = coachWage(coachRating(c));
  return niceMoney(base * (1 + Math.max(0, c.attrs.reputazione - club.reputation) / 150));
}

export function hireCoach(world: World, club: Club, coachId: string, wage: number, years: number): string | null {
  const c = world.coaches[coachId];
  if (!c) return 'Allenatore non trovato.';
  if (c.clubId && c.clubId !== club.id) return 'L’allenatore è sotto contratto con un altro club.';
  if (coachInterest(world, c, club) < 30) return `${c.firstName} ${c.lastName} non è interessato al progetto.`;
  if (wage < coachDemand(world, c, club) * 0.95) return `Chiede almeno ${fmtMoney(coachDemand(world, c, club))} l’anno.`;
  if (club.coachId && club.coachId !== coachId) return 'Devi prima esonerare l’allenatore attuale.';
  c.clubId = club.id;
  c.contract = { wage, endSeason: world.season + years - 1 };
  c.security = 70;
  club.coachId = c.id;
  club.chemistry = clamp(club.chemistry - 4, 0, 100);
  sanitizeTactics(world, club);
  addNews(world, `${club.name}: ${c.firstName} ${c.lastName} è il nuovo allenatore`, `Contratto fino al ${world.season + years}.`, 'allenatori');
  return null;
}

export function coachSeverance(world: World, c: Coach): number {
  if (!c.contract) return 0;
  const years = Math.max(0, c.contract.endSeason - world.season) + 1;
  return niceMoney(c.contract.wage * Math.min(years, 2) * 0.5);
}

export function fireCoach(world: World, club: Club, reason = 'esonerato'): string | null {
  const c = club.coachId ? world.coaches[club.coachId] : null;
  if (!c) return 'Non c’è un allenatore da esonerare.';
  const cost = coachSeverance(world, c);
  expense(club, 'staff', cost);
  c.history.push({ season: world.season, clubName: club.name, division: club.division, position: null });
  c.clubId = null;
  c.contract = null;
  c.security = 60;
  club.coachId = null;
  sanitizeTactics(world, club);
  addNews(world, `${club.name}: ${c.firstName} ${c.lastName} ${reason}`, cost ? `Buonuscita di ${fmtMoney(cost)}.` : '', 'allenatori');
  return null;
}

export function renewCoach(world: World, club: Club, years: number): string | null {
  const c = club.coachId ? world.coaches[club.coachId] : null;
  if (!c || !c.contract) return 'Nessun allenatore.';
  const demand = coachDemand(world, c, club);
  c.contract = { wage: Math.max(demand, c.contract.wage), endSeason: world.season + years };
  c.security = clamp(c.security + 10, 0, 100);
  return null;
}

export function staffDemand(s: StaffMember, club: Club): number {
  return niceMoney(staffWage(s.rating) * (1 + Math.max(0, s.rating - club.reputation - 30) / 200));
}

export function staffInterest(s: StaffMember, club: Club): number {
  return clamp(Math.round(70 + (club.reputation - s.rating) * 0.7), 0, 100);
}

export function hireStaff(world: World, club: Club, staffId: string, years: number): string | null {
  const s = world.staff[staffId];
  if (!s) return 'Collaboratore non trovato.';
  if (s.clubId) return 'È già sotto contratto.';
  if (staffInterest(s, club) < 30) return `${s.firstName} ${s.lastName} preferisce un club più ambizioso.`;
  if (club.staff[s.role]) return `Hai già un ${STAFF_LABELS[s.role].toLowerCase()}: licenzialo prima.`;
  const wage = staffDemand(s, club);
  s.clubId = club.id;
  s.contract = { wage, endSeason: world.season + years - 1 };
  club.staff[s.role] = s.id;
  return null;
}

export function fireStaff(world: World, club: Club, role: StaffRole): string | null {
  const id = club.staff[role];
  if (!id) return 'Ruolo già vacante.';
  const s = world.staff[id];
  if (s?.contract) expense(club, 'staff', niceMoney(s.contract.wage * 0.5));
  if (s) { s.clubId = null; s.contract = null; }
  delete club.staff[role];
  return null;
}

// ─── Settore giovanile ──────────────────────────────────────────────────────

export function promoteYouth(world: World, club: Club, p: Player): string | null {
  if (!club.youthIds.includes(p.id)) return 'Il giocatore non è nel settore giovanile.';
  club.youthIds = club.youthIds.filter((id) => id !== p.id);
  club.playerIds.push(p.id);
  p.youth = false;
  const wage = Math.max(600, niceMoney(expectedWage(p, world.season) * 0.6));
  p.contract = { wage, endSeason: world.season + 2, status: 'giovane' };
  p.morale = clamp(p.morale + 12, 0, 100);
  assignNumbers(club.playerIds.map((id) => world.players[id]));
  if (club.isUser) addNews(world, `${p.firstName} ${p.lastName} promosso in prima squadra`, `Il prodotto del vivaio firma il primo contratto da ${fmtMoney(wage)} l’anno.`, 'giovani');
  return null;
}

export function demoteToYouth(world: World, club: Club, p: Player): string | null {
  const age = world.season - p.birthYear;
  if (age > 19) return 'Solo i giocatori fino a 19 anni possono tornare nel settore giovanile.';
  removeFromClub(world, p);
  p.clubId = club.id;
  club.youthIds.push(p.id);
  p.youth = true;
  return null;
}

export function setTicketPrices(club: Club, ticket: number, season: number) {
  club.finances.ticketPrice = clamp(Math.round(ticket), 1, 80);
  club.finances.seasonTicketPrice = clamp(Math.round(season), 5, 900);
}

export function staffByRole(world: World, club: Club, role: StaffRole): StaffMember | null {
  const id = club.staff[role];
  return id ? world.staff[id] ?? null : null;
}

export { STAFF_LABELS };
