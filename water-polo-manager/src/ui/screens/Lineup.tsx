import { Icon } from '../components/icons';
import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Avatar } from '../components/Avatar';
import { Badge, Bar, Button, Modal, Ovr, PageHeader, Panel } from '../components/ui';
import { SLOT_LABELS, SLOT_NAMES, SLOT_SHORT, slotSuitability, ROLE_SHORT } from '../../engine/player/attributes';
import { autoLineup, isAvailable, validateLineup, foreignLimit, isForeign } from '../../engine/club/lineup';
import type { Lineup, Player } from '../../engine/types';
import { cls } from '../format';
import { nextFixture } from '../../engine/world/queries';

const POS: Record<number, [number, number]> = {
  6: [50, 17], 1: [86, 24], 5: [14, 24], 2: [74, 50], 4: [26, 50], 3: [50, 64], 0: [50, 90],
};

export function LineupScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const l = club.lineup;
  const [sel, setSel] = useState<number | 'bench' | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const squad = [...club.playerIds, ...club.youthIds].map((id) => world.players[id]).filter(Boolean);
  const inUse = new Set([...l.slots.filter(Boolean), ...l.bench] as string[]);
  const issues = validateLineup(world, club, l);
  const next = nextFixture(world, club.id);
  const update = (fn: (lin: Lineup) => void) => s.act((w) => fn(w.clubs[w.userClubId].lineup));

  const place = (p: Player) => {
    if (sel == null) return;
    update((lin) => {
      const curSlot = lin.slots.indexOf(p.id);
      const curBench = lin.bench.indexOf(p.id);
      if (sel === 'bench') {
        if (curSlot >= 0) lin.slots[curSlot] = null;
        if (curBench < 0) {
          if (lin.bench.length >= world.rules.matchSquadSize - 7) lin.bench.pop();
          lin.bench.push(p.id);
        }
        return;
      }
      const prev = lin.slots[sel];
      if (curSlot >= 0) lin.slots[curSlot] = prev;
      else if (curBench >= 0) {
        lin.bench.splice(curBench, 1);
        if (prev) lin.bench.push(prev);
      }
      lin.slots[sel] = p.id;
    });
    if (sel !== 'bench') setSel(null);
  };

  const removeFromBench = (id: string) => update((lin) => { lin.bench = lin.bench.filter((x) => x !== id); });
  const clearSlot = (i: number) => update((lin) => { lin.slots[i] = null; });

  const candidates = squad
    .filter((p) => isAvailable(p))
    .sort((a, b) => {
      if (typeof sel === 'number') return b.overall * slotSuitability(b.role, b.hand, sel) - a.overall * slotSuitability(a.role, a.hand, sel);
      return b.overall - a.overall;
    });
  const unavailable = squad.filter((p) => p.injury != null || p.suspension > 0);
  const foreignCount = [...inUse].filter((id) => world.players[id] && isForeign(world.players[id], club)).length;

  return (
    <div>
      <PageHeader
        title="Formazione"
        subtitle={next ? `Prossima partita: ${next.label}` : 'Scegli i 7 in acqua e la panchina'}
        actions={<>
          <Button variant="outline" onClick={() => s.act((w) => { const c = w.clubs[w.userClubId]; c.lineup = autoLineup(w, c); }, 'Formazione consigliata applicata.')}>Formazione consigliata</Button>
          <Button variant="outline" onClick={() => { setSaveName(`Formazione ${club.savedLineups.length + 1}`); setSaveOpen(true); }}>Salva formazione</Button>
          <Button variant="ghost" onClick={() => s.go('tattiche')}>Tattiche →</Button>
        </>}
      />
      <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5">
        <div className="space-y-5">
          <Panel title="In acqua" subtitle="Tocca una posizione, poi scegli il giocatore dall’elenco.">
            <div className="relative water-bg rounded-xl overflow-hidden border border-line-2 aspect-[4/3.2] max-h-[560px] mx-auto">
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[28%] h-[4%] border-2 border-white/70 border-t-0 rounded-b" />
              <div className="absolute inset-x-0 top-[12%] border-t-2 border-dashed border-red-400/60" title="Linea dei 2 metri" />
              <div className="absolute inset-x-0 top-[30%] border-t-2 border-dashed border-yellow-300/60" title="Linea dei 5 metri" />
              <div className="absolute inset-x-0 bottom-[2%] border-t border-white/20" />
              {[0, 1, 2, 3, 4, 5, 6].map((slot) => {
                const id = l.slots[slot];
                const p = id ? world.players[id] : null;
                const [x, y] = POS[slot];
                const suit = p ? slotSuitability(p.role, p.hand, slot) : 1;
                return (
                  <button
                    key={slot}
                    onClick={() => setSel(sel === slot ? null : slot)}
                    className={cls('absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-24 group', sel === slot && 'z-10')}
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className={cls('rounded-2xl p-0.5 transition-all', sel === slot ? 'ring-2 ring-gold scale-110' : 'group-hover:ring-2 ring-aqua/60')}>
                      {p ? <Avatar player={p} color={club.colors[0]} size={50} /> : <div className="w-[50px] h-[50px] rounded-xl border-2 border-dashed border-white/50 flex items-center justify-center text-white/70 text-xs font-bold">{SLOT_SHORT[slot]}</div>}
                    </div>
                    <div className="mt-1 rounded-md bg-abyss/80 px-1.5 py-0.5 text-[11px] leading-tight text-center max-w-full">
                      <div className="font-semibold truncate">{p ? p.lastName : SLOT_NAMES[slot]}</div>
                      {p && <div className={cls('num', suit < 0.8 ? 'text-warn' : 'text-mute')}>{SLOT_SHORT[slot]} · {p.overall}{suit < 0.8 ? ' (fuori ruolo)' : ''}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-faint leading-relaxed">
              Posizioni d’attacco: <b className="text-mute">1</b> ala destra · <b className="text-mute">2</b> lato destro · <b className="text-mute">3</b> centrovasca · <b className="text-mute">4</b> lato sinistro · <b className="text-mute">5</b> ala sinistra · <b className="text-mute">6</b> centroboa sui 2 metri.
              I mancini rendono meglio sul lato destro (1-2). In difesa il centroboa avversario viene marcato dal giocatore con le migliori doti difensive.
            </p>
            {typeof sel === 'number' && l.slots[sel] && (
              <div className="mt-3 flex justify-between items-center text-sm">
                <span className="text-mute">Posizione selezionata: <b className="text-ink">{SLOT_LABELS[sel]}</b></span>
                <Button size="sm" variant="ghost" onClick={() => clearSlot(sel)}>Libera posizione</Button>
              </div>
            )}
          </Panel>
          <Panel title={`Panchina (${l.bench.length}/${world.rules.matchSquadSize - 7})`} actions={<Button size="sm" variant={sel === 'bench' ? 'gold' : 'outline'} onClick={() => setSel(sel === 'bench' ? null : 'bench')}>{sel === 'bench' ? 'Scegli dall’elenco…' : 'Aggiungi in panchina'}</Button>}>
            <div className="grid sm:grid-cols-2 gap-2">
              {l.bench.map((id) => {
                const p = world.players[id];
                if (!p) return null;
                return (
                  <div key={id} className="panel-flat flex items-center gap-2 px-2 py-1.5">
                    <Avatar player={p} color={club.colors[0]} size={30} />
                    <div className="flex-1 min-w-0 text-sm"><div className="font-medium truncate">{p.lastName}</div><div className="text-[11px] text-mute">{ROLE_SHORT[p.role]} · {p.overall}</div></div>
                    <button className="text-mute hover:text-bad px-1" onClick={() => removeFromBench(id)} aria-label="Togli">×</button>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="Capitano e rigoristi">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-mute mb-1">Capitano</div>
                <select className="w-full" value={l.captainId ?? ''} onChange={(e) => update((lin) => { lin.captainId = e.target.value || null; })}>
                  <option value="">—</option>
                  {[...inUse].map((id) => world.players[id]).filter(Boolean).map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs text-mute mb-1">Rigoristi (in ordine)</div>
                {[0, 1, 2, 3, 4].map((i) => (
                  <select key={i} className="w-full mb-1" value={l.penaltyTakers[i] ?? ''} onChange={(e) => update((lin) => {
                    const arr = [...lin.penaltyTakers];
                    arr[i] = e.target.value;
                    lin.penaltyTakers = arr.filter((x, k) => x && arr.indexOf(x) === k);
                  })}>
                    <option value="">{i + 1}° rigorista</option>
                    {[...inUse].map((id) => world.players[id]).filter((p) => p && p.role !== 'POR').map((p) => <option key={p.id} value={p.id}>{p.lastName} (tiro {Math.round(p.attrs.tiro)}, freddezza {Math.round(p.attrs.freddezza)})</option>)}
                  </select>
                ))}
              </div>
            </div>
          </Panel>
        </div>
        <div className="space-y-5">
          {issues.length > 0 && (
            <Panel title="Controlli">
              <ul className="space-y-1 text-sm">
                {issues.map((i, k) => <li key={k} className={i.level === 'error' ? 'text-bad' : 'text-warn'}><Icon name={i.level === 'error' ? 'cross' : 'warn'} size={14} className="inline align-[-2px] mr-1" />{i.text}</li>)}
              </ul>
            </Panel>
          )}
          <Panel title={sel == null ? 'Giocatori disponibili' : sel === 'bench' ? 'Scegli chi va in panchina' : `Scegli: ${SLOT_LABELS[sel]}`} subtitle={`Stranieri a referto: ${foreignCount}/${foreignLimit(world, club)}`}>
            <div className="space-y-1 max-h-[640px] overflow-y-auto pr-1">
              {candidates.map((p) => {
                const where = l.slots.indexOf(p.id) >= 0 ? SLOT_SHORT[l.slots.indexOf(p.id)] : l.bench.includes(p.id) ? 'PAN' : '';
                const suit = typeof sel === 'number' ? slotSuitability(p.role, p.hand, sel) : 1;
                return (
                  <button key={p.id} disabled={sel == null} onClick={() => place(p)} className={cls('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left', sel != null ? 'hover:bg-aqua/10' : 'cursor-default', where && 'opacity-70')}>
                    <Avatar player={p} color={club.colors[0]} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.firstName[0]}. {p.lastName} {p.youth && <Badge tone="violet">giovane</Badge>} {isForeign(p, club) && <Badge>straniero</Badge>}</div>
                      <div className="text-[11px] text-mute">{ROLE_SHORT[p.role]}{p.hand === 'L' ? ' · mancino' : ''} · morale {Math.round(p.morale)}</div>
                    </div>
                    <div className="w-16"><Bar value={p.condition} height={4} /></div>
                    {typeof sel === 'number' && <span className={cls('text-[11px] w-10 text-right num', suit < 0.8 ? 'text-warn' : 'text-good')}>{Math.round(suit * 100)}%</span>}
                    <Ovr v={p.overall} size="sm" />
                    <span className="w-8 text-[10px] text-aqua font-bold text-right">{where}</span>
                  </button>
                );
              })}
            </div>
            {unavailable.length > 0 && (
              <div className="mt-3 text-xs text-mute">Non disponibili: {unavailable.map((p) => `${p.lastName} (${p.injury ? 'infortunato' : 'squalificato'})`).join(', ')}</div>
            )}
          </Panel>
          {club.savedLineups.length > 0 && (
            <Panel title="Formazioni salvate">
              <ul className="space-y-1">
                {club.savedLineups.map((sl, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{sl.name}</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => s.act((w) => { const c = w.clubs[w.userClubId]; c.lineup = structuredClone(c.savedLineups[i].lineup); }, `Caricata: ${sl.name}`)}>Carica</Button>
                      <Button size="sm" variant="ghost" onClick={() => s.act((w) => { w.clubs[w.userClubId].savedLineups.splice(i, 1); })}>Elimina</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Salva formazione"
        footer={<><Button variant="ghost" onClick={() => setSaveOpen(false)}>Annulla</Button><Button onClick={() => { s.act((w) => { const c = w.clubs[w.userClubId]; c.savedLineups.push({ name: saveName.trim() || 'Formazione', lineup: structuredClone(c.lineup) }); if (c.savedLineups.length > 8) c.savedLineups.shift(); }, 'Formazione salvata.'); setSaveOpen(false); }}>Salva</Button></>}>
        <input className="w-full" value={saveName} onChange={(e) => setSaveName(e.target.value)} autoFocus />
        <p className="text-xs text-faint mt-2">Puoi salvare fino a 8 formazioni (per esempio una per le partite in casa e una in trasferta).</p>
      </Modal>
      <div className="mt-5 text-xs text-faint flex items-center gap-2"><span className="w-24"><Bar value={70} height={4} /></span> condizione fisica · la percentuale indica l’adattamento alla posizione (mano preferita inclusa: i mancini rendono meglio a destra).</div>
    </div>
  );
}
