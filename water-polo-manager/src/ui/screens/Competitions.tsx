import { useState } from 'react';
import { useWorld } from '../../store/game';
import { Badge, Empty, PageHeader, Panel, Tabs } from '../components/ui';
import { StandingsTable, ClubName } from '../components/game';
import { Bracket } from './Standings';
import type { Competition, World } from '../../engine/types';
import { NATIONS } from '../../engine/data/names';
import { fmtMoney, seasonLabel } from '../format';

export function CompetitionsScreen() {
  const world = useWorld();
  const comps = Object.values(world.competitions).filter((c) => c.season === world.season && c.kind !== 'league');
  const order = ['SUPERCOPPA', 'COPPA', 'CL', 'EC', 'CC'];
  comps.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const [tab, setTab] = useState<string>(comps[0]?.id ?? 'regole');
  const cur = comps.find((c) => c.id === tab);
  return (
    <div>
      <PageHeader title="Competizioni" subtitle={`Stagione ${seasonLabel(world.season)}`} />
      <Tabs value={tab} onChange={setTab} tabs={[...comps.map((c) => ({ id: c.id, label: c.name })), { id: 'regole', label: 'Regolamenti' }, { id: 'albo', label: 'Albo d’oro' }]} />
      {cur && <CompView world={world} comp={cur} />}
      {tab === 'regole' && <Rules world={world} />}
      {tab === 'albo' && <Honours world={world} />}
    </div>
  );
}

function CompView({ world, comp }: { world: World; comp: Competition }) {
  const user = world.userClubId;
  const involved = comp.phases.some((p) => p.groups.some((g) => g.clubIds.includes(user)) || p.rounds.some((r) => r.ties.some((t) => t.homeId === user || t.awayId === user)) || Object.values(p.entrants ?? {}).some((l) => l.includes(user)));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {involved ? <Badge tone="aqua">La tua squadra partecipa</Badge> : <Badge>La tua squadra non partecipa</Badge>}
        {comp.finished && comp.winnerId && <Badge tone="gold">Vincitore: {world.clubs[comp.winnerId].name}</Badge>}
      </div>
      {comp.phases.map((p, i) => (
        <Panel key={i} title={p.name}>
          {p.kind === 'groups' ? (
            <div className="grid lg:grid-cols-2 gap-5">
              {p.groups.map((g, gi) => (
                <div key={gi}>
                  <div className="text-xs uppercase tracking-wider text-mute font-semibold mb-1">{g.name}</div>
                  <StandingsTable world={world} comp={comp} group={gi} compact />
                </div>
              ))}
            </div>
          ) : p.rounds.length ? <Bracket world={world} phase={p} /> : <Empty>Il tabellone sarà definito al termine della fase precedente.</Empty>}
          {p.entrants && Object.keys(p.entrants).length > 0 && p.rounds.length <= 1 && (
            <p className="text-xs text-mute mt-3">Teste di serie che entrano al turno successivo: {Object.values(p.entrants).flat().slice(0, 20).map((id) => world.clubs[id].short).join(', ')}{Object.values(p.entrants).flat().length > 20 ? '…' : ''}</p>
          )}
        </Panel>
      ))}
    </div>
  );
}

function Rules({ world }: { world: World }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-mute">I regolamenti sono salvati nella carriera e il motore li legge per creare gironi, calendari, playoff, playout, promozioni, retrocessioni e coppe. Nessuna regola è fissa nel codice.</p>
      <div className="grid lg:grid-cols-2 gap-5">
        {world.rules.leagues.map((l) => (
          <Panel key={l.key} title={l.name}>
            <ul className="text-sm space-y-1 text-mute">
              <li>• {l.groups} {l.groups > 1 ? 'gironi' : 'girone'} da {l.teamsPerGroup} squadre ({l.groupNames.join(', ')}), andata e ritorno</li>
              <li>• Punti: vittoria {l.points.win}, pareggio {l.points.draw}, sconfitta {l.points.loss}</li>
              {l.directPromotion > 0 && <li>• Promozione diretta: le prime {l.directPromotion} di ogni girone</li>}
              {l.directRelegation > 0 && <li>• Retrocessione diretta: le ultime {l.directRelegation} di ogni girone</li>}
              {l.postseason.map((p) => (
                <li key={p.id}>• {p.name}: posizioni {p.positions.join(', ')} {p.scope === 'perGroup' ? 'di ogni girone' : ''} — {p.rounds.map((r) => `${r.name} (${r.bestOf > 1 ? `al meglio di ${r.bestOf}` : 'gara secca'})`).join(', ')}{p.purpose === 'promotion' ? ' → promozione' : p.purpose === 'playout' ? ' → chi perde retrocede' : ' → scudetto'}</li>
              ))}
              <li>• Stranieri a referto: massimo {l.foreignersOnSheet}</li>
              <li>• Premio al primo posto {fmtMoney(l.prizeByPosition[0] ?? 0)}{l.promotionPrize ? ` · premio promozione ${fmtMoney(l.promotionPrize)}` : ''}</li>
            </ul>
          </Panel>
        ))}
        {world.rules.cups.map((c) => (
          <Panel key={c.key} title={c.name}>
            <ul className="text-sm space-y-1 text-mute">
              <li>• {c.kind === 'supercup' ? 'Campione d’Italia contro vincitrice della Coppa Italia, gara secca in campo neutro' : `Eliminazione diretta in gara secca tra le squadre di ${c.eligible.join(', ')}; le teste di serie entrano nei turni successivi`}</li>
              {c.finalFourFrom != null && c.kind !== 'supercup' && <li>• Semifinali e finale in Final Four su campo neutro</li>}
              <li>• Premio al vincitore {fmtMoney(c.prize[c.prize.length - 1])}</li>
            </ul>
          </Panel>
        ))}
        {world.rules.continental.map((c) => (
          <Panel key={c.key} title={c.name}>
            <ul className="text-sm space-y-1 text-mute">
              <li>• Italia: posizioni finali di Serie A1 {c.italySlots.join(', ')}</li>
              <li>• Altre nazioni: {Object.entries(c.foreignSlots).map(([n, k]) => `${NATIONS[n]?.name ?? n} ${k}`).join(', ')}</li>
              <li>• Formula: {c.format === 'groups+ko' ? `${c.groupCount} gironi da 4, poi ${c.koRounds.map((r) => r.name.toLowerCase()).join(', ')}` : c.koRounds.map((r) => `${r.name.toLowerCase()} (${r.format === 'twoLegs' ? 'andata e ritorno' : 'gara secca'})`).join(', ')}</li>
              <li>• Premi: {fmtMoney(c.prizeByRound[0])} di partecipazione, {fmtMoney(c.prizePerWin)} per vittoria, {fmtMoney(c.prizeByRound[c.prizeByRound.length - 1])} al vincitore</li>
            </ul>
          </Panel>
        ))}
        <Panel title="Mercato e calendario">
          <ul className="text-sm space-y-1 text-mute">
            {world.rules.windows.map((w) => <li key={w.name}>• {w.name}: dal {w.start.split('-').reverse().join('/')} al {w.end.split('-').reverse().join('/')}</li>)}
            <li>• Controllo della licenza nazionale: {world.rules.licenseCheckDate.split('-').reverse().join('/')}</li>
            <li>• Arrivo dei giovani: {world.rules.youthIntakeDate.split('-').reverse().join('/')}</li>
            <li>• {world.rules.matchSquadSize} giocatori a referto, 4 tempi da {world.rules.periodSeconds / 60} minuti</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Honours({ world }: { world: World }) {
  const keys: [string, string][] = [
    ['A1', 'Scudetto (Serie A1)'], ['COPPA', 'Coppa Italia'], ['SUPERCOPPA', 'Supercoppa Italiana'], ['CL', 'LEN Champions League'], ['EC', 'LEN Euro Cup'], ['CC', 'LEN Challenger Cup'],
  ];
  return (
    <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-5">
      {keys.map(([k, label]) => {
        const list = world.rollOfHonour[k] ?? [];
        return (
          <Panel key={k} title={label}>
            {list.length ? (
              <ul className="space-y-1">
                {list.slice(0, 20).map((h) => (
                  <li key={h.season} className="flex items-center gap-2 text-sm">
                    <span className="text-faint num w-14">{seasonLabel(h.season)}</span>
                    {world.clubs[h.clubId] ? <ClubName club={world.clubs[h.clubId]} size={16} /> : <span>{h.clubName}</span>}
                    {h.runnerUp && <span className="text-xs text-faint truncate">· finale con {h.runnerUp}</span>}
                  </li>
                ))}
              </ul>
            ) : <Empty>Nessun vincitore ancora: la storia comincia ora.</Empty>}
          </Panel>
        );
      })}
    </div>
  );
}
