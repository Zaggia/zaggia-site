import { useState } from 'react';
import { useGame, useWorld } from '../../store/game';
import { Crest } from '../components/Crest';
import { Badge, Button, PageHeader, Panel } from '../components/ui';
import { FixtureLine } from '../components/game';
import { dateOf, dayOf, monthName, seasonLength } from '../../engine/calendar';
import { clubFixtures } from '../../engine/world/queries';
import { cls } from '../format';
import type { Fixture } from '../../engine/types';

const WD = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export function CalendarScreen() {
  const world = useWorld();
  const go = useGame((s) => s.go);
  const club = world.clubs[world.userClubId];
  const today = dateOf(world.season, world.day);
  const [monthIdx, setMonthIdx] = useState(() => (today.getUTCMonth() + 6) % 12);
  const [list, setList] = useState(false);
  const fixtures = clubFixtures(world, club.id).filter((f) => !f.ifNeeded || f.played);
  const byDay = new Map<number, Fixture[]>();
  for (const f of fixtures) byDay.set(f.day, [...(byDay.get(f.day) ?? []), f]);
  const keyDates = new Map<number, string[]>();
  const addKey = (d: number, t: string) => keyDates.set(d, [...(keyDates.get(d) ?? []), t]);
  for (const w of world.rules.windows) { addKey(dayOf(world.season, w.start), `Apre ${w.name.toLowerCase()}`); addKey(dayOf(world.season, w.end), `Chiude ${w.name.toLowerCase()}`); }
  addKey(dayOf(world.season, world.rules.licenseCheckDate), 'Controllo licenza nazionale');
  addKey(dayOf(world.season, '09-01'), 'Campagna abbonamenti');
  addKey(dayOf(world.season, world.rules.youthIntakeDate), 'Arrivo dei nuovi giovani');
  addKey(seasonLength(world.season) - 1, 'Fine stagione');
  const calMonth = (monthIdx + 6) % 12;
  const year = calMonth >= 6 ? world.season : world.season + 1;
  const first = new Date(Date.UTC(year, calMonth, 1));
  const daysIn = new Date(Date.UTC(year, calMonth + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const seasonDayOf = (d: number) => Math.round((Date.UTC(year, calMonth, d) - Date.UTC(world.season, 6, 1)) / 86_400_000);
  return (
    <div>
      <PageHeader title="Calendario" subtitle={`Stagione ${world.season}/${(world.season + 1) % 100}`} actions={<Button variant="outline" onClick={() => setList(!list)}>{list ? 'Vista mensile' : 'Elenco partite'}</Button>} />
      {list ? (
        <Panel>
          <div className="pt-2">{fixtures.map((f) => <FixtureLine key={f.id} world={world} f={f} onClick={() => f.reportId && go('report', f.reportId)} />)}</div>
        </Panel>
      ) : (
        <Panel>
          <div className="flex items-center justify-between py-3">
            <Button size="sm" variant="ghost" disabled={monthIdx === 0} onClick={() => setMonthIdx(monthIdx - 1)}>◀</Button>
            <div className="font-display text-2xl font-bold uppercase">{monthName(calMonth)} {year}</div>
            <Button size="sm" variant="ghost" disabled={monthIdx === 11} onClick={() => setMonthIdx(monthIdx + 1)}>▶</Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-faint uppercase text-center mb-1">{WD.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
            {Array.from({ length: daysIn }).map((_, i) => {
              const sd = seasonDayOf(i + 1);
              const fx = byDay.get(sd) ?? [];
              const keys = keyDates.get(sd) ?? [];
              const isToday = sd === world.day;
              const past = sd < world.day;
              return (
                <div key={i} className={cls('min-h-[84px] rounded-lg border p-1.5 text-xs', isToday ? 'border-aqua bg-aqua/10' : 'border-line/60', past && 'opacity-60')}>
                  <div className={cls('font-semibold num', isToday && 'text-aqua')}>{i + 1}</div>
                  {fx.map((f) => {
                    const home = f.homeId === club.id;
                    const opp = world.clubs[home ? f.awayId : f.homeId];
                    const us = home ? f.hg : f.ag;
                    const them = home ? f.ag : f.hg;
                    return (
                      <button key={f.id} onClick={() => f.reportId && go('report', f.reportId)} className="mt-1 w-full flex items-center gap-1 rounded bg-white/[0.05] px-1 py-0.5 text-left" title={f.label}>
                        <Crest spec={opp.crest} size={14} />
                        <span className="truncate flex-1">{home ? '' : '@'}{opp.short}</span>
                        {f.played && <span className={cls('font-bold num', us > them ? 'text-good' : us < them ? 'text-bad' : 'text-mute')}>{us}-{them}</span>}
                      </button>
                    );
                  })}
                  {keys.map((k) => <div key={k} className="mt-1 text-[10px] text-gold leading-tight">{k}</div>)}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-xs text-mute">
            <Badge tone="aqua">Oggi</Badge><span>@ = in trasferta</span><span className="text-gold">Date chiave della stagione</span>
          </div>
        </Panel>
      )}
    </div>
  );
}
