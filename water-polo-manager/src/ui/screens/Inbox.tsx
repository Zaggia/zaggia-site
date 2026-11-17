import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Badge, Button, Empty, PageHeader, Panel } from '../components/ui';
import { resolveEvent } from '../../engine/events/events';
import { worldRng } from '../../engine/world/context';
import type { GameEvent, InboxCategory, InboxMessage } from '../../engine/types';
import { cls, formatDate, formatShortDate } from '../format';
import type { ViewName } from '../../store/game';

const CAT_LABELS: Record<InboxCategory, string> = {
  notizia: 'Notizie', mercato: 'Mercato', partita: 'Partite', finanze: 'Finanze', staff: 'Staff', giovani: 'Giovani', sponsor: 'Sponsor',
  evento: 'Eventi', infortuni: 'Infermeria', societa: 'Società', contratti: 'Contratti',
};

export function InboxScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const param = useGame((st) => st.param);
  const [cat, setCat] = useState<InboxCategory | 'tutte'>('tutte');
  const [selected, setSelected] = useState<string | null>(param && param !== 'decisioni' ? param : null);
  const pending = world.events.filter((e) => !e.resolved);
  const list = world.inbox.filter((m) => cat === 'tutte' || m.category === cat);
  const msg = selected ? world.inbox.find((m) => m.id === selected) : null;
  if (msg && !msg.read) { msg.read = true; }
  return (
    <div className="space-y-5">
      <PageHeader title="Posta e decisioni" subtitle={`${world.inbox.filter((m) => !m.read).length} messaggi da leggere`} actions={<Button variant="outline" onClick={() => s.act((w) => { for (const m of w.inbox) m.read = true; })}>Segna tutto come letto</Button>} />
      {pending.length > 0 && (
        <Panel title="Decisioni del presidente" subtitle="Le decisioni urgenti bloccano l’avanzamento finché non scegli.">
          <div className="grid lg:grid-cols-2 gap-4">
            {pending.map((e) => <EventCard key={e.id} ev={e} />)}
          </div>
        </Panel>
      )}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5">
        <Panel title="Messaggi">
          <div className="flex flex-wrap gap-1 mb-3">
            {(['tutte', ...Object.keys(CAT_LABELS)] as (InboxCategory | 'tutte')[]).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cls('px-2 py-0.5 rounded text-xs border', cat === c ? 'border-aqua text-aqua' : 'border-line text-mute')}>{c === 'tutte' ? 'Tutte' : CAT_LABELS[c]}</button>
            ))}
          </div>
          <ul className="space-y-1 max-h-[640px] overflow-y-auto pr-1">
            {list.map((m) => (
              <li key={m.id}>
                <button onClick={() => { setSelected(m.id); s.touch(); }} className={cls('w-full text-left rounded-lg px-3 py-2 border', selected === m.id ? 'border-aqua bg-aqua/5' : 'border-transparent hover:bg-white/[0.03]')}>
                  <div className="flex items-center gap-2">
                    {!m.read && <span className="w-2 h-2 rounded-full bg-aqua shrink-0" />}
                    <span className={cls('text-sm truncate flex-1', !m.read && 'font-semibold', m.important && 'text-gold')}>{m.title}</span>
                    <span className="text-[10px] text-faint num">{formatShortDate(m.season, m.day)}</span>
                  </div>
                  <div className="text-xs text-mute truncate mt-0.5">{CAT_LABELS[m.category]} · {m.body}</div>
                </button>
              </li>
            ))}
            {!list.length && <Empty>Nessun messaggio.</Empty>}
          </ul>
        </Panel>
        <Panel title={msg ? msg.title : 'Seleziona un messaggio'}>
          {msg ? <MessageView m={msg} /> : <Empty>Scegli un messaggio dall’elenco.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

function MessageView({ m }: { m: InboxMessage }) {
  const world = useWorld();
  const s = useGame.getState();
  const ev = m.eventId ? world.events.find((e) => e.id === m.eventId) : null;
  return (
    <div>
      <div className="text-xs text-mute mb-3 capitalize">{formatDate(m.season, m.day, true)} · <Badge>{CAT_LABELS[m.category]}</Badge></div>
      <p className="text-sm leading-relaxed whitespace-pre-line">{m.body}</p>
      {ev && <div className="mt-4"><EventCard ev={ev} /></div>}
      <div className="flex flex-wrap gap-2 mt-4">
        {m.link && <Button size="sm" variant="outline" onClick={() => s.go(m.link!.view as ViewName, m.link!.id)}>Apri</Button>}
        {m.offerId && <Button size="sm" onClick={() => s.go('mercato', 'offerte')}>Vai alle offerte</Button>}
      </div>
    </div>
  );
}

export function EventCard({ ev }: { ev: GameEvent }) {
  const world = useWorld();
  const s = useGame.getState();
  const [outcome, setOutcome] = useState<string | null>(ev.outcome ?? null);
  return (
    <div className={cls('panel-flat p-4', !ev.resolved && ev.blocking && 'border-gold/50')}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-display text-lg font-bold">{ev.title}</div>
        {!ev.resolved && (ev.blocking ? <Badge tone="gold">Urgente</Badge> : ev.expiresDay ? <Badge>Entro il {formatShortDate(world.season, ev.expiresDay)}</Badge> : null)}
      </div>
      <p className="text-sm text-mute mt-1">{ev.body}</p>
      {!ev.resolved ? (
        <div className="grid gap-2 mt-3">
          {ev.choices.map((c) => (
            <button key={c.id} disabled={c.disabled} onClick={() => { const out = resolveEvent(world, ev.id, c.id, worldRng(world)); setOutcome(out); s.toast(out, 'info'); s.touch(); }}
              className="text-left rounded-lg border border-line-2 hover:border-aqua hover:bg-aqua/5 px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <div className="text-sm font-semibold">{c.label}</div>
              {c.hint && <div className="text-xs text-mute">{c.hint}</div>}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm"><Badge tone="aqua">Decisione presa</Badge> <span className="text-mute">{outcome}</span></div>
      )}
    </div>
  );
}

export function NewsScreen() {
  const world = useWorld();
  return (
    <div>
      <PageHeader title="Notizie" subtitle="Quello che succede nel mondo della pallanuoto" />
      <div className="grid md:grid-cols-2 gap-4">
        {world.news.map((n) => (
          <div key={n.id} className="panel p-4 fade-in">
            <div className="flex justify-between gap-2 text-xs text-mute"><Badge tone={n.tag === 'trofeo' ? 'gold' : n.tag === 'mercato' ? 'aqua' : n.tag === 'retrocessione' ? 'bad' : n.tag === 'promozione' ? 'good' : 'neutral'}>{n.tag}</Badge><span className="capitalize">{formatDate(n.season, n.day)}</span></div>
            <div className="font-display text-lg font-bold mt-2">{n.title}</div>
            <p className="text-sm text-mute mt-1">{n.body}</p>
          </div>
        ))}
        {!world.news.length && <Empty>Nessuna notizia.</Empty>}
      </div>
    </div>
  );
}
