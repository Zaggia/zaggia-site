import { useGame, useWorld } from '../../store/game';
import { Badge, Bar, Button, PageHeader, Panel } from '../components/ui';
import { FACILITIES, FACILITY_KEYS, MAX_FACILITY_LEVEL, maxFacilityLevel, upgradeCost, poolCapacity, sponsorSlots } from '../../engine/club/facilities';
import { canUpgrade, startUpgrade } from '../../engine/club/manage';
import { clubLevel, clubLevelThresholds } from '../../engine/tactics/tactics';
import { fmtMoney } from '../format';

const LEVEL_UNLOCKS = [
  'Strutture fino al livello 2 · scouting in Italia',
  'Strutture fino al livello 2',
  'Strutture fino al livello 3',
  'Strutture fino al livello 3 · più capacità organizzativa',
  'Strutture fino al livello 4',
  'Strutture fino al livello 4',
  'Strutture al livello massimo',
  'Strutture al livello massimo · grande attrattività',
  'Società di vertice',
  'Leggenda della pallanuoto',
];

export function FacilitiesScreen() {
  const world = useWorld();
  const s = useGame.getState();
  const club = world.clubs[world.userClubId];
  const lvl = clubLevel(club);
  const th = clubLevelThresholds();
  const maxLvl = maxFacilityLevel(club);
  return (
    <div className="space-y-5">
      <PageHeader title="Strutture" subtitle={`Livello società ${lvl} · costruibile fino al livello ${maxLvl}`} />
      <Panel title="Sviluppo della società" subtitle="I punti sviluppo arrivano da stagioni giocate, promozioni, trofei, coppe europee e lavori alle strutture.">
        <div className="grid grid-cols-5 lg:grid-cols-10 gap-2 pt-1">
          {th.map((t, i) => (
            <div key={i} className={`rounded-lg border p-2 text-center ${i + 1 === lvl ? 'border-gold bg-gold/10' : i + 1 < lvl ? 'border-good/40 bg-good/5' : 'border-line'}`}>
              <div className="font-display text-xl font-bold">{i + 1}</div>
              <div className="text-[10px] text-mute num">{t} pt</div>
              <div className="text-[10px] text-faint leading-tight mt-1 hidden lg:block">{LEVEL_UNLOCKS[i]}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm text-mute">Punti attuali: <b className="text-ink num">{club.devPoints}</b></div>
      </Panel>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {FACILITY_KEYS.map((k) => {
          const info = FACILITIES[k];
          const f = club.facilities[k];
          const err = canUpgrade(world, club, k);
          const cost = f.level < MAX_FACILITY_LEVEL ? upgradeCost(club, k) : 0;
          return (
            <Panel key={k} title={info.name} actions={<Badge tone="aqua">Livello {f.level}/{MAX_FACILITY_LEVEL}</Badge>}>
              <p className="text-xs text-mute">{info.desc}</p>
              <div className="flex gap-1 my-3">
                {Array.from({ length: MAX_FACILITY_LEVEL }).map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < f.level ? 'bg-aqua' : i < maxLvl ? 'bg-white/15' : 'bg-white/5'}`} />)}
              </div>
              <div className="text-sm font-semibold">{info.levels[f.level - 1]}</div>
              <div className="text-xs text-good mt-1">{info.effect(f.level)}</div>
              <div className="text-xs text-mute mt-1">Gestione: {fmtMoney(info.upkeep(f.level))} / anno</div>
              {f.upgrading ? (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1"><span>Lavori in corso</span><span className="num">{f.upgrading.daysLeft} giorni</span></div>
                  <Bar value={f.upgrading.totalDays - f.upgrading.daysLeft} max={f.upgrading.totalDays} color="#f5c518" />
                </div>
              ) : f.level < MAX_FACILITY_LEVEL ? (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="text-xs text-mute">Prossimo livello: <span className="text-ink">{info.levels[f.level]}</span></div>
                  <div className="text-xs text-mute">{info.effect(f.level + 1)} · gestione {fmtMoney(info.upkeep(f.level + 1))}/anno</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-display text-lg font-bold">{fmtMoney(cost)}</span>
                    <Button size="sm" disabled={!!err} title={err ?? undefined} onClick={() => s.act((w) => startUpgrade(w, w.clubs[w.userClubId], k), 'Lavori avviati!')}>Amplia ({info.days(f.level + 1)} giorni)</Button>
                  </div>
                  {err && <div className="text-[11px] text-warn mt-1">{err}</div>}
                </div>
              ) : <div className="mt-3 text-xs text-gold">Livello massimo raggiunto.</div>}
            </Panel>
          );
        })}
      </div>
      <Panel title="Effetti concreti">
        <ul className="text-sm text-mute grid md:grid-cols-2 gap-x-6 gap-y-1">
          <li>• Piscina: {poolCapacity(club.facilities.piscina.level)} posti, più spettatori, più incassi e scuola nuoto.</li>
          <li>• Centro di allenamento: crescita dei giocatori e capacità di imparare tattiche avanzate.</li>
          <li>• Palestra: crescita fisica, declino più lento, meno infortuni in allenamento.</li>
          <li>• Centro medico: recupero più rapido da infortuni e fatica.</li>
          <li>• Settore giovanile: più ragazzi e più talento ogni anno.</li>
          <li>• Centro scouting: valutazioni più precise e visibilità dei club esteri.</li>
          <li>• Uffici: sponsor più ricchi, merchandising e {sponsorSlots(club.facilities.uffici.level)} spazi sponsor.</li>
        </ul>
      </Panel>
    </div>
  );
}
