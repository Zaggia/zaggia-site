// Cronaca testuale in italiano generata dagli eventi strutturati della partita.

import type { MatchEvent } from '../types';

export interface NameBook {
  team: [string, string];
  player: (id?: string) => string;
  /** Lato dell'utente (per "la tua squadra"), -1 se nessuno. */
  userSide: number;
}

const SHOT_DESC: Record<string, string[]> = {
  distanza: ['con un siluro dalla distanza', 'con una sassata dai sette metri', 'dal perimetro, sotto la traversa', 'con un tiro potente dalla distanza'],
  centro: ['dai due metri, girandosi sul difensore', 'dal centro, con una beduina', 'con una sciarpa dal centro', 'spalle alla porta, con un colpo di forza'],
  ala: ['dall’ala, sul palo lungo', 'con un tiro angolato dall’ala', 'in diagonale dalla posizione 1', 'con un pallonetto dall’ala'],
  penetrazione: ['dopo una penetrazione centrale', 'dopo aver bruciato il marcatore', 'con un tiro a palla alzata dopo l’affondo', 'in controtempo dopo la finta'],
  controfuga: ['in controfuga, solo davanti al portiere', 'a conclusione di un contropiede fulmineo', 'chiudendo la ripartenza'],
  superiorita: ['in superiorità numerica', 'sfruttando l’uomo in più', 'con il 6 contro 5 ben costruito', 'sul secondo palo in superiorità'],
  rigore: ['su rigore', 'dai cinque metri, spiazzando il portiere'],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function clockLabel(e: MatchEvent): string {
  const m = Math.floor(e.clock / 60);
  const s = e.clock % 60;
  return `${e.period}° TEMPO — ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function teamRef(nb: NameBook, side: number, cap = false): string {
  if (side === nb.userSide) return cap ? 'La tua squadra' : 'la tua squadra';
  return nb.team[side] ?? '';
}

/** Testo della cronaca per un evento (null se l'evento non va mostrato). */
export function describe(e: MatchEvent, nb: NameBook, idx: number): { title?: string; text: string } | null {
  const p1 = nb.player(e.p1);
  const p2 = nb.player(e.p2);
  const side = e.side;
  const other = side === 0 ? 1 : 0;
  switch (e.type) {
    case 'start':
      return { title: 'Si comincia', text: `${nb.team[0]} contro ${nb.team[1]}: le squadre sono in acqua.` };
    case 'kickoff':
      return null;
    case 'sprint':
      return { text: `Sprint vinto da ${p1}: possesso per ${teamRef(nb, side)}.` };
    case 'period_start':
      return { title: `${e.period}° tempo`, text: `Inizia il ${e.period}° tempo.` };
    case 'period_end':
      return { title: `Fine ${e.period}° tempo`, text: `${nb.team[0]} ${e.score?.[0]} – ${e.score?.[1]} ${nb.team[1]}` };
    case 'end':
      return { title: 'Fine partita', text: `Risultato finale: ${nb.team[0]} ${e.score?.[0]} – ${e.score?.[1]} ${nb.team[1]}.` };
    case 'steal':
      return {
        text: pick([
          `${teamRef(nb, side, true)} recupera il pallone a metà vasca: anticipo di ${p1}.`,
          `${p1} ruba palla a ${p2}!`,
          `Palla rubata da ${p1}, si riparte.`,
        ], idx),
      };
    case 'turnover':
      if (e.kind === 'shotclock') return { text: `Scade il tempo dell’azione per ${teamRef(nb, side)}.` };
      if (e.kind === 'foul') return { text: `Fallo in attacco di ${p1}: palla agli avversari.` };
      return { text: pick([`Passaggio sbagliato di ${p1}.`, `${p1} perde il pallone.`, `Errore tecnico di ${p1}.`], idx) };
    case 'exclusion':
      return {
        title: 'Espulsione temporanea',
        text: `Espulsione temporanea per ${p1} (${teamRef(nb, other)})${p2 ? `, guadagnata da ${p2}` : ''}.`,
      };
    case 'manup':
      return { title: 'SUPERIORITÀ NUMERICA!', text: `${teamRef(nb, side, true)} organizza l’attacco con l’uomo in più.` };
    case 'double_manup':
      return { title: 'Doppia superiorità!', text: `Un’altra espulsione: ${teamRef(nb, side)} attacca sei contro quattro.` };
    case 'manup_lost':
      return { text: `Superiorità sprecata: ${p1} perde palla.` };
    case 'counter':
      return { title: 'Contropiede!', text: e.kind === '1v0' ? `${p1} scappa da solo verso la porta!` : `${p1} guida la ripartenza in superiorità.` };
    case 'shot_saved':
      return { title: 'PARATA DEL PORTIERE!', text: pick([`${p2} respinge il tiro di ${p1}.`, `Gran riflesso di ${p2} su ${p1}.`, `${p2} dice di no a ${p1}.`], idx) };
    case 'shot_blocked':
      return { text: `Tiro di ${p1} murato da ${p2}.` };
    case 'shot_missed':
      return { text: pick([`${p1} tira fuori.`, `Conclusione di ${p1} sul palo esterno.`, `${p1} spara alto sopra la traversa.`, `Il tiro di ${p1} si stampa sul palo!`], idx) };
    case 'goal': {
      const how = pick(SHOT_DESC[e.kind ?? 'distanza'] ?? SHOT_DESC.distanza, idx);
      const assist = p2 ? ` Assist di ${p2}.` : '';
      return {
        title: side === nb.userSide ? 'GOOOOOOL!' : `Gol ${nb.team[side === 1 ? 1 : 0]}`,
        text: `${p1} segna ${how}.${assist} (${e.score?.[0]}–${e.score?.[1]})`,
      };
    }
    case 'penalty':
      return { title: 'Rigore!', text: `Fallo di ${p1} in area: rigore per ${teamRef(nb, side)}.` };
    case 'fouled_out':
      return { title: 'Espulso definitivamente', text: `${p1} commette il terzo fallo grave ed esce dalla partita.` };
    case 'red':
      return { title: 'Cartellino rosso', text: `${p1} espulso per brutalità: rischia una lunga squalifica.` };
    case 'injury':
      return { title: 'Infortunio', text: `${p1} si fa male e deve lasciare la vasca.` };
    case 'sub':
      return { text: e.kind === 'forced' ? `Cambio obbligato: entra ${p1} al posto di ${p2}.` : `Cambio per ${teamRef(nb, side)}: entra ${p1}${p2 ? `, esce ${p2}` : ''}.` };
    case 'timeout':
      return { title: 'Time-out', text: side === nb.userSide ? 'Time-out chiamato dalla tua panchina.' : `Time-out chiamato da ${nb.team[side === 1 ? 1 : 0]}.` };
    case 'tactic':
      return { title: 'Cambio tattico', text: `${teamRef(nb, side, true)} passa a: ${e.text}.` };
    case 'shootout_start':
      return { title: 'Rigori!', text: 'Parità: si va ai tiri di rigore.' };
    case 'shootout_goal':
      return { text: `${p1} segna il rigore (${e.score?.[0]}–${e.score?.[1]}).` };
    case 'shootout_miss':
      return { text: `${p1} sbaglia il rigore! (${e.score?.[0]}–${e.score?.[1]})` };
    default:
      return null;
  }
}
