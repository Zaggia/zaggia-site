// Sponsor: offerte con obiettivi, bonus e malus; valutazione a fine stagione.

import { KIT_SPONSORS, SPONSOR_NAMES } from '../data/names';
import { addMessage, fmtMoney } from '../news';
import type { Rng } from '../rng';
import type { Club, ObjectiveKind, SponsorContract, SponsorOffer, SponsorSlot, World } from '../types';
import { niceMoney } from '../util';
import { commercialFactor, sponsorSlots } from '../club/facilities';
import { econ, incomeMult } from './finance';
import { newId } from '../world/context';
import { teamStrength } from '../club/lineup';

export const OBJECTIVE_LABELS: Record<ObjectiveKind, string> = {
  promozione: 'Ottenere la promozione',
  playoff: 'Raggiungere la zona playoff',
  salvezza: 'Conquistare la salvezza',
  metaClassifica: 'Chiudere nella metà alta della classifica',
  top4: 'Chiudere tra le prime quattro',
  titolo: 'Vincere il campionato',
  coppa: 'Arrivare almeno in semifinale di Coppa Italia',
  europa: 'Qualificarsi per le coppe europee',
};

export const SLOT_LABELS: Record<SponsorSlot, string> = {
  principale: 'Sponsor di maglia',
  tecnico: 'Sponsor tecnico',
  secondario: 'Sponsor secondario',
};

const SLOT_SHARE: Record<SponsorSlot, number> = { principale: 1, tecnico: 0.22, secondario: 0.3 };

/** Rango atteso della squadra nel proprio girone (0 = favorita, 1 = ultima). */
export function expectedRank(world: World, club: Club): number {
  const peers = Object.values(world.clubs).filter((c) => c.division === club.division);
  const mine = teamStrength(world, club);
  const better = peers.filter((c) => c.id !== club.id && teamStrength(world, c) > mine).length;
  return peers.length > 1 ? better / (peers.length - 1) : 0.5;
}

export function suggestedObjectives(world: World, club: Club): ObjectiveKind[] {
  const r = expectedRank(world, club);
  const top = club.division === 'A1';
  const list: ObjectiveKind[] = [];
  if (r < 0.15) list.push(top ? 'titolo' : 'promozione');
  if (r < 0.35) list.push(top ? 'europa' : 'playoff', 'top4');
  if (r < 0.6) list.push('metaClassifica');
  list.push('salvezza');
  if (club.division !== 'C' && r < 0.4) list.push('coppa');
  return [...new Set(list)];
}

function pickObjective(world: World, club: Club, rng: Rng): ObjectiveKind {
  const opts = suggestedObjectives(world, club);
  return rng.chance(0.45) ? opts[0] : rng.pick(opts);
}

function objectiveDifficulty(obj: ObjectiveKind): number {
  return { titolo: 1.6, promozione: 1.5, europa: 1.3, top4: 1.25, playoff: 1.15, coppa: 1.2, metaClassifica: 1.0, salvezza: 0.85 }[obj];
}

export function makeSponsorOffer(world: World, club: Club, slot: SponsorSlot, rng: Rng): SponsorOffer {
  const e = econ(club);
  const marketing = club.staff.marketing ? world.staff[club.staff.marketing]?.rating ?? 0 : 0;
  const objective = pickObjective(world, club, rng);
  const diff = objectiveDifficulty(objective);
  const annual = niceMoney(
    e.sponsorBase * SLOT_SHARE[slot] * (0.6 + club.reputation / 100) * commercialFactor(club) * (1 + marketing / 400) *
      incomeMult(world, club) * rng.float(0.8, 1.2) * (0.9 + (diff - 1) * 0.25),
  );
  const years = rng.int(1, 3);
  const name = slot === 'tecnico' ? rng.pick(KIT_SPONSORS) : rng.pick(SPONSOR_NAMES);
  return {
    id: newId(world, 'sp'),
    name,
    slot,
    annual,
    startSeason: world.season,
    endSeason: world.season + years - 1,
    objective,
    bonus: niceMoney(annual * rng.float(0.2, 0.55) * diff),
    malus: Math.round(rng.float(0, 0.25) * 100) / 100,
    expiresDay: world.day + rng.int(10, 25),
  };
}

export function freeSlots(club: Club): SponsorSlot[] {
  const max = sponsorSlots(club.facilities.uffici.level);
  const out: SponsorSlot[] = [];
  if (!club.sponsors.some((s) => s.slot === 'principale')) out.push('principale');
  if (!club.sponsors.some((s) => s.slot === 'tecnico')) out.push('tecnico');
  const sec = club.sponsors.filter((s) => s.slot === 'secondario').length;
  for (let i = 0; i < max - 2 - sec; i++) out.push('secondario');
  return out;
}

/** Genera offerte per gli slot liberi del club dell'utente. */
export function refreshUserSponsorOffers(world: World, rng: Rng, notify = true) {
  const club = world.clubs[world.userClubId];
  world.sponsorOffers = world.sponsorOffers.filter((o) => o.expiresDay >= world.day);
  const slots = freeSlots(club);
  let created = 0;
  for (const slot of slots) {
    const existing = world.sponsorOffers.filter((o) => o.slot === slot).length;
    const want = slot === 'principale' ? 3 : 2;
    for (let i = existing; i < want; i++) {
      world.sponsorOffers.push(makeSponsorOffer(world, club, slot, rng));
      created++;
    }
  }
  if (created && notify) {
    addMessage(world, 'sponsor', 'Nuove proposte di sponsorizzazione', `Hai ${created} nuove offerte di sponsor da valutare.`, { link: { view: 'sponsor' } });
  }
}

export function acceptSponsorOffer(world: World, offerId: string): string | null {
  const club = world.clubs[world.userClubId];
  const o = world.sponsorOffers.find((x) => x.id === offerId);
  if (!o) return 'Offerta non più disponibile.';
  if (!freeSlots(club).includes(o.slot)) return 'Non hai uno spazio libero per questo tipo di sponsor.';
  const contract: SponsorContract = { ...o };
  delete (contract as Partial<SponsorOffer>).expiresDay;
  contract.startSeason = world.season;
  contract.endSeason = world.season + (o.endSeason - o.startSeason);
  club.sponsors.push(contract);
  world.sponsorOffers = world.sponsorOffers.filter((x) => x.id !== offerId && !(x.slot === o.slot && o.slot !== 'secondario'));
  return null;
}

export function rejectSponsorOffer(world: World, offerId: string) {
  world.sponsorOffers = world.sponsorOffers.filter((x) => x.id !== offerId);
}

/** I club AI firmano automaticamente con gli sponsor disponibili. */
export function aiSponsors(world: World, club: Club, rng: Rng) {
  for (const slot of freeSlots(club)) {
    const o = makeSponsorOffer(world, club, slot, rng);
    const c: SponsorContract = { ...o };
    delete (c as Partial<SponsorOffer>).expiresDay;
    club.sponsors.push(c);
  }
}

/** Valuta l'obiettivo di uno sponsor in base al risultato stagionale. */
export function objectiveMet(obj: ObjectiveKind, r: { pos: number | null; groupSize: number; promoted: boolean; champion: boolean; cupSemi: boolean; europe: boolean; relegated: boolean; playoff: boolean }): boolean {
  const pos = r.pos ?? r.groupSize;
  switch (obj) {
    case 'promozione': return r.promoted;
    case 'titolo': return r.champion;
    case 'playoff': return r.playoff || r.promoted || pos <= Math.ceil(r.groupSize / 3);
    case 'top4': return pos <= 4;
    case 'metaClassifica': return pos <= Math.ceil(r.groupSize / 2);
    case 'salvezza': return !r.relegated;
    case 'coppa': return r.cupSemi;
    case 'europa': return r.europe;
  }
}

export function settleSponsors(world: World, club: Club, outcome: Parameters<typeof objectiveMet>[1]) {
  const keep: SponsorContract[] = [];
  for (const s of club.sponsors) {
    const ok = objectiveMet(s.objective, outcome);
    if (ok && s.bonus) {
      club.finances.balance += s.bonus;
      club.finances.ledger.income.sponsor += s.bonus;
      if (club.isUser) addMessage(world, 'sponsor', `${s.name}: obiettivo raggiunto`, `Lo sponsor versa un bonus di ${fmtMoney(s.bonus)}.`);
    } else if (!ok && s.malus > 0 && s.endSeason > world.season) {
      s.annual = niceMoney(s.annual * (1 - s.malus));
      if (club.isUser) addMessage(world, 'sponsor', `${s.name}: obiettivo mancato`, `Il contributo annuo scende a ${fmtMoney(s.annual)} (−${Math.round(s.malus * 100)}%).`);
    }
    if (s.endSeason > world.season) keep.push(s);
    else if (club.isUser) addMessage(world, 'sponsor', `Scaduto il contratto con ${s.name}`, 'Lo spazio è di nuovo libero: valuta le nuove offerte.');
  }
  club.sponsors = keep;
}

export function sponsorValueTotal(club: Club): number {
  return club.sponsors.reduce((t, s) => t + s.annual, 0);
}

