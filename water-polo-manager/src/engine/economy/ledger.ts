import type { Club, ExpenseCat, Finances, IncomeCat, SeasonLedger } from '../types';

export const INCOME_LABELS: Record<IncomeCat, string> = {
  sponsor: 'Sponsor',
  biglietti: 'Biglietteria',
  abbonamenti: 'Abbonamenti',
  merchandising: 'Merchandising',
  attivita: 'Scuola nuoto e attività di base',
  premi: 'Premi sportivi',
  contributi: 'Contributi',
  investimenti: 'Investimenti',
  cessioni: 'Cessioni giocatori',
  altro: 'Altro',
};

export const EXPENSE_LABELS: Record<ExpenseCat, string> = {
  stipendi: 'Stipendi giocatori',
  acquisti: 'Acquisti giocatori',
  staff: 'Staff tecnico',
  piscina: 'Gestione piscina',
  trasferte: 'Trasferte',
  giovanili: 'Settore giovanile',
  manutenzione: 'Manutenzione strutture',
  amministrazione: 'Costi amministrativi',
  interessi: 'Interessi e rate',
  strutture: 'Lavori alle strutture',
  altro: 'Altro',
};

export function emptyLedger(season: number): SeasonLedger {
  return {
    season,
    income: { sponsor: 0, biglietti: 0, abbonamenti: 0, merchandising: 0, attivita: 0, premi: 0, contributi: 0, investimenti: 0, cessioni: 0, altro: 0 },
    expense: { stipendi: 0, acquisti: 0, staff: 0, piscina: 0, trasferte: 0, giovanili: 0, manutenzione: 0, amministrazione: 0, interessi: 0, strutture: 0, altro: 0 },
  };
}

export function newFinances(season: number, balance: number, ticketPrice: number): Finances {
  return {
    balance: Math.round(balance),
    transferBudget: 0,
    wageBudget: 0,
    loans: [],
    ledger: emptyLedger(season),
    pastLedgers: [],
    weeklyBalance: [Math.round(balance)],
    unpaidWeeks: 0,
    arrears: 0,
    ticketPrice,
    seasonTicketPrice: ticketPrice * 8,
  };
}

export function income(club: Club, cat: IncomeCat, amount: number) {
  if (!amount) return;
  const v = Math.round(amount);
  club.finances.balance += v;
  club.finances.ledger.income[cat] += v;
}

export function expense(club: Club, cat: ExpenseCat, amount: number) {
  if (!amount) return;
  const v = Math.round(amount);
  club.finances.balance -= v;
  club.finances.ledger.expense[cat] += v;
}

export function ledgerTotals(l: SeasonLedger) {
  const inc = Object.values(l.income).reduce((a, b) => a + b, 0);
  const exp = Object.values(l.expense).reduce((a, b) => a + b, 0);
  return { income: inc, expense: exp, net: inc - exp };
}

export function totalDebt(club: Club): number {
  return Math.max(0, -club.finances.balance) + club.finances.loans.reduce((a, l) => a + l.remaining, 0);
}
