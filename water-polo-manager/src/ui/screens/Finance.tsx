import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Badge, Button, Field, Kv, PageHeader, Panel, Stat } from '../components/ui';
import { HBars, LineChart } from '../components/charts';
import { EXPENSE_LABELS, INCOME_LABELS, ledgerTotals, totalDebt } from '../../engine/economy/ledger';
import { financialHealth, loanRate, maxLoan, overdraftLimit, presidentInvest, projectSeason, repayLoan, takeLoan } from '../../engine/economy/finance';
import { setTicketPrices } from '../../engine/club/manage';
import type { ExpenseCat, IncomeCat } from '../../engine/types';
import { fmtMoney, seasonLabel } from '../format';

export function FinanceScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const f = club.finances;
  const led = ledgerTotals(f.ledger);
  const proj = projectSeason(world, club);
  const health = financialHealth(world, club);
  const [loanAmt, setLoanAmt] = useState(Math.min(20000, maxLoan(club)));
  const [loanYears, setLoanYears] = useState(3);
  const [invest, setInvest] = useState(10000);
  const [ticket, setTicket] = useState(f.ticketPrice);
  const [stPrice, setStPrice] = useState(f.seasonTicketPrice);
  const incomeItems = (Object.keys(f.ledger.income) as IncomeCat[]).map((k) => ({ label: INCOME_LABELS[k], value: f.ledger.income[k], color: '#22c55e' })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const expenseItems = (Object.keys(f.ledger.expense) as ExpenseCat[]).map((k) => ({ label: EXPENSE_LABELS[k], value: f.ledger.expense[k], color: '#ef4444' })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div className="space-y-5">
      <PageHeader title="Finanze" subtitle={`Stagione ${seasonLabel(world.season)}`} actions={<Badge tone={health.level === 'ok' ? 'good' : health.level === 'warn' ? 'warn' : 'bad'}>{health.label}</Badge>} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Saldo in banca" value={fmtMoney(f.balance)} tone={f.balance < 0 ? 'bad' : 'good'} />
        <Stat label="Entrate stagione" value={fmtMoney(led.income)} tone="good" />
        <Stat label="Uscite stagione" value={fmtMoney(led.expense)} tone="bad" />
        <Stat label="Debiti" value={fmtMoney(totalDebt(club))} sub={`Fido bancario ${fmtMoney(overdraftLimit(club))}`} tone={totalDebt(club) > 0 ? 'warn' : undefined} />
        <Stat label="Proiezione annua" value={fmtMoney(proj.net)} tone={proj.net < 0 ? 'bad' : 'good'} sub="entrate − uscite previste" />
      </div>
      {f.unpaidWeeks > 0 && (
        <Panel className="border-bad/50">
          <p className="text-bad text-sm font-semibold">Stipendi non pagati da {f.unpaidWeeks} settimane ({fmtMoney(f.arrears)} di arretrati).</p>
          <p className="text-xs text-mute mt-1">Dopo 6 settimane i giocatori possono andarsene a parametro zero, dopo 8 arrivano penalizzazioni in classifica, dopo 16 il fallimento. Vendi giocatori, chiedi un prestito o investi il tuo patrimonio.</p>
        </Panel>
      )}
      <Panel title="Andamento del saldo (settimane)">
        <LineChart values={f.weeklyBalance} />
      </Panel>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Entrate della stagione"><HBars items={incomeItems.length ? incomeItems : [{ label: 'Nessuna entrata ancora', value: 0 }]} /></Panel>
        <Panel title="Uscite della stagione"><HBars items={expenseItems.length ? expenseItems : [{ label: 'Nessuna uscita ancora', value: 0 }]} /></Panel>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Proiezione annuale" subtitle="Stima sulla base di rosa, sponsor e strutture attuali.">
          {proj.income.map((x) => <Kv key={x.label} k={x.label} v={<span className="text-good">{fmtMoney(x.value)}</span>} />)}
          {proj.expense.map((x) => <Kv key={x.label} k={x.label} v={<span className="text-bad">{x.value ? '−' : ''}{fmtMoney(x.value)}</span>} />)}
          <Kv k={<b>Risultato previsto</b>} v={<b className={proj.net < 0 ? 'text-bad' : 'text-good'}>{fmtMoney(proj.net)}</b>} />
          <p className="text-[11px] text-faint mt-2">Non comprende premi, cessioni, acquisti, lavori e incassi di coppa.</p>
        </Panel>
        <Panel title="Prestiti bancari">
          {f.loans.map((l) => (
            <div key={l.id} className="panel-flat p-2.5 mb-2 text-sm">
              <div className="flex justify-between"><span>Prestito {fmtMoney(l.principal)}</span><span className="text-mute">tasso {(l.rate * 100).toFixed(1)}%</span></div>
              <div className="flex justify-between text-xs text-mute mt-1"><span>Residuo {fmtMoney(l.remaining)} · rata {fmtMoney(l.weeklyPayment)}/sett.</span>
                <Button size="sm" variant="ghost" onClick={() => s.act((w) => repayLoan(w.clubs[w.userClubId], l.id), 'Prestito estinto.')}>Estingui</Button></div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Field label="Importo (€)" hint={`Massimo ${fmtMoney(maxLoan(club))}`}><input type="number" className="w-full" value={loanAmt} step={5000} onChange={(e) => setLoanAmt(Number(e.target.value))} /></Field>
            <Field label="Durata"><select className="w-full" value={loanYears} onChange={(e) => setLoanYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} anni</option>)}</select></Field>
          </div>
          <p className="text-xs text-mute mt-2">Tasso annuo {(loanRate(club) * 100).toFixed(1)}% · totale da restituire {fmtMoney(Math.round(loanAmt * (1 + loanRate(club) * loanYears)))}</p>
          <Button className="mt-2" onClick={() => s.act((w) => takeLoan(w, w.clubs[w.userClubId], loanAmt, loanYears), 'Prestito ottenuto.')}>Chiedi il prestito</Button>
        </Panel>
        <Panel title="Il presidente" subtitle="Puoi investire il tuo patrimonio personale nella società (non è rimborsabile).">
          <Kv k="Patrimonio personale" v={fmtMoney(world.presidentWealth)} />
          <Field label="Investimento (€)"><input type="number" className="w-full" value={invest} step={5000} onChange={(e) => setInvest(Number(e.target.value))} /></Field>
          <Button className="mt-2" variant="gold" disabled={world.presidentWealth <= 0} onClick={() => s.act((w) => presidentInvest(w, invest), 'Investimento effettuato.')}>Investi nella società</Button>
          <div className="border-t border-line mt-4 pt-3">
            <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-2">Prezzi</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Biglietto (€)"><input type="number" className="w-full" value={ticket} min={1} onChange={(e) => setTicket(Number(e.target.value))} /></Field>
              <Field label="Abbonamento (€)"><input type="number" className="w-full" value={stPrice} min={5} onChange={(e) => setStPrice(Number(e.target.value))} /></Field>
            </div>
            <p className="text-[11px] text-faint mt-1">Prezzi alti = più incasso per spettatore ma meno pubblico. La campagna abbonamenti parte il 1° settembre.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => s.act((w) => setTicketPrices(w.clubs[w.userClubId], ticket, stPrice), 'Prezzi aggiornati.')}>Applica prezzi</Button>
          </div>
        </Panel>
      </div>
      {f.pastLedgers.length > 0 && (
        <Panel title="Bilanci delle stagioni precedenti">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase text-faint"><th className="text-left py-1">Stagione</th><th>Entrate</th><th>Uscite</th><th>Risultato</th></tr></thead>
              <tbody>
                {[...f.pastLedgers].reverse().map((l) => { const t = ledgerTotals(l); return (
                  <tr key={l.season} className="border-t border-line/40 text-center"><td className="text-left py-1.5">{seasonLabel(l.season)}</td><td className="text-good num">{fmtMoney(t.income)}</td><td className="text-bad num">{fmtMoney(t.expense)}</td><td className={`num font-semibold ${t.net < 0 ? 'text-bad' : 'text-good'}`}>{fmtMoney(t.net)}</td></tr>
                ); })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
