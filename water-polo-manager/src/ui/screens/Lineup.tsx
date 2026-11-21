import { Icon, GameIcon } from '../components/icons';
import { ROLE_COLOR } from '../components/game';
import { useEffect, useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Avatar } from '../components/Avatar';
import { Badge, Bar, Button, Modal, Ovr, PageHeader, Panel } from '../components/ui';
import { SLOT_LABELS, SLOT_NAMES, SLOT_SHORT, slotSuitability, ROLE_SHORT } from '../../engine/player/attributes';
import { autoLineup, expectedMinutes, isAvailable, minutesPlan, validateLineup, isForeign } from '../../engine/club/lineup';
import type { Lineup, Player } from '../../engine/types';
import { cls } from '../format';
import { nextFixture } from '../../engine/world/queries';

const POS: Record<number, [number, number]> = {
  6: [50, 17], 1: [86, 24], 5: [14, 24], 2: [74, 50], 4: [26, 50], 3: [50, 58], 0: [50, 86],
};

function useSmallScreen(): boolean {
  const q = '(max-width: 639px)';
  const [small, setSmall] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setSmall(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return small;
}

export function LineupScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const l = club.lineup;
  const [sel, setSel] = useState<number | 'bench' | null>(null);
  const small = useSmallScreen();
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

  const plan = minutesPlan(world, l);
  const totalPlanned = l.bench.reduce((t, id) => t + (plan[id] ?? 0), 0);
  const removeFromBench = (id: string) => update((lin) => { lin.bench = lin.bench.filter((x) => x !== id); });
  const clearSlot = (i: number) => update((lin) => { lin.slots[i] = null; });

  const candidates = squad
    .filter((p) => isAvailable(p))
    .sort((a, b) => {
      if (typeof sel === 'number') return b.overall * slotSuitability(b.role, b.hand, sel) - a.overall * slotSuitability(a.role, a.hand, sel);
      return b.overall - a.overall;
    });
  const unavailable = squad.filter((p) => p.injury != null);

  return (
    <div>
      <PageHeader
        title="Formazione"
        subtitle={next ? `Prossima partita: ${next.label}` : 'Scegli i 7 in acqua e la panchina'}
        icon={<GameIcon name="tactics" size={56} />}
        actions={<>
          <Button variant="gold" icon="spark" title="Il gioco sceglie i migliori 7 e la panchina per te" onClick={() => s.act((w) => { const c = w.clubs[w.userClubId]; c.lineup = autoLineup(w, c); }, 'Formazione consigliata applicata.')}>Formazione consigliata</Button>
          <Button variant="outline" icon="save" onClick={() => { setSaveName(`Formazione ${club.savedLineups.length + 1}`); setSaveOpen(true); }}>Salva formazione</Button>
          <Button variant="primary" icon="tattiche" onClick={() => s.go('tattiche')}>Vai alle tattiche</Button>
        </>}
      />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5">
        <div className="space-y-5 min-w-0">
          <Panel icon="formazione" title="In acqua" subtitle="1) Tocca una posizione nella vasca  2) Scegli il giocatore dall’elenco a destra.">
            <div className="relative water-bg rounded-3xl overflow-hidden border-4 border-[#e8f6ff]/80 shadow-[0_0_0_4px_rgba(10,40,90,0.6),inset_0_0_60px_rgba(0,40,90,0.5)] aspect-[4/5] sm:aspect-[4/3.2] sm:max-h-[580px] mx-auto">
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[28%] h-[4%] border-4 border-white border-t-0 rounded-b-xl bg-white/10" />
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
                    title={`${SLOT_LABELS[slot]}${p ? ': ' + p.firstName + ' ' + p.lastName : ': tocca per scegliere'}`}
                    className={cls('absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-24 sm:w-28 group transition-transform', sel === slot ? 'z-10 scale-110' : 'hover:scale-105')}
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className={cls('relative rounded-full transition-all', sel === slot && 'ring-4 ring-gold ring-offset-2 ring-offset-transparent animate-pulse')}>
                      {p ? <Avatar player={p} color={club.colors[0]} size={small ? 50 : 66} /> : (
                        <div className="w-[50px] h-[50px] sm:w-[66px] sm:h-[66px] rounded-full border-[3px] border-dashed border-white/80 bg-white/15 flex flex-col items-center justify-center text-white">
                          <span className="font-display text-2xl font-extrabold leading-none">{SLOT_SHORT[slot]}</span>
                          <span className="text-[9px] font-bold uppercase leading-none mt-0.5">tocca</span>
                        </div>
                      )}
                      <span className="absolute -top-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#06223f] border-2 border-white text-[11px] font-extrabold text-white">{SLOT_SHORT[slot]}</span>
                    </div>
                    <div className="mt-1.5 rounded-full bg-[#06223f]/90 border border-white/25 px-2.5 py-0.5 text-[12px] leading-tight text-center max-w-full shadow-lg">
                      <div className="font-bold truncate">{p ? p.lastName : SLOT_NAMES[slot]}</div>
                      {p && <div className={cls('num font-semibold', suit < 0.8 ? 'text-warn' : 'text-aqua')}>{p.overall}{suit < 0.8 ? ' · fuori ruolo' : ''}</div>}
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
                <Button size="sm" variant="danger" icon="cross" onClick={() => clearSlot(sel)}>Libera posizione</Button>
              </div>
            )}
          </Panel>
          <Panel
            title={`Panchina (${l.bench.length}/${world.rules.matchSquadSize - 7})`}
            subtitle={<>Decidi quanto gioca ogni panchinaro: l’allenatore lo fa entrare a gioco fermo per rispettare i minuti, anche quando simuli la partita. Minuti previsti alla panchina: <b className="text-ink">{totalPlanned}</b> (il resto dei 224 della gara tocca ai titolari).</>}
            icon="rosa" actions={<Button size="sm" variant={sel === 'bench' ? 'gold' : 'success'} icon={sel === 'bench' ? 'next' : 'check'} onClick={() => setSel(sel === 'bench' ? null : 'bench')}>{sel === 'bench' ? 'Scegli dall’elenco…' : 'Aggiungi in panchina'}</Button>}
          >
            <div className="grid sm:grid-cols-2 gap-2">
              {l.bench.map((id) => {
                const p = world.players[id];
                if (!p) return null;
                const planned = plan[id] ?? 0;
                const wanted = expectedMinutes(p);
                const chosen = l.minutes?.[id] != null;
                const diff = planned - wanted;
                return (
                  <div key={id} className="panel-flat px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar player={p} color={club.colors[0]} size={44} cap={false} />
                      <div className="flex-1 min-w-0 text-sm"><div className="font-medium truncate">{p.lastName}</div><div className="text-[11px] text-mute">{ROLE_SHORT[p.role]} · {p.overall}</div></div>
                      <button className="press flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-mute hover:bg-bad hover:text-white" title="Togli dalla panchina" onClick={() => removeFromBench(id)} aria-label="Togli"><Icon name="cross" size={14} weight="bold" /></button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-[11px] text-mute shrink-0" htmlFor={`min-${id}`}>Minuti</label>
                      <select
                        id={`min-${id}`}
                        className="flex-1 min-w-0 h-10 text-sm"
                        value={chosen ? String(l.minutes![id]) : 'auto'}
                        onChange={(e) => update((lin) => {
                          const m = { ...(lin.minutes ?? {}) };
                          if (e.target.value === 'auto') delete m[id]; else m[id] = Number(e.target.value);
                          lin.minutes = m;
                        })}
                      >
                        <option value="auto">Consigliato ({Math.min(p.role === 'POR' ? 8 : 24, wanted)} min)</option>
                        {[0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24].map((m) => <option key={m} value={m}>{m === 0 ? 'Non gioca (solo emergenze)' : `${m} minuti`}</option>)}
                      </select>
                    </div>
                    <div className={cls('text-[11px] mt-1', diff < -3 ? 'text-warn' : 'text-faint')}>
                      Si aspetta circa {wanted} min{diff < -3 ? ': giocando meno rischia di scontentarsi' : ''}.
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel icon="star" title="Capitano e rigoristi">
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
        <div className="space-y-5 min-w-0">
          {issues.length > 0 && (
            <Panel icon="warn" title="Controlli">
              <ul className="space-y-1 text-sm">
                {issues.map((i, k) => <li key={k} className={i.level === 'error' ? 'text-bad' : 'text-warn'}><Icon name={i.level === 'error' ? 'cross' : 'warn'} size={14} className="inline align-[-2px] mr-1" />{i.text}</li>)}
              </ul>
            </Panel>
          )}
          <Panel icon="rosa" title={sel == null ? 'Giocatori disponibili' : sel === 'bench' ? 'Scegli chi va in panchina' : `Scegli: ${SLOT_LABELS[sel]}`} subtitle="Nessun limite di stranieri: schiera chi vuoi.">
            <div className="space-y-1.5 max-h-[680px] overflow-y-auto pr-1">
              {candidates.map((p) => {
                const where = l.slots.indexOf(p.id) >= 0 ? SLOT_SHORT[l.slots.indexOf(p.id)] : l.bench.includes(p.id) ? 'PAN' : '';
                const suit = typeof sel === 'number' ? slotSuitability(p.role, p.hand, sel) : 1;
                return (
                  <button key={p.id} disabled={sel == null} onClick={() => place(p)} className={cls('w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-left border-2 border-white/[0.07] bg-white/[0.04] transition-colors', sel != null ? 'hover:bg-aqua/15 hover:border-aqua/60 active:scale-[0.99]' : 'cursor-default', where && 'opacity-60')}>
                    <Avatar player={p} color={club.colors[0]} size={46} cap={false} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-bold truncate">{p.firstName[0]}. {p.lastName} {p.youth && <Badge tone="violet">giovane</Badge>} {isForeign(p, club) && <Badge>straniero</Badge>}</div>
                      <div className="text-[12px] text-mute flex items-center gap-1.5"><span className="rounded-full px-1.5 text-[10.5px] font-extrabold text-[#06223f]" style={{ background: ROLE_COLOR[p.role] }}>{ROLE_SHORT[p.role]}</span>{p.hand === 'L' ? 'mancino · ' : ''}morale {Math.round(p.morale)}</div>
                    </div>
                    <div className="hidden sm:block w-16"><Bar value={p.condition} height={6} /></div>
                    {typeof sel === 'number' && <span className={cls('text-[11px] w-10 text-right num', suit < 0.8 ? 'text-warn' : 'text-good')}>{Math.round(suit * 100)}%</span>}
                    <Ovr v={p.overall} size="sm" />
                    <span className={cls('w-9 text-[11px] font-extrabold text-center rounded-full', where ? 'bg-aqua text-[#032a3a]' : '')}>{where}</span>
                  </button>
                );
              })}
            </div>
            {unavailable.length > 0 && (
              <div className="mt-3 text-xs text-mute">Non disponibili: {unavailable.map((p) => `${p.lastName} (infortunato)`).join(', ')}</div>
            )}
          </Panel>
          {club.savedLineups.length > 0 && (
            <Panel icon="save" title="Formazioni salvate">
              <ul className="space-y-1">
                {club.savedLineups.map((sl, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{sl.name}</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="success" icon="check" onClick={() => s.act((w) => { const c = w.clubs[w.userClubId]; c.lineup = structuredClone(c.savedLineups[i].lineup); }, `Caricata: ${sl.name}`)}>Carica</Button>
                      <Button size="sm" variant="danger" icon="cross" onClick={() => s.act((w) => { w.clubs[w.userClubId].savedLineups.splice(i, 1); })}>Elimina</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Salva formazione"
        footer={<><Button variant="outline" onClick={() => setSaveOpen(false)}>Annulla</Button><Button variant="success" icon="save" onClick={() => { s.act((w) => { const c = w.clubs[w.userClubId]; c.savedLineups.push({ name: saveName.trim() || 'Formazione', lineup: structuredClone(c.lineup) }); if (c.savedLineups.length > 8) c.savedLineups.shift(); }, 'Formazione salvata.'); setSaveOpen(false); }}>Salva</Button></>}>
        <input className="w-full" value={saveName} onChange={(e) => setSaveName(e.target.value)} autoFocus />
        <p className="text-xs text-faint mt-2">Puoi salvare fino a 8 formazioni (per esempio una per le partite in casa e una in trasferta).</p>
      </Modal>
      <div className="mt-5 text-xs text-faint flex items-center gap-2"><span className="w-24"><Bar value={70} height={4} /></span> condizione fisica · la percentuale indica l’adattamento alla posizione (mano preferita inclusa: i mancini rendono meglio a destra).</div>
    </div>
  );
}
