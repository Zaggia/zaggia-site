import { useGame, useWorld } from '../../store/game';
import { Badge, Button, Empty, PageHeader, Panel } from '../components/ui';
import { OBJECTIVE_LABELS, SLOT_LABELS, acceptSponsorOffer, freeSlots, rejectSponsorOffer, sponsorValueTotal, refreshUserSponsorOffers } from '../../engine/economy/sponsors';
import { sponsorSlots } from '../../engine/club/facilities';
import { fmtMoney, formatShortDate } from '../format';
import { worldRng } from '../../engine/world/context';

export function SponsorScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const free = freeSlots(club);
  const offers = world.sponsorOffers.filter((o) => o.expiresDay >= world.day);
  return (
    <div className="space-y-5">
      <PageHeader title="Sponsor" subtitle={`${club.sponsors.length}/${sponsorSlots(club.facilities.uffici.level)} spazi occupati · ${fmtMoney(sponsorValueTotal(club))} l’anno`} actions={
        free.length > 0 && offers.length === 0 ? <Button variant="outline" onClick={() => s.act((w) => refreshUserSponsorOffers(w, worldRng(w)), 'Il responsabile commerciale ha cercato nuovi partner.')}>Cerca nuovi sponsor</Button> : undefined
      } />
      <Panel title="Contratti in corso">
        {club.sponsors.length ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {club.sponsors.map((sp) => (
              <div key={sp.id} className="panel-flat p-4">
                <div className="flex justify-between items-start gap-2"><div className="font-display text-xl font-bold">{sp.name}</div><Badge tone="aqua">{SLOT_LABELS[sp.slot]}</Badge></div>
                <div className="text-2xl font-display font-extrabold text-good mt-2">{fmtMoney(sp.annual)}<span className="text-xs text-mute font-sans font-normal"> / anno</span></div>
                <div className="text-sm text-mute mt-2">Fino a giugno {sp.endSeason + 1}</div>
                <div className="text-sm mt-1">Obiettivo: <b>{OBJECTIVE_LABELS[sp.objective]}</b></div>
                <div className="text-xs text-mute">Bonus {fmtMoney(sp.bonus)}{sp.malus ? ` · se mancato −${Math.round(sp.malus * 100)}% l’anno dopo` : ''}</div>
              </div>
            ))}
          </div>
        ) : <Empty>Nessuno sponsor: valuta le offerte qui sotto.</Empty>}
      </Panel>
      <Panel title="Offerte" subtitle={free.length ? `Spazi liberi: ${free.map((f) => SLOT_LABELS[f]).join(', ')}` : 'Tutti gli spazi sono occupati: amplia gli uffici societari per averne di più.'}>
        {offers.length ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {offers.map((o) => (
              <div key={o.id} className="panel-flat p-4">
                <div className="flex justify-between items-start gap-2"><div className="font-display text-xl font-bold">{o.name}</div><Badge>{SLOT_LABELS[o.slot]}</Badge></div>
                <div className="text-2xl font-display font-extrabold mt-2">{fmtMoney(o.annual)}<span className="text-xs text-mute font-sans font-normal"> / anno</span></div>
                <div className="text-sm text-mute mt-1">Durata: {o.endSeason - o.startSeason + 1} stagion{o.endSeason - o.startSeason ? 'i' : 'e'}</div>
                <div className="text-sm mt-1">Obiettivo: <b>{OBJECTIVE_LABELS[o.objective]}</b></div>
                <div className="text-xs text-mute">Bonus {fmtMoney(o.bonus)}{o.malus ? ` · malus ${Math.round(o.malus * 100)}%` : ''} · scade il {formatShortDate(world.season, o.expiresDay)}</div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" disabled={!free.includes(o.slot)} onClick={() => s.act((w) => acceptSponsorOffer(w, o.id), `Firmato con ${o.name}!`)}>Firma</Button>
                  <Button size="sm" variant="ghost" onClick={() => s.act((w) => rejectSponsorOffer(w, o.id))}>Rifiuta</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty>Nessuna offerta al momento. Nuove proposte arrivano a inizio stagione, a dicembre e a giugno.</Empty>}
      </Panel>
      <p className="text-xs text-faint">Il valore delle offerte cresce con la reputazione, la categoria, gli uffici societari e il responsabile commerciale. Obiettivi ambiziosi portano più soldi, ma se mancati riducono il contributo.</p>
    </div>
  );
}
