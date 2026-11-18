// Finestre di trattativa: offerta al club proprietario e contratto con il giocatore.

import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import type { Player, SquadStatus, TransferOffer } from '../../engine/types';
import { Badge, Button, Field, Modal } from './ui';
import { fmtMoney } from '../format';
import { STATUS_LABELS, defaultYears, interestIn, negotiate, signContract, suggestedStatus, wageDemand } from '../../engine/transfer/contracts';
import { askingPrice, finalizeUserSigning, signFreeAgent, userBid, transferWindowOpen } from '../../engine/transfer/market';
import { niceMoney } from '../../engine/util';
import { rosterFullError } from '../../engine/club/roster';

type Mode = 'renewal' | 'free' | 'transfer';

/** Trattativa contrattuale con il giocatore (rinnovo, svincolato o dopo l'accordo con il club). */
export function ContractModal({ player, mode, offer, onClose }: { player: Player; mode: Mode; offer?: TransferOffer; onClose: () => void }) {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const [status, setStatus] = useState<SquadStatus>(() => (mode === 'renewal' && player.contract ? player.contract.status : suggestedStatus(world, player, club)));
  const [years, setYears] = useState(() => (mode === 'renewal' ? defaultYears(player, world.season + 1) : defaultYears(player, world.season)));
  const demand = wageDemand(world, player, club, status, years);
  const [wage, setWage] = useState(() => niceMoney(demand * 0.9));
  const [log, setLog] = useState<{ who: 'tu' | 'lui'; text: string }[]>([]);
  const [done, setDone] = useState(false);
  const [last, setLast] = useState<{ wage: number; years: number; roundsLeft: number; mood?: string } | null>(null);
  const interest = interestIn(world, player, club);
  const full = mode !== 'renewal' ? rosterFullError(world, club) : null;
  const send = (override?: { wage: number; years: number }) => {
    if (full) { s.toast(full, 'err'); return; }
    const w = override?.wage ?? wage;
    const y = override?.years ?? years;
    const res = negotiate(world, player, club, { wage: w, years: y, status });
    const entries: { who: 'tu' | 'lui'; text: string }[] = [
      { who: 'tu', text: `${fmtMoney(w)} l’anno per ${y} ${y === 1 ? 'stagione' : 'stagioni'}, ruolo: ${STATUS_LABELS[status].toLowerCase()}.` },
      { who: 'lui', text: res.message },
    ];
    setLog([...log, ...entries]);
    if (res.result === 'accept') {
      setLast(null);
      if (mode === 'renewal') {
        signContract(world, player, club, { wage: w, years: y, status });
        s.toast(`${player.lastName} ha rinnovato fino al ${world.season + y + (world.day > 300 ? 1 : 0)}.`, 'ok');
      } else if (mode === 'free') {
        const err = signFreeAgent(world, player, club, { wage: w, years: y, status });
        if (err) s.toast(err, 'err');
        else s.toast(`${player.firstName} ${player.lastName} è un nuovo giocatore del club!`, 'ok');
      } else if (offer) {
        const err = finalizeUserSigning(world, offer.id, { wage: w, years: y, status });
        if (err) s.toast(err, 'err');
        else s.toast(`Colpo di mercato: ${player.firstName} ${player.lastName} firma!`, 'ok');
      }
      setDone(true);
      s.touch();
    } else if (res.result === 'counter' && res.demand) {
      setWage(res.demand.wage);
      setYears(res.demand.years);
      setLast({ wage: res.demand.wage, years: res.demand.years, roundsLeft: res.roundsLeft ?? 0, mood: res.mood });
      s.touch();
    } else {
      setLast(res.demand ? { wage: res.demand.wage, years: res.demand.years, roundsLeft: res.roundsLeft ?? 0, mood: res.mood } : null);
      if (res.roundsLeft === 0) setDone(true);
      s.touch();
    }
  };
  const title = mode === 'renewal' ? `Rinnovo: ${player.firstName} ${player.lastName}` : `Contratto: ${player.firstName} ${player.lastName}`;
  return (
    <Modal open onClose={onClose} title={title}
      footer={done ? <Button onClick={onClose}>Chiudi</Button> : <>
        <Button variant="ghost" onClick={onClose}>Abbandona</Button>
        {last && <Button variant="gold" onClick={() => send({ wage: last.wage, years: last.years })} disabled={!!full} title="Accetti le sue condizioni">Accetta {fmtMoney(last.wage)}</Button>}
        <Button onClick={() => send()} disabled={!!full}>{last ? 'Rilancia' : 'Invia proposta'}</Button>
      </>}>
      <div className="space-y-4">
        {full && <p className="text-warn text-sm">{full}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone={interest.value >= 60 ? 'good' : interest.value >= 35 ? 'warn' : 'bad'}>Interesse {interest.value}%</Badge>
          <Badge>Overall {player.overall}</Badge>
          {player.contract && <Badge>Ingaggio attuale {fmtMoney(player.contract.wage)}</Badge>}
          <Badge tone="aqua">Richiesta indicativa ~{fmtMoney(demand)}</Badge>
          {last && last.roundsLeft > 0 && <Badge tone={last.roundsLeft <= 1 ? 'warn' : 'neutral'}>{last.roundsLeft === 1 ? 'Ultimo giro' : `${last.roundsLeft} giri di trattativa`}</Badge>}
          {last?.mood && <Badge tone={last.mood === 'quasi' || last.mood === 'vicino' ? 'good' : last.mood === 'offeso' ? 'bad' : 'warn'}>{last.mood === 'quasi' ? 'Vicinissimi' : last.mood === 'vicino' ? 'Ci siamo quasi' : last.mood === 'offeso' ? 'Offeso' : 'Distanti'}</Badge>}
        </div>
        <p className="text-sm text-mute">{interest.reason}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Ingaggio annuo (€)">
            <input type="number" className="w-full num" value={wage} step={250} min={300} onChange={(e) => setWage(Math.max(0, Number(e.target.value)))} disabled={done} />
          </Field>
          <Field label="Durata (stagioni)">
            <select className="w-full" value={years} onChange={(e) => setYears(Number(e.target.value))} disabled={done}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Ruolo promesso">
            <select className="w-full" value={status} onChange={(e) => setStatus(e.target.value as SquadStatus)} disabled={done}>
              {(Object.keys(STATUS_LABELS) as SquadStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-[11px] text-faint">Parte da una richiesta alta e scende giro dopo giro: offrire poco non conviene sempre, perché un’offerta offensiva lo irrita e può far saltare l’accordo. Promettere un ruolo importante crea aspettative di minutaggio.</p>
        {log.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className={l.who === 'tu' ? 'text-right' : ''}>
                <span className={`inline-block rounded-xl px-3 py-2 text-sm ${l.who === 'tu' ? 'bg-aqua/15 text-aqua' : 'bg-white/[0.06]'}`}>{l.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Offerta al club proprietario del giocatore (trasferimento o prestito). */
export function BidModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const world = useWorld();
  const s = useGame.getState();
  const owner = player.clubId ? world.clubs[player.clubId] : null;
  const ask = askingPrice(world, player);
  const [loan, setLoan] = useState(false);
  const [fee, setFee] = useState(() => niceMoney(ask * 0.85));
  const [result, setResult] = useState<{ text: string; offer?: TransferOffer; counter?: number; roundsLeft?: number } | null>(null);
  const [history, setHistory] = useState<{ who: 'tu' | 'lui'; text: string }[]>([]);
  const [contract, setContract] = useState<TransferOffer | null>(null);
  const window = transferWindowOpen(world);
  const full = rosterFullError(world, world.clubs[world.userClubId]);
  const send = (override?: number) => {
    const amount = override ?? fee;
    const r = userBid(world, player.id, loan ? 0 : amount, loan);
    s.touch();
    if ('error' in r) {
      setResult({ text: r.error });
      return;
    }
    setHistory((h) => [...h, { who: 'tu', text: loan ? 'Chiedi il giocatore in prestito.' : `Offri ${fmtMoney(amount)}.` }, { who: 'lui', text: r.response.message }]);
    setResult({ text: r.response.message, offer: r.offer, counter: r.response.counterFee, roundsLeft: (r.response as { roundsLeft?: number }).roundsLeft });
    if (r.response.result === 'counter' && r.response.counterFee) setFee(r.response.counterFee);
  };
  if (contract) return <ContractModal player={player} mode="transfer" offer={contract} onClose={onClose} />;
  return (
    <Modal open onClose={onClose} title={`Offerta per ${player.firstName} ${player.lastName}`}
      footer={<><Button variant="ghost" onClick={onClose}>Chiudi</Button>
        {result?.offer?.status === 'accepted'
          ? <Button variant="gold" onClick={() => setContract(result.offer!)}>Tratta l’ingaggio</Button>
          : <>
            {result?.counter && !loan && <Button variant="gold" onClick={() => send(result.counter)} disabled={!window.open || !!full}>Accetta {fmtMoney(result.counter)}</Button>}
            <Button onClick={() => send()} disabled={!window.open || !!full || result?.roundsLeft === 0 && result?.offer?.status === 'rejected'}>{result?.counter ? 'Rilancia' : 'Invia offerta'}</Button>
          </>}</>}>
      <div className="space-y-4">
        <div className="text-sm text-mute">
          {owner?.name} apre la trattativa a circa <span className="text-ink font-semibold">{fmtMoney(ask)}</span>. Valore di mercato {fmtMoney(player.value)}.
          Liquidità disponibile: <span className="text-ink font-semibold">{fmtMoney(world.clubs[world.userClubId].finances.balance)}</span>.
        </div>
        {!window.open && <p className="text-warn text-sm">Il mercato è chiuso: si riapre con la prossima finestra.</p>}
        {full && <p className="text-warn text-sm">{full}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant={!loan ? 'primary' : 'outline'} onClick={() => setLoan(false)}>Acquisto</Button>
          <Button size="sm" variant={loan ? 'primary' : 'outline'} onClick={() => setLoan(true)}>Prestito (fino a fine stagione)</Button>
        </div>
        {!loan ? (
          <Field label="Cifra offerta (€)">
            <input type="number" className="w-full num" value={fee} step={500} min={0} onChange={(e) => setFee(Math.max(0, Number(e.target.value)))} />
          </Field>
        ) : (
          <p className="text-sm text-mute">In prestito paghi il 70% dell’ingaggio. I club cedono in prestito solo giovani (fino a 23 anni) che non sono titolari.</p>
        )}
        {history.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {history.map((l, i) => (
              <div key={i} className={l.who === 'tu' ? 'text-right' : ''}>
                <span className={`inline-block rounded-xl px-3 py-2 text-sm ${l.who === 'tu' ? 'bg-aqua/15 text-aqua' : 'bg-white/[0.06]'}`}>{l.text}</span>
              </div>
            ))}
          </div>
        )}
        {result?.offer?.status === 'accepted' && <div className="text-good text-sm">Accordo con il club! Ora trova l’intesa economica con il giocatore.</div>}
        {result && result.roundsLeft != null && result.roundsLeft > 0 && result.offer?.status !== 'accepted' && (
          <p className="text-[11px] text-faint">{result.roundsLeft === 1 ? 'Ultimo giro: il club chiude se non ci si avvicina.' : `${result.roundsLeft} giri di trattativa ancora disponibili.`} La richiesta scende a ogni giro, ma un’offerta troppo bassa irrita il club.</p>
        )}
      </div>
    </Modal>
  );
}
