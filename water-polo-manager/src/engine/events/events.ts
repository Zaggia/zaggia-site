// Eventi casuali e decisioni presidenziali. Ogni scelta ha conseguenze concrete.

import { expense, income } from '../economy/ledger';
import { refreshUserSponsorOffers } from '../economy/sponsors';
import { addMessage, addNews, fmtMoney } from '../news';
import type { Rng } from '../rng';
import type { EventChoice, GameEvent, ObjectiveKind, Player, World } from '../types';
import { clamp, niceMoney, topN } from '../util';
import { fullName } from '../player/generate';
import { ageOf } from '../player/value';
import { newId } from '../world/context';
import { userClub, leagueComp } from '../world/queries';
import { fireCoach, promoteYouth, startUpgrade } from '../club/manage';
import { projectRevenueTotal } from '../economy/finance';
import { transferWindowOpen } from '../transfer/market';
import { positionOf } from '../competition/standings';
import { generateStaff } from '../staff/coach';
import { ctxOf } from '../world/context';
import { OBJECTIVE_LABELS, suggestedObjectives } from '../economy/sponsors';
import { dayOf } from '../calendar';
import { FACILITIES, upgradeCost } from '../club/facilities';

interface Template {
  kind: string;
  weight: number;
  cooldown: number;
  blocking: boolean;
  /** Restituisce i dati dell'evento se applicabile, altrimenti null. */
  check: (world: World, rng: Rng) => Record<string, any> | null;
  build: (world: World, d: Record<string, any>) => { title: string; body: string; choices: EventChoice[] };
  resolve: (world: World, ev: GameEvent, choice: string, rng: Rng) => string;
}

const P = (world: World, id: string): Player => world.players[id];

const TEMPLATES: Template[] = [
  {
    kind: 'starLeave',
    weight: 5,
    cooldown: 260,
    blocking: true,
    check: (world, rng) => {
      const club = userClub(world);
      const squad = club.playerIds.map((id) => world.players[id]).filter(Boolean);
      const stars = topN(squad, 2, (p) => p.overall).filter((p) => !p.wantsToLeave && p.personality.ambizione >= 11 && !p.promise);
      const p = stars.find((x) => x.reputation > club.reputation + 3 || x.morale < 45);
      if (!p || !rng.chance(0.6)) return null;
      return { playerId: p.id };
    },
    build: (world, d) => {
      const p = P(world, d.playerId);
      const goals = Object.values(p.stats).reduce((t, s) => t + s.goals, 0);
      return {
        title: 'Il miglior giocatore vuole andarsene',
        body: `${fullName(p)} (${p.overall} di overall${goals ? `, ${goals} gol in stagione` : ''}) chiede di trasferirsi in una società più ambiziosa.`,
        choices: [
          { id: 'rinnovo', label: 'Offri un rinnovo con aumento', hint: `Ingaggio +30% (${fmtMoney(niceMoney((p.contract?.wage ?? 0) * 1.3))}) e un anno in più` },
          { id: 'promessa', label: 'Prometti un rafforzamento della rosa', hint: 'Dovrai ingaggiare un giocatore di pari livello entro la fine del mercato' },
          { id: 'cessione', label: 'Accetti la cessione', hint: 'Il giocatore va sul mercato' },
          { id: 'rifiuto', label: 'Rifiuti la richiesta', hint: 'Morale in picchiata e spogliatoio teso' },
        ],
      };
    },
    resolve: (world, ev, choice) => {
      const p = P(world, ev.data.playerId);
      const club = userClub(world);
      if (!p || p.clubId !== club.id) return 'Il giocatore non è più in rosa.';
      if (choice === 'rinnovo' && p.contract) {
        p.contract.wage = niceMoney(p.contract.wage * 1.3);
        p.contract.endSeason = Math.max(p.contract.endSeason, world.season) + 1;
        p.morale = clamp(p.morale + 15, 0, 100);
        p.wantsToLeave = false;
        return `${fullName(p)} firma il rinnovo e resta. Ingaggio: ${fmtMoney(p.contract.wage)}.`;
      }
      if (choice === 'promessa') {
        const win = transferWindowOpen(world).open;
        p.promise = { kind: 'strengthen', untilDay: win ? Math.min(world.day + 60, dayOf(world.season, world.rules.windows[0]?.end ?? '10-12')) : world.day + 90, season: world.season };
        (p as any).promiseLevel = p.overall - 5;
        p.morale = clamp(p.morale + 8, 0, 100);
        return `${fullName(p)} ti dà fiducia. Ingaggia un giocatore di almeno ${p.overall - 5} di overall entro la scadenza.`;
      }
      if (choice === 'cessione') {
        p.transferListed = true;
        p.wantsToLeave = true;
        p.morale = clamp(p.morale + 5, 0, 100);
        return `${fullName(p)} è sul mercato: arriveranno offerte.`;
      }
      p.morale = clamp(p.morale - 20, 0, 100);
      p.wantsToLeave = true;
      club.chemistry = clamp(club.chemistry - 4, 0, 100);
      return `${fullName(p)} è furioso: il clima nello spogliatoio peggiora.`;
    },
  },
  {
    kind: 'sponsorCrisis',
    weight: 3,
    cooldown: 200,
    blocking: true,
    check: (world, rng) => {
      const club = userClub(world);
      const s = club.sponsors.filter((x) => x.slot !== 'principale' || rng.chance(0.3));
      if (!s.length) return null;
      const target = rng.pick(s);
      const trouble = club.finances.unpaidWeeks > 0 || club.recent.slice(-5).filter((r) => r === 'L').length >= 4;
      if (!trouble && !rng.chance(0.25)) return null;
      return { sponsorId: target.id, name: target.name, annual: target.annual };
    },
    build: (world, d) => ({
      title: 'Crisi economica: uno sponsor si ritira',
      body: `${d.name} interrompe il contratto (${fmtMoney(d.annual)} l’anno) per difficoltà aziendali.`,
      choices: [
        { id: 'cerca', label: 'Cerca subito un sostituto', hint: 'Nuove offerte, ma più basse del solito' },
        { id: 'campagna', label: 'Lancia una campagna di marketing', hint: `Costo ${fmtMoney(4000)}: più tifosi e offerte migliori` },
        { id: 'accetta', label: 'Prendi atto', hint: 'Lo spazio resta libero' },
      ],
    }),
    resolve: (world, ev, choice, rng) => {
      const club = userClub(world);
      club.sponsors = club.sponsors.filter((s) => s.id !== ev.data.sponsorId);
      if (choice === 'cerca') {
        refreshUserSponsorOffers(world, rng, false);
        for (const o of world.sponsorOffers) o.annual = niceMoney(o.annual * 0.85);
        return 'Arrivano nuove proposte, ma il mercato sa che sei in difficoltà: valori più bassi.';
      }
      if (choice === 'campagna') {
        expense(club, 'altro', 4000);
        club.fans = Math.round(club.fans * 1.05);
        refreshUserSponsorOffers(world, rng, false);
        return 'La campagna porta nuovi tifosi e nuove proposte di sponsorizzazione.';
      }
      return 'Lo spazio sponsor resta libero.';
    },
  },
  {
    kind: 'coachPressure',
    weight: 6,
    cooldown: 120,
    blocking: true,
    check: (world) => {
      const club = userClub(world);
      if (!club.coachId) return null;
      const last = club.recent.slice(-4);
      if (last.length < 4 || !last.every((r) => r === 'L')) return null;
      return { coachId: club.coachId };
    },
    build: (world, d) => {
      const c = world.coaches[d.coachId];
      return {
        title: 'L’allenatore è sotto pressione',
        body: `La squadra ha perso quattro partite consecutive. Stampa e tifosi chiedono la testa di ${c.firstName} ${c.lastName}.`,
        choices: [
          { id: 'conferma', label: 'Confermi pubblicamente l’allenatore', hint: 'Fiducia e serenità, ma la reputazione ne risente se i risultati non arrivano' },
          { id: 'ultimatum', label: 'Dai un ultimatum', hint: 'Squadra più motivata ma più tesa' },
          { id: 'esonera', label: 'Esoneri l’allenatore', hint: 'Buonuscita da pagare, dovrai trovare un sostituto' },
        ],
      };
    },
    resolve: (world, ev, choice) => {
      const club = userClub(world);
      const c = world.coaches[ev.data.coachId];
      if (!c || club.coachId !== c.id) return 'L’allenatore non è più al suo posto.';
      if (choice === 'conferma') {
        c.security = clamp(c.security + 20, 0, 100);
        for (const id of club.playerIds) world.players[id].morale = clamp(world.players[id].morale + 3, 0, 100);
        club.reputation = clamp(club.reputation - 1, 1, 100);
        return 'Il presidente blinda l’allenatore: lo spogliatoio apprezza.';
      }
      if (choice === 'ultimatum') {
        c.security = 25;
        for (const id of club.playerIds) world.players[id].morale = clamp(world.players[id].morale + 1, 0, 100);
        club.chemistry = clamp(club.chemistry - 2, 0, 100);
        return 'Ultimatum: servono risultati subito.';
      }
      fireCoach(world, club, 'esonerato');
      addMessage(world, 'staff', 'Serve un nuovo allenatore', 'Fino all’arrivo del nuovo tecnico la squadra è guidata dal vice. Scegli il sostituto nella sezione Allenatore e staff.', { link: { view: 'staff' }, important: true });
      return 'Allenatore esonerato. Ora scegli il sostituto.';
    },
  },
  {
    kind: 'acquisition',
    weight: 2,
    cooldown: 500,
    blocking: true,
    check: (world, rng) => {
      const club = userClub(world);
      if (club.partner || club.reputation < 12 || !rng.chance(0.5)) return null;
      const amount = niceMoney(projectRevenueTotal(club) * rng.float(0.5, 1.1));
      const objective: ObjectiveKind = club.division === 'A1' ? 'europa' : 'promozione';
      return { amount, objective, name: rng.pick(['Gruppo Moretti Holding', 'Acque Blu Investimenti', 'Lido Capital', 'Fondazione Mare Nostrum', 'Delta Sport Partners']) };
    },
    build: (world, d) => ({
      title: 'Offerta di acquisizione',
      body: `${d.name} vuole acquistare il 30% della società per ${fmtMoney(d.amount)}. In cambio chiede un obiettivo entro due stagioni: ${OBJECTIVE_LABELS[d.objective as ObjectiveKind].toLowerCase()}. Se fallisci, il socio esce e chiede indietro il 40% dell’investimento.`,
      choices: [
        { id: 'accetta', label: 'Accetti l’ingresso del socio', hint: `+${fmtMoney(d.amount)} subito` },
        { id: 'tratta', label: 'Provi a trattare', hint: 'Potresti ottenere di più… o perdere l’offerta' },
        { id: 'rifiuta', label: 'Rifiuti: la società resta tua', hint: 'Nessun vincolo' },
      ],
    }),
    resolve: (world, ev, choice, rng) => {
      const club = userClub(world);
      let amount = ev.data.amount as number;
      if (choice === 'tratta') {
        if (rng.chance(0.5)) amount = niceMoney(amount * 1.2);
        else return `${ev.data.name} si ritira dalla trattativa.`;
      }
      if (choice === 'rifiuta') return 'Hai rifiutato l’offerta: nessun socio esterno.';
      income(club, 'investimenti', amount);
      club.partner = { name: ev.data.name, share: 0.3, objective: ev.data.objective, untilSeason: world.season + 1 };
      (club.partner as any).amount = amount;
      addNews(world, `${club.name}: entra un nuovo socio`, `${ev.data.name} acquista il 30% della società per ${fmtMoney(amount)}.`, 'societa');
      return `Accordo firmato: ${fmtMoney(amount)} entrano nelle casse.`;
    },
  },
  {
    kind: 'poolBreakdown',
    weight: 2,
    // Un guasto serio è raro: in media uno ogni diversi anni, e quasi mai con impianti recenti.
    cooldown: 1000,
    blocking: true,
    check: (world, rng) => {
      if (world.day < 60 || world.day > 300) return null;
      const lvl = userClub(world).facilities.piscina.level;
      const risk = [0, 0.2, 0.1, 0.03, 0.015, 0.01][lvl] ?? 0.01;
      if (!rng.chance(risk)) return null;
      const problems = [
        { what: 'la pompa di ricircolo dell’acqua', mult: 0.8 },
        { what: 'una perdita nel bordo vasca', mult: 1.0 },
        { what: 'il sistema di filtraggio', mult: 1.2 },
        { what: 'l’impianto di riscaldamento della vasca', mult: 1.5 },
      ];
      const pr = rng.pick(problems);
      return { cost: niceMoney((2000 + lvl * 1500) * pr.mult * rng.float(0.8, 1.3)), what: pr.what };
    },
    build: (_world, d) => ({
      title: 'Guasto alla piscina',
      body: `Si è rotto ${d.what ?? 'l’impianto di riscaldamento della vasca'}. La riparazione costa ${fmtMoney(d.cost)}.`,
      choices: [
        { id: 'ripara', label: 'Ripari subito', hint: `−${fmtMoney(d.cost)}` },
        { id: 'comune', label: 'Chiedi l’intervento del Comune', hint: 'Metà dei costi, se il Comune accetta; altrimenti piscina chiusa' },
        { id: 'rinvia', label: 'Rinvii i lavori', hint: 'Piscina inagibile per 3 settimane: niente incassi in casa' },
      ],
    }),
    resolve: (world, ev, choice, rng) => {
      const club = userClub(world);
      if (choice === 'ripara') {
        expense(club, 'manutenzione', ev.data.cost);
        return 'Impianto riparato.';
      }
      if (choice === 'comune' && rng.chance(0.55)) {
        expense(club, 'manutenzione', ev.data.cost / 2);
        return 'Il Comune copre metà dei costi.';
      }
      club.poolClosedUntil = world.day + 21;
      club.fans = Math.round(club.fans * 0.97);
      return choice === 'comune' ? 'Il Comune non risponde: piscina chiusa per tre settimane.' : 'Piscina chiusa per tre settimane: le partite in casa non portano incassi.';
    },
  },
  {
    kind: 'municipalityGrant',
    weight: 2,
    cooldown: 400,
    blocking: false,
    check: (world, rng) => {
      const club = userClub(world);
      const f = club.facilities.piscina;
      if (f.upgrading || f.level >= 5 || !rng.chance(0.5)) return null;
      return { cost: niceMoney(upgradeCost(club, 'piscina') / 2) };
    },
    build: (_world, d) => ({
      title: 'Il Comune propone di ristrutturare la piscina',
      body: `Il Comune finanzia metà dell’ampliamento della piscina se la società mette ${fmtMoney(d.cost)}.`,
      choices: [
        { id: 'accetta', label: 'Accetti e cofinanzi', hint: `−${fmtMoney(d.cost)}, lavori al via` },
        { id: 'rifiuta', label: 'Declini', hint: 'Nessun costo' },
      ],
    }),
    resolve: (world, ev, choice) => {
      const club = userClub(world);
      if (choice !== 'accetta') return 'Proposta declinata.';
      if (club.finances.balance < ev.data.cost) return 'Non hai la liquidità necessaria: l’occasione sfuma.';
      const full = upgradeCost(club, 'piscina');
      income(club, 'contributi', full - ev.data.cost);
      const err = startUpgrade(world, club, 'piscina');
      if (err) {
        expense(club, 'altro', full - ev.data.cost);
        return `Impossibile avviare i lavori: ${err}`;
      }
      return `Lavori avviati: ${FACILITIES.piscina.name} verso il livello ${club.facilities.piscina.level + 1}.`;
    },
  },
  {
    kind: 'localTV',
    weight: 3,
    cooldown: 365,
    blocking: false,
    check: (world, rng) => (rng.chance(0.5) ? { fee: niceMoney(2000 + userClub(world).reputation * 150) } : null),
    build: (_world, d) => ({
      title: 'Una TV locale vuole trasmettere le partite',
      body: `L’emittente offre ${fmtMoney(d.fee)} per i diritti della stagione.`,
      choices: [
        { id: 'accetta', label: 'Accetti', hint: `+${fmtMoney(d.fee)} e più visibilità` },
        { id: 'rilancia', label: 'Chiedi di più', hint: '50%: +50% dell’offerta, 50%: salta tutto' },
        { id: 'rifiuta', label: 'Rifiuti', hint: 'Nessun effetto' },
      ],
    }),
    resolve: (world, ev, choice, rng) => {
      const club = userClub(world);
      if (choice === 'rifiuta') return 'Offerta rifiutata.';
      let fee = ev.data.fee as number;
      if (choice === 'rilancia') {
        if (!rng.chance(0.5)) return 'L’emittente si tira indietro.';
        fee = niceMoney(fee * 1.5);
      }
      income(club, 'altro', fee);
      club.fans = Math.round(club.fans * 1.06);
      return `Diritti TV venduti per ${fmtMoney(fee)}: più tifosi seguono la squadra.`;
    },
  },
  {
    kind: 'fansProtest',
    weight: 4,
    cooldown: 200,
    blocking: true,
    check: (world) => {
      const club = userClub(world);
      const losses = club.recent.slice(-5).filter((r) => r === 'L').length;
      if (losses < 4) return null;
      return {};
    },
    build: (world) => ({
      title: 'Contestazione dei tifosi',
      body: `I ${userClub(world).fansName} protestano dopo l’ultima serie di sconfitte.`,
      choices: [
        { id: 'incontro', label: 'Incontri i tifosi', hint: 'Il presidente ci mette la faccia' },
        { id: 'prezzi', label: 'Abbassi i prezzi dei biglietti del 30%', hint: 'Meno incassi, più pubblico' },
        { id: 'ignora', label: 'Ignori la protesta', hint: 'Tifosi e reputazione in calo' },
      ],
    }),
    resolve: (world, _ev, choice) => {
      const club = userClub(world);
      if (choice === 'incontro') {
        club.fans = Math.round(club.fans * 0.99);
        for (const id of club.playerIds) world.players[id].morale = clamp(world.players[id].morale + 3, 0, 100);
        return 'L’incontro rasserena l’ambiente.';
      }
      if (choice === 'prezzi') {
        club.finances.ticketPrice = Math.max(1, Math.round(club.finances.ticketPrice * 0.7));
        club.fans = Math.round(club.fans * 1.04);
        return `Biglietto ridotto a ${club.finances.ticketPrice} €.`;
      }
      club.fans = Math.round(club.fans * 0.93);
      club.reputation = clamp(club.reputation - 1, 1, 100);
      return 'I tifosi voltano le spalle alla società.';
    },
  },
  {
    kind: 'discipline',
    weight: 3,
    cooldown: 150,
    blocking: true,
    check: (world, rng) => {
      const club = userClub(world);
      const hot = club.playerIds.map((id) => world.players[id]).filter((p) => p && p.personality.temperamento >= 14);
      if (!hot.length || !rng.chance(0.5)) return null;
      return { playerId: rng.pick(hot).id };
    },
    build: (world, d) => ({
      title: 'Lite in allenamento',
      body: `${fullName(P(world, d.playerId))} ha litigato pesantemente con un compagno durante l’allenamento.`,
      choices: [
        { id: 'multa', label: 'Multi il giocatore', hint: 'Il gruppo apprezza, lui no' },
        { id: 'sospendi', label: 'Lo tieni fuori dagli allenamenti', hint: 'Segnale forte allo spogliatoio' },
        { id: 'ignora', label: 'Lasci correre', hint: 'Lo spogliatoio si divide' },
      ],
    }),
    resolve: (world, ev, choice) => {
      const club = userClub(world);
      const p = P(world, ev.data.playerId);
      if (!p || p.clubId !== club.id) return 'Il giocatore non è più in rosa.';
      if (choice === 'multa') {
        p.morale = clamp(p.morale - 10, 0, 100);
        club.chemistry = clamp(club.chemistry + 2, 0, 100);
        return `${fullName(p)} multato.`;
      }
      if (choice === 'sospendi') {
        p.morale = clamp(p.morale - 15, 0, 100);
        club.chemistry = clamp(club.chemistry + 3, 0, 100);
        return `${fullName(p)} tenuto fuori dagli allenamenti per qualche giorno.`;
      }
      club.chemistry = clamp(club.chemistry - 5, 0, 100);
      return 'Lo spogliatoio si divide.';
    },
  },
  {
    kind: 'playingTime',
    weight: 5,
    cooldown: 90,
    blocking: true,
    check: (world) => {
      const club = userClub(world);
      const p = club.playerIds.map((id) => world.players[id]).find(
        (x) => x && !x.promise && x.playingTime < 0.25 && x.morale < 55 && (x.contract?.status === 'titolare' || x.contract?.status === 'fondamentale' || x.personality.ambizione >= 14) && !x.injury,
      );
      return p ? { playerId: p.id } : null;
    },
    build: (world, d) => ({
      title: 'Si lamenta per il poco spazio',
      body: `${fullName(P(world, d.playerId))} chiede di giocare di più: si sente messo da parte.`,
      choices: [
        { id: 'promessa', label: 'Prometti più minuti', hint: 'Dovrà giocare con continuità nel prossimo mese' },
        { id: 'lotta', label: 'Deve guadagnarsi il posto', hint: 'Dipende dal suo carattere' },
        { id: 'mercato', label: 'Lo metti sul mercato', hint: 'Arriveranno offerte' },
      ],
    }),
    resolve: (world, ev, choice) => {
      const p = P(world, ev.data.playerId);
      if (!p || p.clubId !== world.userClubId) return 'Il giocatore non è più in rosa.';
      if (choice === 'promessa') {
        p.promise = { kind: 'playingTime', untilDay: world.day + 30, season: world.season };
        p.morale = clamp(p.morale + 10, 0, 100);
        return `${fullName(p)} si aspetta di giocare di più nelle prossime settimane.`;
      }
      if (choice === 'lotta') {
        const good = p.personality.professionalita >= 11;
        p.morale = clamp(p.morale + (good ? 5 : -8), 0, 100);
        return good ? `${fullName(p)} accetta la sfida.` : `${fullName(p)} non la prende bene.`;
      }
      p.transferListed = true;
      p.morale = clamp(p.morale + 5, 0, 100);
      return `${fullName(p)} è sul mercato.`;
    },
  },
  {
    kind: 'unpaidWages',
    weight: 20,
    cooldown: 21,
    blocking: true,
    check: (world) => (userClub(world).finances.unpaidWeeks >= 3 ? { arrears: userClub(world).finances.arrears } : null),
    build: (world, d) => ({
      title: 'Stipendi arretrati: la squadra minaccia lo sciopero',
      body: `Mancano ${fmtMoney(d.arrears)} di stipendi. Se la situazione non si sblocca arriveranno penalizzazioni e i giocatori potranno andarsene.`,
      choices: [
        { id: 'investi', label: 'Paghi con il tuo patrimonio', hint: `Patrimonio personale: ${fmtMoney(world.presidentWealth)}`, disabled: world.presidentWealth < d.arrears },
        { id: 'vendi', label: 'Metti sul mercato i giocatori più pagati', hint: 'Liquidità dalle cessioni' },
        { id: 'prometti', label: 'Prometti di pagare presto', hint: 'Morale in calo, rischio penalizzazione' },
      ],
    }),
    resolve: (world, _ev, choice) => {
      const club = userClub(world);
      const f = club.finances;
      if (choice === 'investi' && world.presidentWealth >= f.arrears) {
        world.presidentWealth -= f.arrears;
        income(club, 'investimenti', f.arrears);
        expense(club, 'stipendi', f.arrears);
        f.arrears = 0;
        f.unpaidWeeks = 0;
        return 'Arretrati saldati con i fondi del presidente.';
      }
      if (choice === 'vendi') {
        const top = topN(club.playerIds.map((id) => world.players[id]), 3, (p) => p.contract?.wage ?? 0);
        for (const p of top) p.transferListed = true;
        for (const id of club.playerIds) world.players[id].morale = clamp(world.players[id].morale - 5, 0, 100);
        return `In vendita: ${top.map((p) => p.lastName).join(', ')}.`;
      }
      for (const id of club.playerIds) world.players[id].morale = clamp(world.players[id].morale - 10, 0, 100);
      return 'I giocatori ti concedono ancora qualche settimana, ma il morale crolla.';
    },
  },
  {
    kind: 'charity',
    weight: 3,
    cooldown: 200,
    blocking: false,
    check: (_world, rng) => (rng.chance(0.5) ? { cost: niceMoney(2000 + rng.int(0, 3000)) } : null),
    build: (_world, d) => ({
      title: 'Invito a un evento benefico',
      body: `Una fondazione chiede alla squadra di partecipare a una giornata benefica. Costo organizzativo: ${fmtMoney(d.cost)}.`,
      choices: [
        { id: 'partecipa', label: 'Partecipate', hint: 'Reputazione e tifosi in crescita' },
        { id: 'declina', label: 'Declini', hint: 'Nessun effetto' },
      ],
    }),
    resolve: (world, ev, choice) => {
      const club = userClub(world);
      if (choice !== 'partecipa') return 'Invito declinato.';
      expense(club, 'altro', ev.data.cost);
      club.reputation = clamp(club.reputation + 1, 1, 100);
      club.fans = Math.round(club.fans * 1.03);
      return 'Bella figura: la città apprezza.';
    },
  },
  {
    kind: 'summerTournament',
    weight: 5,
    cooldown: 300,
    blocking: false,
    check: (world, rng) => (world.day > 20 && world.day < 80 && rng.chance(0.7) ? { cost: niceMoney(2500 + userClub(world).reputation * 120) } : null),
    build: (_world, d) => ({
      title: 'Invito a un torneo estivo',
      body: `Un torneo internazionale estivo invita la squadra. Trasferta e ospitalità costano ${fmtMoney(d.cost)}.`,
      choices: [
        { id: 'partecipa', label: 'Partecipate', hint: 'Affiatamento e preparazione in crescita, piccolo rischio infortuni' },
        { id: 'declina', label: 'Declini', hint: 'Nessun effetto' },
      ],
    }),
    resolve: (world, ev, choice, rng) => {
      const club = userClub(world);
      if (choice !== 'partecipa') return 'Invito declinato.';
      expense(club, 'trasferte', ev.data.cost);
      club.chemistry = clamp(club.chemistry + 8, 0, 100);
      club.fitnessPrep = clamp(club.fitnessPrep + 8, 0, 100);
      if (rng.chance(0.3)) {
        const p = rng.pick(club.playerIds.map((id) => world.players[id]));
        p.injury = { name: 'Affaticamento muscolare', daysLeft: 6, totalDays: 6 };
        return `Ottimo torneo, ma ${fullName(p)} rientra con un affaticamento.`;
      }
      return 'Il torneo cementa il gruppo.';
    },
  },
  {
    kind: 'legendStaff',
    weight: 2,
    cooldown: 500,
    blocking: false,
    check: (world, rng) => (rng.chance(0.5) ? { rating: rng.int(45, 70) } : null),
    build: (_world, d) => ({
      title: 'Una vecchia gloria si offre come vice',
      body: `Un ex campione del club si propone come vice allenatore (valutazione ${d.rating}) a metà dello stipendio di mercato.`,
      choices: [
        { id: 'accetta', label: 'Lo ingaggi', hint: 'Sostituisce l’attuale vice' },
        { id: 'declina', label: 'Declini', hint: 'Nessun effetto' },
      ],
    }),
    resolve: (world, ev, choice) => {
      const club = userClub(world);
      if (choice !== 'accetta') return 'Proposta declinata.';
      const ctx = ctxOf(world);
      const s = generateStaff(ctx, 'vice', ev.data.rating, club.id);
      s.rating = ev.data.rating;
      s.contract = { wage: niceMoney((s.contract?.wage ?? 2000) * 0.5), endSeason: world.season + 1 };
      world.staff[s.id] = s;
      const old = club.staff.vice ? world.staff[club.staff.vice] : null;
      if (old) { old.clubId = null; old.contract = null; }
      club.staff.vice = s.id;
      return `${s.firstName} ${s.lastName} è il nuovo vice allenatore.`;
    },
  },
  {
    kind: 'energyCrisis',
    weight: 1,
    // Un rincaro dell'energia è un fenomeno raro: una volta ogni qualche stagione.
    cooldown: 1400,
    blocking: true,
    check: (world, rng) => (world.day > 120 && world.day < 250 && rng.chance(0.12) ? { cost: niceMoney(2000 + userClub(world).facilities.piscina.level * 1500) } : null),
    build: (_world, d) => ({
      title: 'Caro energia',
      body: `Le bollette per il riscaldamento della vasca aumentano di ${fmtMoney(d.cost)}.`,
      choices: [
        { id: 'paga', label: 'Paghi l’aumento', hint: `−${fmtMoney(d.cost)}` },
        { id: 'riduci', label: 'Riduci le ore di vasca', hint: 'Allenamento a bassa intensità e affiatamento in calo' },
      ],
    }),
    resolve: (world, ev, choice) => {
      const club = userClub(world);
      if (choice === 'paga') {
        expense(club, 'piscina', ev.data.cost);
        return 'Costi coperti.';
      }
      club.training.intensity = 'bassa';
      club.chemistry = clamp(club.chemistry - 3, 0, 100);
      return 'Allenamenti ridotti: intensità impostata su bassa.';
    },
  },
  {
    kind: 'rivalApproach',
    weight: 4,
    cooldown: 120,
    blocking: true,
    check: (world, rng) => {
      if (!transferWindowOpen(world).open) return null;
      const club = userClub(world);
      const p = topN(club.playerIds.map((id) => world.players[id]).filter((x) => x && !x.wantsToLeave), 3, (x) => x.overall)[rng.int(0, 2)];
      if (!p) return null;
      const rival = Object.values(world.clubs).filter((c) => !c.isUser && c.reputation > club.reputation + 5);
      if (!rival.length) return null;
      return { playerId: p.id, clubId: rng.pick(rival).id };
    },
    build: (world, d) => ({
      title: 'Approccio irregolare',
      body: `${world.clubs[d.clubId].name} ha contattato ${fullName(P(world, d.playerId))} senza passare dalla società.`,
      choices: [
        { id: 'protesta', label: 'Protesti in federazione', hint: 'Forse il rivale verrà multato' },
        { id: 'rinnova', label: 'Gli proponi subito un adeguamento', hint: 'Ingaggio +15%' },
        { id: 'ignora', label: 'Ignori', hint: 'Il giocatore potrebbe chiedere la cessione' },
      ],
    }),
    resolve: (world, ev, choice, rng) => {
      const p = P(world, ev.data.playerId);
      const rival = world.clubs[ev.data.clubId];
      if (!p || p.clubId !== world.userClubId) return 'Il giocatore non è più in rosa.';
      if (choice === 'protesta') {
        if (rng.chance(0.5)) {
          expense(rival, 'altro', 5000);
          return `${rival.name} multato dalla federazione.`;
        }
        p.morale = clamp(p.morale - 3, 0, 100);
        return 'La federazione archivia la segnalazione.';
      }
      if (choice === 'rinnova' && p.contract) {
        p.contract.wage = niceMoney(p.contract.wage * 1.15);
        p.morale = clamp(p.morale + 8, 0, 100);
        return `${fullName(p)} accetta l’adeguamento.`;
      }
      p.morale = clamp(p.morale - 8, 0, 100);
      if (rng.chance(0.35)) p.wantsToLeave = true;
      return p.wantsToLeave ? `${fullName(p)} ora vuole andarsene.` : `${fullName(p)} resta, ma è distratto.`;
    },
  },
  {
    kind: 'anniversary',
    weight: 10,
    cooldown: 400,
    blocking: false,
    check: (world) => {
      const club = userClub(world);
      const years = world.season - club.founded;
      return years > 0 && years % 25 === 0 && world.day < 120 && !world.flags[`anniv-${world.season}`] ? { years } : null;
    },
    build: (_world, d) => ({
      title: `${d.years} anni di storia`,
      body: `Il club compie ${d.years} anni. Organizzare una festa con maglia celebrativa costa ${fmtMoney(6000)}.`,
      choices: [
        { id: 'festa', label: 'Organizzi i festeggiamenti', hint: 'Tifosi e merchandising in crescita' },
        { id: 'sobrio', label: 'Celebrazione sobria', hint: 'Nessun costo' },
      ],
    }),
    resolve: (world, _ev, choice) => {
      const club = userClub(world);
      world.flags[`anniv-${world.season}`] = true;
      if (choice !== 'festa') return 'Una celebrazione semplice ma sentita.';
      expense(club, 'altro', 6000);
      income(club, 'merchandising', 4000 + club.fans * 2);
      club.fans = Math.round(club.fans * 1.1);
      return 'La città festeggia il club: tifosi in aumento.';
    },
  },
];

const BY_KIND = Object.fromEntries(TEMPLATES.map((t) => [t.kind, t]));

/** Controllo settimanale: al massimo un evento casuale. */
export function weeklyEvents(world: World, rng: Rng) {
  if (world.phase !== 'regular') return;
  if (world.events.some((e) => !e.resolved && e.blocking)) return;
  const forced = TEMPLATES.find((t) => t.kind === 'unpaidWages' && ready(world, t) && t.check(world, rng));
  if (!forced && !rng.chance(0.2)) return;
  const candidates = TEMPLATES.filter((t) => ready(world, t));
  rng.shuffle(candidates);
  candidates.sort((a, b) => b.weight * rng.next() - a.weight * rng.next());
  for (const t of forced ? [forced] : candidates) {
    const data = t.check(world, rng);
    if (!data) continue;
    fire(world, t, data);
    return;
  }
}

/** Eventi che impongono una spesa non scelta dal presidente: non devono susseguirsi. */
const FORCED_COST = new Set(['poolBreakdown', 'energyCrisis']);
const FORCED_COST_GAP = 300;

function ready(world: World, t: Template): boolean {
  const now = world.season * 400 + world.day;
  const last = world.eventCooldowns[t.kind];
  if (last != null && now - last < t.cooldown) return false;
  if (FORCED_COST.has(t.kind)) {
    const lastCost = Math.max(...[...FORCED_COST].map((k) => world.eventCooldowns[k] ?? -1e9));
    if (now - lastCost < FORCED_COST_GAP) return false;
  }
  return true;
}

function fire(world: World, t: Template, data: Record<string, any>) {
  const b = t.build(world, data);
  const ev: GameEvent = {
    id: newId(world, 'e'), kind: t.kind, title: b.title, body: b.body, day: world.day, season: world.season, choices: b.choices,
    resolved: false, data, blocking: t.blocking, expiresDay: t.blocking ? undefined : world.day + 10,
  };
  world.events.unshift(ev);
  if (world.events.length > 120) world.events.length = 120;
  world.eventCooldowns[t.kind] = world.season * 400 + world.day;
  addMessage(world, 'evento', b.title, b.body, { eventId: ev.id, important: true });
}

export function triggerEvent(world: World, kind: string, data: Record<string, any>) {
  const t = BY_KIND[kind];
  if (t) fire(world, t, data);
}

export function resolveEvent(world: World, eventId: string, choiceId: string, rng: Rng): string {
  const ev = world.events.find((e) => e.id === eventId);
  if (!ev || ev.resolved) return 'Decisione già presa.';
  const choice = ev.choices.find((c) => c.id === choiceId);
  if (!choice || choice.disabled) return 'Scelta non disponibile.';
  let outcome: string;
  if (ev.kind === 'objective') outcome = resolveObjective(world, ev, choiceId);
  else if (ev.kind === 'youthTalent') outcome = resolveYouthTalent(world, ev, choiceId);
  else outcome = BY_KIND[ev.kind]?.resolve(world, ev, choiceId, rng) ?? 'Nessun effetto.';
  ev.resolved = true;
  ev.chosen = choiceId;
  ev.outcome = outcome;
  const msg = world.inbox.find((m) => m.eventId === ev.id);
  if (msg) msg.read = true;
  return outcome;
}

/** Eventi non bloccanti scaduti: si applica la prima scelta "neutra" (l'ultima della lista). */
export function expireEvents(world: World, rng: Rng) {
  for (const ev of world.events) {
    if (!ev.resolved && ev.expiresDay != null && ev.expiresDay < world.day) {
      const last = ev.choices[ev.choices.length - 1];
      resolveEvent(world, ev.id, last.id, rng);
    }
  }
}

/** Promesse fatte ai giocatori: verifica alla scadenza. */
export function checkPromises(world: World) {
  const club = userClub(world);
  for (const id of club.playerIds) {
    const p = world.players[id];
    if (!p?.promise) continue;
    if (p.promise.season !== world.season && p.promise.untilDay > 365) continue;
    if (world.day < p.promise.untilDay && p.promise.season === world.season) {
      if (p.promise.kind === 'playingTime' && p.playingTime >= 0.45) {
        p.promise = undefined;
        p.morale = clamp(p.morale + 6, 0, 100);
      }
      continue;
    }
    let kept = false;
    if (p.promise.kind === 'playingTime') kept = p.playingTime >= 0.4;
    if (p.promise.kind === 'strengthen') {
      const lvl = (p as any).promiseLevel ?? p.overall - 5;
      kept = world.transfers.some((t) => t.toId === club.id && t.season === world.season && t.overall >= lvl && t.playerId !== p.id);
    }
    p.promise = undefined;
    if (kept) {
      p.morale = clamp(p.morale + 10, 0, 100);
      addMessage(world, 'societa', `${fullName(p)} apprezza la promessa mantenuta`, 'Il giocatore è soddisfatto della parola del presidente.');
    } else {
      p.morale = clamp(p.morale - 25, 0, 100);
      p.wantsToLeave = true;
      club.chemistry = clamp(club.chemistry - 4, 0, 100);
      addMessage(world, 'societa', `Promessa non mantenuta: ${fullName(p)}`, 'Il giocatore si sente tradito e chiede la cessione.', { important: true, link: { view: 'player', id: p.id } });
    }
  }
}

// ─── Eventi speciali (non casuali) ──────────────────────────────────────────

export function objectiveEvent(world: World) {
  const club = userClub(world);
  const suggested = suggestedObjectives(world, club);
  const all: ObjectiveKind[] = club.division === 'A1'
    ? ['titolo', 'europa', 'top4', 'metaClassifica', 'salvezza']
    : ['promozione', 'playoff', 'metaClassifica', 'salvezza'];
  const opts = all.filter((o, i) => suggested.includes(o) || i >= all.length - 3 || o === suggested[0]);
  const ev: GameEvent = {
    id: newId(world, 'e'), kind: 'objective', title: `Obiettivo della stagione ${world.season}/${(world.season + 1) % 100}`,
    body: 'Annuncia a tifosi e stampa l’obiettivo stagionale. Un obiettivo ambizioso fa crescere abbonamenti e attese; mancarlo costa reputazione e tifosi.',
    day: world.day, season: world.season, resolved: false, blocking: true, data: {},
    choices: opts.map((o) => ({
      id: o,
      label: OBJECTIVE_LABELS[o],
      hint: o === suggested[0] ? 'Il più ambizioso alla tua portata secondo i tecnici' : !suggested.includes(o) ? 'Molto rischioso: tifosi entusiasti, ma delusione se fallisci' : undefined,
    })),
  };
  world.events.unshift(ev);
  addMessage(world, 'societa', ev.title, ev.body, { eventId: ev.id, important: true });
}

function resolveObjective(world: World, _ev: GameEvent, choice: string): string {
  const club = userClub(world);
  club.objective = choice as ObjectiveKind;
  return `Obiettivo dichiarato: ${OBJECTIVE_LABELS[club.objective].toLowerCase()}.`;
}

export function youthTalentEvent(world: World, p: Player) {
  const ev: GameEvent = {
    id: newId(world, 'e'), kind: 'youthTalent', title: 'Talento nel settore giovanile',
    body: `${fullName(p)}, ${ageOf(p, world.season)} anni (${p.role}), ha un potenziale eccezionale secondo i tecnici delle giovanili.`,
    day: world.day, season: world.season, resolved: false, blocking: true, data: { playerId: p.id },
    choices: [
      { id: 'contratto', label: 'Lo porti subito in prima squadra', hint: 'Contratto professionistico e minuti con i grandi' },
      { id: 'tieni', label: 'Lo lasci crescere nelle giovanili', hint: 'Crescita più protetta' },
      { id: 'vetrina', label: 'Lo segnali ai club più grandi', hint: 'Potrebbero arrivare offerte importanti' },
    ],
  };
  world.events.unshift(ev);
  addMessage(world, 'giovani', ev.title, ev.body, { eventId: ev.id, important: true, link: { view: 'player', id: p.id } });
}

function resolveYouthTalent(world: World, ev: GameEvent, choice: string): string {
  const club = userClub(world);
  const p = P(world, ev.data.playerId);
  if (!p || p.clubId !== club.id) return 'Il ragazzo non è più al club.';
  if (choice === 'contratto') {
    const err = promoteYouth(world, club, p);
    if (err) return `${err} ${fullName(p)} resta per ora nel settore giovanile.`;
    return `${fullName(p)} entra in prima squadra.`;
  }
  if (choice === 'vetrina') {
    p.transferListed = true;
    return `${fullName(p)} è stato segnalato: valuta le offerte che arriveranno.`;
  }
  p.morale = clamp(p.morale + 5, 0, 100);
  return `${fullName(p)} continuerà a crescere nel vivaio.`;
}

export function pendingBlockingEvents(world: World): GameEvent[] {
  return world.events.filter((e) => !e.resolved && e.blocking);
}

export { leagueComp, positionOf };
