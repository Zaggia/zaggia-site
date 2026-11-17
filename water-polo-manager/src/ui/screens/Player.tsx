import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Avatar } from '../components/Avatar';
import { Badge, Bar, Button, Empty, Flag, Kv, Modal, Ovr, Panel, Form } from '../components/ui';
import { ClubName, KnowledgeNote, StatusBadges } from '../components/game';
import { Radar } from '../components/charts';
import { ATTR_GROUPS, ATTR_LABELS, GROUP_LABELS, ROLE_LABELS, ROLE_WEIGHTS, overallInRole, ROLES, ROLE_SHORT } from '../../engine/player/attributes';
import { ageOf, yearsLeft } from '../../engine/player/value';
import { knowledgeOf, overallRange, potentialRange } from '../../engine/world/queries';
import { STATUS_LABELS, releaseCost, releasePlayer } from '../../engine/transfer/contracts';
import { ContractModal, BidModal } from '../components/Negotiation';
import type { AttrGroup, AttrKey, Player } from '../../engine/types';
import { fmtMoney, matchRatingColor, moraleLabel, personalityLabel, ratingColor, seasonLabel } from '../format';
import { emptyStatLine } from '../../engine/player/generate';
import { demoteToYouth, promoteYouth } from '../../engine/club/manage';

export function PlayerScreen() {
  const world = useWorld();
  const id = useGame((s) => s.param);
  const p = id ? world.players[id] : undefined;
  if (!p) return <Empty>Giocatore non trovato (potrebbe essersi ritirato).</Empty>;
  return <PlayerView p={p} />;
}

function PlayerView({ p }: { p: Player }) {
  const world = useWorld();
  const s = useGame.getState();
  const user = world.clubs[world.userClubId];
  const own = p.clubId === user.id;
  const club = p.clubId ? world.clubs[p.clubId] : null;
  const know = knowledgeOf(world, p);
  const ovrR = overallRange(world, p);
  const potR = potentialRange(world, p);
  const [modal, setModal] = useState<null | 'renew' | 'free' | 'bid' | 'release'>(null);
  const age = ageOf(p, world.season);
  const formAvg = p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : 0;
  const shortlisted = world.shortlist.includes(p.id);
  const scouting = world.scouting.find((a) => a.playerId === p.id);
  const showAttrs = know >= 45 || own;
  const blur = (v: number) => (own || know >= 90 ? Math.round(v) : Math.round(v / 5) * 5);
  const groups: AttrGroup[] = p.role === 'POR' ? ['portiere', 'mentale', 'fisico', 'tecnica'] : ['tecnica', 'fisico', 'mentale'];
  const radarKeys: AttrKey[] = p.role === 'POR'
    ? ['riflessi', 'piazzamento', 'uscite', 'rinvio', 'concentrazione', 'elevazione']
    : ['tiro', 'passaggio', 'giocoCentro', 'marcatura', 'velocita', 'forza', 'intelligenzaTattica', 'superiorita'];
  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden fade-in">
        <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(110deg, ${club?.colors[0] ?? '#334155'} 0%, transparent 55%)` }} />
        <div className="relative flex flex-wrap items-center gap-5 p-5">
          <Avatar player={p} color={club?.colors[0] ?? '#334155'} size={104} />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 text-sm text-mute"><Flag code={p.nationality} withName /> · {age} anni · {p.height} cm · {p.weight} kg · {p.hand === 'L' ? 'mancino' : 'destro'}</div>
            <h1 className="font-display text-4xl font-extrabold leading-none mt-1">{p.firstName} {p.lastName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge tone="aqua">{ROLE_LABELS[p.role]}</Badge>
              {club ? <ClubName club={club} size={20} /> : <Badge>Svincolato</Badge>}
              {p.youth && <Badge tone="violet">Settore giovanile</Badge>}
              <StatusBadges p={p} world={world} />
            </div>
            <div className="text-xs text-mute mt-2">Carattere: {personalityLabel(p.personality)}{p.contract ? ` · contratto fino al ${p.contract.endSeason + 1} (${STATUS_LABELS[p.contract.status].toLowerCase()})` : ''}</div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-center"><div className="text-[10px] uppercase text-mute">Overall</div><Ovr v={own ? p.overall : (ovrR[0] + ovrR[1]) / 2} size="lg" range={own ? undefined : ovrR} /></div>
            <div className="text-center"><div className="text-[10px] uppercase text-mute">Potenziale</div><Ovr v={(potR[0] + potR[1]) / 2} size="lg" range={potR} /></div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {own && !p.youth && <Button onClick={() => setModal('renew')}>Rinnova contratto</Button>}
        {own && !p.youth && <Button variant="outline" onClick={() => s.act((w) => { const x = w.players[p.id]; x.transferListed = !x.transferListed; if (x.transferListed) x.loanListed = false; }, p.transferListed ? 'Tolto dal mercato.' : 'Messo sul mercato: aspetta le offerte.')}>{p.transferListed ? 'Togli dal mercato' : 'Metti sul mercato'}</Button>}
        {own && !p.youth && <Button variant="outline" onClick={() => s.act((w) => { const x = w.players[p.id]; x.loanListed = !x.loanListed; if (x.loanListed) x.transferListed = false; }, p.loanListed ? 'Tolto dalla lista prestiti.' : 'Disponibile per il prestito.')}>{p.loanListed ? 'Annulla prestito' : 'Offri in prestito'}</Button>}
        {own && !p.youth && <Button variant="outline" onClick={() => s.act((w) => { w.clubs[w.userClubId].lineup.captainId = p.id; }, `${p.lastName} è il nuovo capitano.`)}>Nomina capitano</Button>}
        {own && p.youth && <Button onClick={() => s.act((w) => promoteYouth(w, w.clubs[w.userClubId], w.players[p.id]), 'Promosso in prima squadra!')}>Promuovi in prima squadra</Button>}
        {own && !p.youth && age <= 19 && <Button variant="outline" onClick={() => s.act((w) => demoteToYouth(w, w.clubs[w.userClubId], w.players[p.id]), 'Rimandato nel settore giovanile.')}>Rimanda nelle giovanili</Button>}
        {own && <Button variant="danger" onClick={() => setModal('release')}>Svincola</Button>}
        {!own && p.clubId && <Button onClick={() => setModal('bid')}>Fai un’offerta</Button>}
        {!own && !p.clubId && !p.retired && <Button onClick={() => setModal('free')}>Proponi un contratto</Button>}
        {!own && <Button variant="outline" onClick={() => s.act((w) => { w.shortlist = shortlisted ? w.shortlist.filter((x) => x !== p.id) : [...w.shortlist, p.id]; }, shortlisted ? 'Rimosso dagli osservati.' : 'Aggiunto alla lista degli osservati.')}>{shortlisted ? 'Togli dagli osservati' : 'Aggiungi agli osservati'}</Button>}
        {!own && know < 100 && (
          <Button variant="outline" disabled={!!scouting} onClick={() => s.act((w) => {
            const obs = w.clubs[w.userClubId].staff.osservatore ? w.staff[w.clubs[w.userClubId].staff.osservatore!]?.rating ?? 0 : 0;
            const days = Math.max(4, Math.round(21 - obs / 6 - w.clubs[w.userClubId].facilities.scouting.level * 2));
            if (w.scouting.length >= 2 + w.clubs[w.userClubId].facilities.scouting.level) return 'Gli osservatori sono già tutti impegnati.';
            w.scouting.push({ playerId: p.id, daysLeft: days });
            if (!w.shortlist.includes(p.id)) w.shortlist.push(p.id);
          }, 'Osservatore inviato: relazione in arrivo.')}>
            {scouting ? `Relazione tra ${scouting.daysLeft} giorni` : 'Invia un osservatore'}
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Profilo">
          <Kv k="Valore di mercato" v={fmtMoney(p.value)} />
          <Kv k="Ingaggio" v={p.contract ? `${fmtMoney(p.contract.wage)} / anno` : '—'} />
          <Kv k="Contratto" v={p.contract ? `${yearsLeft(p, world.season)} stagion${yearsLeft(p, world.season) === 1 ? 'e' : 'i'}` : '—'} />
          <Kv k="Morale" v={<span>{moraleLabel(p.morale)} <span className="text-faint num">({Math.round(p.morale)})</span></span>} />
          <Kv k="Condizione fisica" v={<div className="w-28"><Bar value={p.condition} /></div>} />
          <Kv k="Forma recente" v={<Form form={p.form} />} />
          <Kv k="Esperienza" v={Math.round(p.experience)} />
          <Kv k="Reputazione" v={Math.round(p.reputation)} />
          {p.injury && <Kv k="Infortunio" v={<span className="text-bad">{p.injury.name} ({p.injury.daysLeft} giorni)</span>} />}
          {formAvg > 0 && <Kv k="Media voto (ultime)" v={<span style={{ color: matchRatingColor(formAvg) }}>{formAvg.toFixed(2)}</span>} />}
          {own && (
            <div className="mt-3">
              <div className="text-xs text-mute mb-1">Allenamento individuale</div>
              <select className="w-full" value={p.devFocus ?? ''} onChange={(e) => s.act((w) => { w.players[p.id].devFocus = (e.target.value || undefined) as AttrGroup | undefined; })}>
                <option value="">Nessun focus particolare</option>
                {(['tecnica', 'fisico', 'mentale', ...(p.role === 'POR' ? ['portiere'] : [])] as AttrGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
              </select>
            </div>
          )}
          <div className="mt-2"><KnowledgeNote world={world} p={p} /></div>
        </Panel>
        <Panel title="Caratteristiche" className="lg:col-span-2">
          {!showAttrs ? (
            <Empty>Gli osservatori conoscono poco questo giocatore: invia un osservatore per una relazione completa.</Empty>
          ) : (
            <div className="grid md:grid-cols-[1fr_220px] gap-4">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {groups.map((g) => (
                  <div key={g}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">{GROUP_LABELS[g]}</div>
                    {ATTR_GROUPS[g].map((k) => {
                      const v = blur(p.attrs[k]);
                      const key = (ROLE_WEIGHTS[p.role][k] ?? 0) >= 0.08;
                      return (
                        <div key={k} className="flex items-center gap-2 py-0.5">
                          <span className={`text-xs flex-1 truncate ${key ? 'text-ink font-semibold' : 'text-mute'}`}>{ATTR_LABELS[k]}</span>
                          <div className="w-20"><Bar value={v} height={5} /></div>
                          <span className="w-6 text-right text-xs font-bold num" style={{ color: ratingColor(v) }}>{v}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div>
                <Radar values={radarKeys.map((k) => blur(p.attrs[k]))} labels={radarKeys.map((k) => ATTR_LABELS[k].split(' ')[0])} />
                <div className="text-xs text-mute mt-2">Rendimento negli altri ruoli</div>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {ROLES.filter((r) => r !== 'POR' || p.role === 'POR').map((r) => (
                    <div key={r} className="text-center rounded bg-white/[0.04] py-1">
                      <div className="text-[10px] text-faint">{ROLE_SHORT[r]}</div>
                      <div className="text-xs font-bold num" style={{ color: ratingColor(overallInRole(p.attrs, r)) }}>{blur(overallInRole(p.attrs, r))}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-faint mt-2">In grassetto le caratteristiche che pesano di più sull’overall del ruolo.</p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title={`Stagione ${seasonLabel(world.season)}`}>
          {Object.keys(p.stats).length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase text-faint"><th className="text-left py-1">Competizione</th><th>Pres.</th><th>Gol</th><th>Assist</th><th>Parate</th><th>Media</th></tr></thead>
              <tbody>
                {Object.entries(p.stats).map(([k, st]) => (
                  <tr key={k} className="border-t border-line/40 text-center">
                    <td className="text-left py-1.5">{compName(k, world)}</td>
                    <td className="num">{st.apps}</td><td className="num font-semibold">{st.goals}</td><td className="num">{st.assists}</td><td className="num">{st.saves || '—'}</td>
                    <td className="num" style={{ color: matchRatingColor(st.apps ? st.ratingSum / st.apps : 0) }}>{st.apps ? (st.ratingSum / st.apps).toFixed(2) : '—'}</td>
                  </tr>
                ))}
                <TotalsRow p={p} />
              </tbody>
            </table>
          ) : <Empty>Nessuna presenza in questa stagione.</Empty>}
        </Panel>
        <Panel title="Carriera">
          {p.history.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase text-faint"><th className="text-left py-1">Stagione</th><th className="text-left">Club</th><th>Pres.</th><th>Gol</th><th>Media</th><th>OVR</th></tr></thead>
              <tbody>
                {[...p.history].reverse().map((h) => (
                  <tr key={h.season + h.clubId} className="border-t border-line/40 text-center">
                    <td className="text-left py-1.5 num">{seasonLabel(h.season)}</td>
                    <td className="text-left truncate max-w-[160px]">{h.clubName} <span className="text-faint text-xs">({h.division === 'EST' ? 'estero' : h.division})</span></td>
                    <td className="num">{h.apps}</td><td className="num">{h.goals}</td>
                    <td className="num" style={{ color: matchRatingColor(h.avgRating) }}>{h.avgRating ? h.avgRating.toFixed(2) : '—'}</td>
                    <td className="num">{h.overall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>Prima stagione registrata.</Empty>}
        </Panel>
      </div>

      {modal === 'renew' && <ContractModal player={p} mode="renewal" onClose={() => setModal(null)} />}
      {modal === 'free' && <ContractModal player={p} mode="free" onClose={() => setModal(null)} />}
      {modal === 'bid' && <BidModal player={p} onClose={() => setModal(null)} />}
      {modal === 'release' && (
        <Modal open onClose={() => setModal(null)} title={`Svincolare ${p.lastName}?`}
          footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annulla</Button><Button variant="danger" onClick={() => { s.act((w) => releasePlayer(w, w.players[p.id], 'svincolato'), 'Giocatore svincolato.'); setModal(null); s.back(); }}>Svincola</Button></>}>
          <p className="text-sm text-mute">Il giocatore lascerà il club. La buonuscita costa <span className="text-ink font-semibold">{fmtMoney(releaseCost(world, p))}</span> (metà dell’ingaggio residuo).</p>
        </Modal>
      )}
    </div>
  );
}

function TotalsRow({ p }: { p: Player }) {
  const t = emptyStatLine();
  for (const s of Object.values(p.stats)) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += s[k];
  if (Object.keys(p.stats).length < 2) return null;
  return (
    <tr className="border-t border-line text-center font-semibold">
      <td className="text-left py-1.5">Totale</td><td className="num">{t.apps}</td><td className="num">{t.goals}</td><td className="num">{t.assists}</td><td className="num">{t.saves || '—'}</td>
      <td className="num">{t.apps ? (t.ratingSum / t.apps).toFixed(2) : '—'}</td>
    </tr>
  );
}

export function compName(key: string, world: { rules: { leagues: { key: string; name: string }[]; cups: { key: string; name: string }[]; continental: { key: string; name: string }[] } }): string {
  return world.rules.leagues.find((l) => l.key === key)?.name ?? world.rules.cups.find((c) => c.key === key)?.name ?? world.rules.continental.find((c) => c.key === key)?.name ?? key;
}
