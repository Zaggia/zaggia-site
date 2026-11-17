import { ART } from '../art';
import { useEffect, useMemo, useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { ArtBanner, Badge, Button, DataTable, Empty, Field, Modal, Panel, Tabs } from '../components/ui';
import { ClubName, PlayerName, PlayerTable } from '../components/game';
import { ContractModal } from '../components/Negotiation';
import { ROLES, ROLE_LABELS } from '../../engine/player/attributes';
import { ageOf } from '../../engine/player/value';
import { overallRange, potentialRange } from '../../engine/world/queries';
import { respondToIncoming, transferWindowOpen } from '../../engine/transfer/market';
import type { Player, Role, TransferOffer, TransferRecord } from '../../engine/types';
import { fmtMoney, formatShortDate, seasonLabel } from '../format';

type Tab = 'cerca' | 'osservati' | 'offerte' | 'contratti' | 'movimenti';

export function MarketScreen() {
  const world = useWorld();
  const param = useGame((s) => s.param);
  const tab = useGame((s) => s.market.tab) as Tab;
  const setMarket = useGame((s) => s.setMarket);
  const setTab = (t: Tab) => setMarket({ tab: t });
  useEffect(() => { if (param === 'offerte') setMarket({ tab: 'offerte' }); }, [param, setMarket]);
  const win = transferWindowOpen(world);
  const club = world.clubs[world.userClubId];
  const incoming = world.offers.filter((o) => !o.byUser && o.status === 'pending');
  const outgoing = world.offers.filter((o) => o.byUser);
  const expiring = club.playerIds.map((id) => world.players[id]).filter((p) => p?.contract && p.contract.endSeason <= world.season + 1);
  return (
    <div>
      <ArtBanner image={ART.mercato} title="Mercato" actions={<Badge tone={win.open ? 'good' : 'warn'}>{win.open ? `${win.name} aperto` : 'Finestra chiusa'}</Badge>} className="mb-5">
        {win.open ? 'Cerca rinforzi, tratta con i club e rinnova i contratti. Ogni acquisto deve liberare un posto: la rosa è di 15.' : 'Mercato chiuso: puoi ingaggiare solo svincolati.'}
      </ArtBanner>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'cerca', label: 'Cerca giocatori' },
        { id: 'osservati', label: 'Osservati', count: world.shortlist.length },
        { id: 'offerte', label: 'Offerte', count: incoming.length },
        { id: 'contratti', label: 'Contratti', count: expiring.filter((p) => p.contract!.endSeason <= world.season).length },
        { id: 'movimenti', label: 'Movimenti' },
      ]} />
      {tab === 'cerca' && <Search />}
      {tab === 'osservati' && (
        <Panel>
          <div className="pt-3">
            {world.scouting.length > 0 && <div className="text-sm text-mute mb-3">Relazioni in corso: {world.scouting.map((a) => `${world.players[a.playerId]?.lastName} (${a.daysLeft}g)`).join(', ')}</div>}
            <PlayerTable world={world} players={world.shortlist.map((id) => world.players[id]).filter(Boolean)} showClub />
          </div>
        </Panel>
      )}
      {tab === 'offerte' && <Offers incoming={incoming} outgoing={outgoing} />}
      {tab === 'contratti' && <Contracts players={expiring} />}
      {tab === 'movimenti' && <Movements />}
    </div>
  );
}

function Search() {
  const world = useWorld();
  const user = world.clubs[world.userClubId];
  // I filtri stanno nello store: aprendo la scheda di un giocatore e tornando indietro non si perdono.
  const f = useGame((s) => s.market);
  const setMarket = useGame((s) => s.setMarket);
  const { role, minAge, maxAge, minOvr, maxValue, scope, name } = f;
  const setRole = (v: Role | '') => setMarket({ role: v });
  const setMinAge = (v: number) => setMarket({ minAge: v });
  const setMaxAge = (v: number) => setMarket({ maxAge: v });
  const setMinOvr = (v: number) => setMarket({ minOvr: v });
  const setMaxValue = (v: number) => setMarket({ maxValue: v });
  const setScope = (v: typeof scope) => setMarket({ scope: v });
  const setName = (v: string) => setMarket({ name: v });
  const scouting = user.facilities.scouting.level;
  const results = useMemo(() => {
    const q = name.trim().toLowerCase();
    return Object.values(world.players)
      .filter((p) => {
        if (p.retired || p.clubId === user.id || p.youth) return false;
        const club = p.clubId ? world.clubs[p.clubId] : null;
        // La rete di osservatori limita la visibilità dei club esteri.
        if (club && club.country !== 'ITA' && scouting < 3 && !world.knowledge[p.id]) return false;
        if (role && p.role !== role) return false;
        const age = ageOf(p, world.season);
        if (age < minAge || age > maxAge) return false;
        if (overallRange(world, p)[1] < minOvr) return false;
        if (maxValue && p.value > maxValue) return false;
        if (scope === 'free' && p.clubId) return false;
        if (scope === 'listed' && !(p.transferListed || p.loanListed || p.wantsToLeave)) return false;
        if (scope === 'ita' && p.nationality !== 'ITA') return false;
        if (q && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .map((p) => ({ p, est: overallRange(world, p) }))
      .sort((a, b) => b.est[0] + b.est[1] - (a.est[0] + a.est[1]))
      .slice(0, 150)
      .map((x) => x.p);
  }, [world, role, minAge, maxAge, minOvr, maxValue, scope, name, user.id, scouting]);
  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 pt-4">
          <Field label="Nome"><input className="w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cerca…" /></Field>
          <Field label="Ruolo">
            <select className="w-full" value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
              <option value="">Tutti</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <Field label="Età min"><input type="number" className="w-full" value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} /></Field>
          <Field label="Età max"><input type="number" className="w-full" value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} /></Field>
          <Field label="Overall min"><input type="number" className="w-full" value={minOvr} onChange={(e) => setMinOvr(Number(e.target.value))} /></Field>
          <Field label="Valore max (€)"><input type="number" className="w-full" value={maxValue || ''} placeholder="Nessun limite" onChange={(e) => setMaxValue(Number(e.target.value))} /></Field>
          <Field label="Mostra">
            <select className="w-full" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="all">Tutti</option>
              <option value="free">Solo svincolati</option>
              <option value="listed">In vendita / scontenti</option>
              <option value="ita">Solo italiani</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end mt-3"><Button size="sm" variant="ghost" onClick={() => setMarket({ role: '', minAge: 16, maxAge: 36, minOvr: 30, maxValue: 0, scope: 'all', name: '' })}>Azzera i filtri</Button></div>
        <p className="text-[11px] text-faint mt-1">
          {scouting < 3 ? 'La rete di osservatori copre solo l’Italia: migliora il centro scouting (livello 3) per vedere i giocatori dei club esteri.' : 'La rete di osservatori copre anche l’Europa.'}
          {' '}Overall e potenziale dei giocatori altrui sono stime: più conosci un giocatore, più sono precise.
        </p>
      </Panel>
      <Panel title={`${results.length} risultati`}>
        <PlayerTable world={world} players={results} showClub />
      </Panel>
    </div>
  );
}

function Offers({ incoming, outgoing }: { incoming: TransferOffer[]; outgoing: TransferOffer[] }) {
  const world = useWorld();
  const s = useGame.getState();
  const [counter, setCounter] = useState<{ offer: TransferOffer; fee: number } | null>(null);
  const [contract, setContract] = useState<TransferOffer | null>(null);
  const respond = (o: TransferOffer, action: 'accept' | 'reject' | 'counter', fee?: number) => {
    const msg = respondToIncoming(world, o.id, action, fee);
    s.toast(msg, msg.includes('rifiut') || msg.includes('ritira') ? 'info' : 'ok');
    s.touch();
  };
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Panel title="Offerte ricevute">
        {incoming.length ? (
          <ul className="space-y-3">
            {incoming.map((o) => {
              const p = world.players[o.playerId];
              const buyer = world.clubs[o.toClubId];
              if (!p || !buyer) return null;
              return (
                <li key={o.id} className="panel-flat p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <PlayerName p={p} world={world} avatar />
                      <div className="text-xs text-mute mt-1 flex items-center gap-1">da <ClubName club={buyer} size={16} /></div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl font-bold">{o.loan ? 'Prestito' : fmtMoney(o.fee)}</div>
                      <div className="text-[11px] text-mute">valore {fmtMoney(p.value)} · scade il {formatShortDate(world.season, o.expiresDay)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="success" onClick={() => respond(o, 'accept')}>Accetta</Button>
                    <Button size="sm" variant="outline" onClick={() => respond(o, 'reject')}>Rifiuta</Button>
                    {!o.loan && <Button size="sm" variant="outline" onClick={() => setCounter({ offer: o, fee: Math.round(o.fee * 1.3 / 1000) * 1000 })}>Controproponi</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <Empty>Nessuna offerta in sospeso. Metti un giocatore sul mercato per attirare offerte.</Empty>}
      </Panel>
      <Panel title="Le tue offerte">
        {outgoing.length ? (
          <ul className="space-y-2">
            {outgoing.map((o) => {
              const p = world.players[o.playerId];
              if (!p) return null;
              const tone = o.status === 'accepted' ? 'good' : o.status === 'rejected' || o.status === 'expired' ? 'bad' : 'warn';
              return (
                <li key={o.id} className="panel-flat p-3 flex flex-wrap items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <PlayerName p={p} world={world} />
                    <div className="text-xs text-mute">{o.loan ? 'Prestito' : fmtMoney(o.fee)} · {o.note}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={tone}>{({ accepted: 'Accordo con il club', rejected: 'Rifiutata', countered: 'Controproposta', expired: 'Scaduta', pending: 'In attesa', withdrawn: 'Chiusa' } as const)[o.status]}</Badge>
                    {o.status === 'accepted' && <Button size="sm" variant="gold" onClick={() => setContract(o)}>Tratta l’ingaggio</Button>}
                    {o.status === 'countered' && <Button size="sm" variant="outline" onClick={() => s.go('player', p.id)}>Rilancia</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <Empty>Non hai fatto offerte. Cerca un giocatore e apri la sua scheda per proporre un trasferimento.</Empty>}
      </Panel>
      {counter && (
        <Modal open onClose={() => setCounter(null)} title="Controproposta"
          footer={<><Button variant="ghost" onClick={() => setCounter(null)}>Annulla</Button><Button onClick={() => { respond(counter.offer, 'counter', counter.fee); setCounter(null); }}>Invia</Button></>}>
          <Field label="Cifra richiesta (€)"><input type="number" className="w-full num" value={counter.fee} step={1000} onChange={(e) => setCounter({ ...counter, fee: Number(e.target.value) })} /></Field>
          <p className="text-xs text-mute mt-2">Se chiedi troppo il club potrebbe ritirarsi.</p>
        </Modal>
      )}
      {contract && world.players[contract.playerId] && <ContractModal player={world.players[contract.playerId]} mode="transfer" offer={contract} onClose={() => setContract(null)} />}
    </div>
  );
}

function Contracts({ players }: { players: Player[] }) {
  const world = useWorld();
  const [renew, setRenew] = useState<Player | null>(null);
  const cols = [
    { key: 'n', label: 'Giocatore', render: (p: Player) => <PlayerName p={p} world={world} avatar />, sort: (p: Player) => p.lastName },
    { key: 'ovr', label: 'OVR', render: (p: Player) => p.overall, sort: (p: Player) => p.overall },
    { key: 'pot', label: 'POT', render: (p: Player) => { const r = potentialRange(world, p); return `${r[0]}–${r[1]}`; } },
    { key: 'age', label: 'Età', render: (p: Player) => ageOf(p, world.season), sort: (p: Player) => ageOf(p, world.season) },
    { key: 'w', label: 'Ingaggio', render: (p: Player) => fmtMoney(p.contract!.wage), sort: (p: Player) => p.contract!.wage },
    { key: 'e', label: 'Scadenza', render: (p: Player) => <Badge tone={p.contract!.endSeason <= world.season ? 'bad' : 'warn'}>{p.contract!.endSeason <= world.season ? 'Fine stagione' : `Giugno ${p.contract!.endSeason + 1}`}</Badge> },
    { key: 'a', label: '', render: (p: Player) => <Button size="sm" onClick={() => setRenew(p)}>Rinnova</Button> },
  ];
  return (
    <Panel title="Contratti in scadenza" subtitle="Chi arriva a fine contratto senza rinnovo se ne va a parametro zero.">
      <DataTable rows={players} columns={cols} rowKey={(p) => p.id} initialSort="ovr" empty="Nessun contratto in scadenza." />
      {renew && <ContractModal player={renew} mode="renewal" onClose={() => setRenew(null)} />}
    </Panel>
  );
}

function Movements() {
  const world = useWorld();
  const [onlyUser, setOnlyUser] = useState(false);
  const list = world.transfers.filter((t) => !onlyUser || t.toId === world.userClubId || t.fromId === world.userClubId).slice(0, 150);
  const cols = [
    { key: 'd', label: 'Data', render: (t: TransferRecord) => <span className="text-xs text-mute num">{seasonLabel(t.season)} · {formatShortDate(t.season, t.day)}</span> },
    { key: 'p', label: 'Giocatore', render: (t: TransferRecord) => <span className="font-medium">{t.playerName} <span className="text-faint text-xs">({t.overall})</span></span>, sort: (t: TransferRecord) => t.overall },
    { key: 'f', label: 'Da', render: (t: TransferRecord) => t.fromName },
    { key: 't', label: 'A', render: (t: TransferRecord) => t.toName },
    { key: 'fee', label: 'Cifra', render: (t: TransferRecord) => (t.loan ? <Badge tone="violet">Prestito</Badge> : t.fee ? fmtMoney(t.fee) : <span className="text-mute">Parametro zero</span>), sort: (t: TransferRecord) => t.fee },
  ];
  return (
    <Panel title="Movimenti di mercato" actions={<label className="text-xs flex items-center gap-2"><input type="checkbox" checked={onlyUser} onChange={(e) => setOnlyUser(e.target.checked)} /> Solo la mia società</label>}>
      <DataTable rows={list} columns={cols} rowKey={(t) => `${t.playerId}${t.season}${t.day}${t.toId}`} empty="Nessun movimento." dense />
    </Panel>
  );
}
