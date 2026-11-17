import { useGame, useWorld } from '../../store/game';
import { Badge, Button, DataTable, Kv, PageHeader, Panel } from '../components/ui';
import { PlayerName } from '../components/game';
import { ROLE_SHORT, GROUP_LABELS } from '../../engine/player/attributes';
import { ageOf } from '../../engine/player/value';
import { potentialRange } from '../../engine/world/queries';
import { promoteYouth } from '../../engine/club/manage';
import { rosterFullError } from '../../engine/club/roster';
import { releasePlayer } from '../../engine/transfer/contracts';
import { FACILITIES } from '../../engine/club/facilities';
import { academyMean } from '../../engine/club/generate';
import type { AttrGroup, Player } from '../../engine/types';
import { Ovr } from '../components/ui';
import { dayOf, formatDate } from '../../engine/calendar';

export function YouthScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const youth = club.youthIds.map((id) => world.players[id]).filter(Boolean);
  const lvl = club.facilities.giovanile.level;
  const dir = club.staff.giovanili ? world.staff[club.staff.giovanili] : null;
  const mean = academyMean(lvl, dir?.rating ?? 0, club.reputation);
  const intake = dayOf(world.season, world.rules.youthIntakeDate);
  const full = rosterFullError(world, club);
  const cols = [
    { key: 'n', label: 'Giovane', render: (p: Player) => <PlayerName p={p} world={world} avatar />, sort: (p: Player) => p.lastName },
    { key: 'r', label: 'Ruolo', render: (p: Player) => <span className="text-mute">{ROLE_SHORT[p.role]}</span>, sort: (p: Player) => p.role },
    { key: 'a', label: 'Età', render: (p: Player) => ageOf(p, world.season), sort: (p: Player) => ageOf(p, world.season) },
    { key: 'o', label: 'OVR', render: (p: Player) => <Ovr v={p.overall} size="sm" />, sort: (p: Player) => p.overall },
    { key: 'p', label: 'Potenziale', render: (p: Player) => { const r = potentialRange(world, p); return <span className="font-semibold num">{r[0]}–{r[1]}</span>; }, sort: (p: Player) => p.potential },
    {
      key: 'f', label: 'Allenamento individuale',
      render: (p: Player) => (
        <select value={p.devFocus ?? ''} onClick={(e) => e.stopPropagation()} onChange={(e) => s.act((w) => { w.players[p.id].devFocus = (e.target.value || undefined) as AttrGroup | undefined; })}>
          <option value="">Generico</option>
          {(['tecnica', 'fisico', 'mentale', ...(p.role === 'POR' ? ['portiere'] : [])] as AttrGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
        </select>
      ),
    },
    {
      key: 'x', label: '',
      render: (p: Player) => (
        <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" disabled={!!full} title={full ?? undefined} onClick={() => s.act((w) => promoteYouth(w, w.clubs[w.userClubId], w.players[p.id]), `${p.lastName} promosso in prima squadra.`)}>Promuovi</Button>
          <Button size="sm" variant="ghost" onClick={() => s.act((w) => { w.players[p.id].transferListed = !w.players[p.id].transferListed; }, p.transferListed ? 'Tolto dal mercato.' : 'Segnalato ai club interessati.')}>{p.transferListed ? 'Non cedere' : 'Cedi'}</Button>
          <Button size="sm" variant="ghost" onClick={() => s.act((w) => releasePlayer(w, w.players[p.id], 'lascia il vivaio'), 'Ragazzo svincolato.')}>Svincola</Button>
        </span>
      ),
    },
    { key: 'b', label: '', render: (p: Player) => (p.potential >= 80 && potentialRange(world, p)[1] >= 78 ? <Badge tone="gold">Talento</Badge> : null) },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Settore giovanile" subtitle={`${youth.length} ragazzi · ${FACILITIES.giovanile.levels[lvl - 1]}`} actions={<Button variant="outline" onClick={() => s.go('strutture')}>Migliora il vivaio</Button>} />
      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Il vivaio">
          <Kv k="Livello" v={`${lvl} · ${FACILITIES.giovanile.levels[lvl - 1]}`} />
          <Kv k="Nuovi ragazzi ogni anno" v={2 + lvl} />
          <Kv k="Potenziale medio atteso" v={Math.round(mean)} />
          <Kv k="Responsabile" v={dir ? `${dir.firstName} ${dir.lastName} (${dir.rating})` : 'Nessuno'} />
          <Kv k="Prossimo ingresso" v={world.day <= intake ? formatDate(world.season, intake) : 'Prossima stagione'} />
          <p className="text-xs text-mute mt-3">Un vivaio migliore e un buon responsabile producono ragazzi più promettenti. Raramente può nascere un fuoriclasse con potenziale da campione del mondo.</p>
        </Panel>
        <Panel title="Come crescono" className="lg:col-span-2">
          <div className="text-sm text-mute space-y-2">
            <p>I giovani crescono con l’allenamento, con i minuti in partita, con la qualità del settore giovanile e dell’allenatore (sviluppo dei giovani). La professionalità conta: non tutti raggiungono il loro potenziale.</p>
            <p>Promuovendoli in prima squadra firmano un contratto e possono giocare; nel vivaio crescono più protetti ma senza minuti veri. A 20 anni devono essere promossi o lasciano il club.</p>
            <p>Il potenziale mostrato è una stima: la precisione dipende dal centro scouting e dal capo osservatore.</p>
          </div>
        </Panel>
      </div>
      <Panel title="Ragazzi del vivaio">
        <DataTable rows={youth} columns={cols} rowKey={(p) => p.id} onRow={(p) => s.go('player', p.id)} initialSort="p" empty="Il vivaio è vuoto: i nuovi ragazzi arrivano a metà marzo." dense />
      </Panel>
    </div>
  );
}
