import { useEffect, useState } from 'react';
import { useGame, type ViewName } from '../store/game';
import { MainMenu } from './screens/MainMenu';
import { Icon } from './components/icons';
import { Crest } from './components/Crest';
import { cls, fmtMoney, formatDate, seasonLabel } from './format';
import { blocker } from '../engine/season/advance';
import { Logo, LogoMark } from './components/Logo';
import { transferWindowOpen } from '../engine/transfer/market';
import { Dashboard } from './screens/Dashboard';
import { Squad } from './screens/Squad';
import { LineupScreen } from './screens/Lineup';
import { TacticsScreen } from './screens/Tactics';
import { MatchesScreen } from './screens/Matches';
import { CalendarScreen } from './screens/Calendar';
import { StandingsScreen } from './screens/Standings';
import { MarketScreen } from './screens/Market';
import { StaffScreen } from './screens/Staff';
import { YouthScreen } from './screens/Youth';
import { FacilitiesScreen } from './screens/Facilities';
import { FinanceScreen } from './screens/Finance';
import { SponsorScreen } from './screens/Sponsors';
import { CompetitionsScreen } from './screens/Competitions';
import { HistoryScreen } from './screens/History';
import { InboxScreen, NewsScreen } from './screens/Inbox';
import { PlayerScreen } from './screens/Player';
import { ClubScreen } from './screens/Club';
import { MatchLive } from './screens/MatchLive';
import { ReportScreen } from './screens/Report';
import { ReviewScreen } from './screens/Review';
import { SettingsScreen } from './screens/Settings';
import { divisionOf } from '../engine/world/queries';

const NAV: { view: ViewName; label: string; icon: string }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { view: 'rosa', label: 'Rosa', icon: 'rosa' },
  { view: 'formazione', label: 'Formazione', icon: 'formazione' },
  { view: 'tattiche', label: 'Tattiche', icon: 'tattiche' },
  { view: 'partite', label: 'Partite', icon: 'partite' },
  { view: 'calendario', label: 'Calendario', icon: 'calendario' },
  { view: 'classifica', label: 'Classifica', icon: 'classifica' },
  { view: 'mercato', label: 'Calciomercato', icon: 'mercato' },
  { view: 'staff', label: 'Allenatore e staff', icon: 'staff' },
  { view: 'giovani', label: 'Settore giovanile', icon: 'giovani' },
  { view: 'strutture', label: 'Strutture', icon: 'strutture' },
  { view: 'finanze', label: 'Finanze', icon: 'finanze' },
  { view: 'sponsor', label: 'Sponsor', icon: 'sponsor' },
  { view: 'competizioni', label: 'Competizioni', icon: 'competizioni' },
  { view: 'storia', label: 'Storia del club', icon: 'storia' },
];

export function App() {
  const world = useGame((s) => s.world);
  const busy = useGame((s) => s.busy);
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const s = useGame.getState();
    void s.refreshCareers();
    void s.resumeLast().finally(() => setBooted(true));
  }, []);
  return (
    <>
      {!booted ? <Splash /> : world ? <Shell /> : <MainMenu />}
      {busy && <BusyOverlay text={busy} />}
      <Toasts />
    </>
  );
}

function Splash() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Logo size="lg" stacked />
        <div className="wave h-3 mt-6 w-64 mx-auto" />
      </div>
    </div>
  );
}

function BusyOverlay({ text }: { text: string }) {
  const world = useGame((s) => s.world);
  useGame((s) => s.v);
  return (
    <div className="fixed inset-0 z-[60] bg-abyss/70 backdrop-blur-[2px] flex items-center justify-center">
      <div className="panel px-8 py-6 text-center min-w-[280px]">
        <div className="wave h-3 w-48 mx-auto mb-4" />
        <div className="font-semibold">{text}</div>
        {world && <div className="text-mute text-sm mt-1 num">{formatDate(world.season, world.day, true)}</div>}
      </div>
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cls(
            'fade-in pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur',
            t.kind === 'err' ? 'bg-bad/20 border-bad/50 text-red-100' : t.kind === 'ok' ? 'bg-good/15 border-good/40 text-green-100' : 'bg-panel/95 border-line-2 text-ink',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Shell() {
  const view = useGame((s) => s.view);
  const menuOpen = useGame((s) => s.menuOpen);
  const setMenu = useGame((s) => s.setMenu);
  return (
    <div className="min-h-full flex">
      <Sidebar />
      {menuOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMenu(false)} />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-4 sm:px-6 py-5 max-w-[1500px] w-full mx-auto">
          <View view={view} />
        </main>
      </div>
    </div>
  );
}

function View({ view }: { view: ViewName }) {
  switch (view) {
    case 'dashboard': return <Dashboard />;
    case 'rosa': return <Squad />;
    case 'formazione': return <LineupScreen />;
    case 'tattiche': return <TacticsScreen />;
    case 'partite': return <MatchesScreen />;
    case 'calendario': return <CalendarScreen />;
    case 'classifica': return <StandingsScreen />;
    case 'mercato': return <MarketScreen />;
    case 'staff': return <StaffScreen />;
    case 'giovani': return <YouthScreen />;
    case 'strutture': return <FacilitiesScreen />;
    case 'finanze': return <FinanceScreen />;
    case 'sponsor': return <SponsorScreen />;
    case 'competizioni': return <CompetitionsScreen />;
    case 'storia': return <HistoryScreen />;
    case 'posta': return <InboxScreen />;
    case 'notizie': return <NewsScreen />;
    case 'player': return <PlayerScreen />;
    case 'club': return <ClubScreen />;
    case 'match': return <MatchLive />;
    case 'report': return <ReportScreen />;
    case 'review': return <ReviewScreen />;
    case 'impostazioni': return <SettingsScreen />;
    default: return <Dashboard />;
  }
}

function Sidebar() {
  const world = useGame((s) => s.world)!;
  useGame((s) => s.v);
  const view = useGame((s) => s.view);
  const go = useGame((s) => s.go);
  const menuOpen = useGame((s) => s.menuOpen);
  const club = world.clubs[world.userClubId];
  const unread = world.inbox.filter((m) => !m.read).length;
  const pending = world.events.filter((e) => !e.resolved).length;
  return (
    <aside
      className={cls(
        'fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 flex flex-col border-r border-line bg-night/95 backdrop-blur transition-transform lg:translate-x-0',
        menuOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <button className="flex items-center gap-3 px-4 py-4 border-b border-line text-left" onClick={() => go('dashboard')}>
        <Crest spec={club.crest} size={38} />
        <div className="min-w-0">
          <div className="font-display font-bold text-lg leading-tight truncate">{club.name}</div>
          <div className="text-xs text-mute truncate">{divisionOf(world, club)} · {seasonLabel(world.season)}</div>
        </div>
      </button>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((n, i) => (
          <button
            key={n.view}
            onClick={() => go(n.view)}
            className={cls(
              'w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors relative',
              view === n.view ? 'text-aqua bg-aqua/[0.08]' : 'text-mute hover:text-ink hover:bg-white/[0.03]',
            )}
          >
            {view === n.view && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-aqua" />}
            <span className="w-5 text-[10px] text-faint num">{i + 1}</span>
            <Icon name={n.icon} />
            <span className="truncate">{n.label}</span>
          </button>
        ))}
        <div className="border-t border-line my-2" />
        <SideLink view="posta" label="Posta e decisioni" icon="posta" badge={pending || unread} hot={pending > 0} />
        <SideLink view="notizie" label="Notizie" icon="notizie" />
        <SideLink view="impostazioni" label="Salvataggi" icon="save" />
      </nav>
      <div className="px-4 py-3 border-t border-line flex items-center gap-2.5">
        <LogoMark size={26} />
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[13px] font-extrabold tracking-wide">WATER POLO <span className="text-aqua">MANAGER</span></div>
          <div className="text-[10px] text-faint truncate">Presidente {world.presidentName}</div>
        </div>
      </div>
    </aside>
  );
}

function SideLink({ view, label, icon, badge, hot }: { view: ViewName; label: string; icon: string; badge?: number; hot?: boolean }) {
  const cur = useGame((s) => s.view);
  const go = useGame((s) => s.go);
  return (
    <button
      onClick={() => go(view)}
      className={cls('w-full flex items-center gap-3 px-4 py-2 text-sm font-medium', cur === view ? 'text-aqua bg-aqua/[0.08]' : 'text-mute hover:text-ink hover:bg-white/[0.03]')}
    >
      <span className="w-5" />
      <Icon name={icon} />
      <span className="flex-1 text-left truncate">{label}</span>
      {!!badge && <span className={cls('rounded-full px-1.5 text-[10px] font-bold', hot ? 'bg-bad text-white' : 'bg-aqua/20 text-aqua')}>{badge}</span>}
    </button>
  );
}

function TopBar() {
  const world = useGame((s) => s.world)!;
  useGame((s) => s.v);
  const s = useGame.getState();
  const [open, setOpen] = useState(false);
  const club = world.clubs[world.userClubId];
  const b = blocker(world);
  const win = transferWindowOpen(world);
  const label = !b ? 'Continua' : b.reason === 'match' ? 'Giorno partita' : b.reason === 'roster' ? 'Sistema la rosa' : b.reason === 'event' ? 'Decisione richiesta' : b.reason === 'review' ? 'Fine stagione' : 'Game over';
  const shortLabel = !b ? 'Avanti' : b.reason === 'match' ? 'Partita' : b.reason === 'roster' ? 'Rosa' : b.reason === 'event' ? 'Decidi' : b.reason === 'review' ? 'Fine' : 'Fine';
  const onMain = () => {
    if (b?.reason === 'match') s.go('partite');
    else if (b?.reason === 'roster') { s.go('rosa'); s.toast(b.text, 'err'); }
    else if (b?.reason === 'event') s.go('posta', 'decisioni');
    else if (b?.reason === 'review' || b?.reason === 'gameover') s.go('review');
    else void s.continueGame('auto');
  };
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-night/85 backdrop-blur">
      <div className="flex items-center gap-3 px-3 sm:px-6 h-16 max-w-[1500px] mx-auto">
        <button className="lg:hidden text-mute hover:text-ink p-1" onClick={() => s.setMenu(true)} aria-label="Menu">
          <Icon name="menu" size={22} />
        </button>
        {s.stack.length > 0 && (
          <button className="hidden sm:block text-mute hover:text-ink p-1" onClick={() => s.back()} title="Indietro" aria-label="Indietro">
            <Icon name="back" />
          </button>
        )}
        <div className="min-w-0">
          <div className="font-display text-lg sm:text-xl font-bold leading-none capitalize truncate"><span className="hidden sm:inline">{formatDate(world.season, world.day, true)}</span><span className="sm:hidden">{formatDate(world.season, world.day)}</span></div>
          <div className="text-[11px] text-mute mt-1 truncate">
            Stagione {seasonLabel(world.season)}{win.open ? ` · ${win.name} aperto` : ' · Mercato chiuso'}
          </div>
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex flex-col items-end mr-2">
          <span className="text-[10px] uppercase tracking-wider text-mute">Saldo</span>
          <span className={cls('font-display text-lg font-bold num', club.finances.balance < 0 ? 'text-bad' : 'text-good')}>{fmtMoney(club.finances.balance)}</span>
        </div>
        <div className="relative flex">
          <button
            onClick={onMain}
            className={cls(
              'h-11 pl-3 sm:pl-4 pr-2 sm:pr-3 rounded-l-xl font-display text-base sm:text-lg font-bold uppercase tracking-wide flex items-center gap-2 transition-all whitespace-nowrap',
              b ? 'bg-gradient-to-b from-gold to-amber-500 text-abyss' : 'bg-gradient-to-b from-aqua to-aqua-2 text-abyss',
            )}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
            <Icon name={b ? 'warn' : 'forward'} size={18} />
          </button>
          <button
            onClick={() => setOpen(!open)}
            disabled={!!b}
            className={cls('h-11 px-2 rounded-r-xl border-l border-black/20 disabled:opacity-60', b ? 'bg-amber-500 text-abyss' : 'bg-aqua-2 text-abyss')}
            aria-label="Opzioni di avanzamento"
          >
            ▾
          </button>
          {open && !b && (
            <div className="absolute right-0 top-12 panel py-1 w-56 z-50" onMouseLeave={() => setOpen(false)}>
              {[
                { m: 'day' as const, t: 'Avanza di un giorno' },
                { m: 'week' as const, t: 'Avanza di una settimana' },
                { m: 'auto' as const, t: 'Fino alla prossima novità' },
              ].map((o) => (
                <button key={o.m} className="w-full text-left px-4 py-2 text-sm hover:bg-white/5" onClick={() => { setOpen(false); void s.continueGame(o.m); }}>
                  {o.t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
