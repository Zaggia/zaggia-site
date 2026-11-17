import { useEffect, useState } from 'react';
import { useGame, type ViewName } from '../store/game';
import { MainMenu } from './screens/MainMenu';
import { Icon } from './components/icons';
import { Crest } from './components/Crest';
import { cls, fmtMoney, formatDate, seasonLabel } from './format';
import { blocker } from '../engine/season/advance';
import { Logo, LogoMark } from './components/Logo';
import { FirstRunGuide, GuideModal } from './components/Guide';
import { CloudStatus, ConflictModal } from './components/Account';
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

interface NavItem { view: ViewName; label: string; icon: string }
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: '', items: [{ view: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  {
    title: 'Squadra',
    items: [
      { view: 'rosa', label: 'Rosa', icon: 'rosa' },
      { view: 'formazione', label: 'Formazione', icon: 'formazione' },
      { view: 'tattiche', label: 'Tattiche', icon: 'tattiche' },
      { view: 'staff', label: 'Allenatore e staff', icon: 'staff' },
      { view: 'giovani', label: 'Settore giovanile', icon: 'giovani' },
    ],
  },
  {
    title: 'Gare',
    items: [
      { view: 'partite', label: 'Partite', icon: 'partite' },
      { view: 'calendario', label: 'Calendario', icon: 'calendario' },
      { view: 'classifica', label: 'Classifica', icon: 'classifica' },
      { view: 'competizioni', label: 'Competizioni', icon: 'competizioni' },
    ],
  },
  {
    title: 'Società',
    items: [
      { view: 'mercato', label: 'Mercato', icon: 'mercato' },
      { view: 'finanze', label: 'Finanze', icon: 'finanze' },
      { view: 'sponsor', label: 'Sponsor', icon: 'sponsor' },
      { view: 'strutture', label: 'Strutture', icon: 'strutture' },
      { view: 'storia', label: 'Storia del club', icon: 'storia' },
    ],
  },
];

export function App() {
  const world = useGame((s) => s.world);
  const busy = useGame((s) => s.busy);
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const s = useGame.getState();
    void s.refreshCareers();
    void s.initAccount().then(() => s.resumeLast()).finally(() => setBooted(true));
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
          <BackBar />
          <View view={view} />
        </main>
        <FirstRunGuide />
        <ConflictModal />
      </div>
    </div>
  );
}

const VIEW_NAMES: Partial<Record<ViewName, string>> = {
  dashboard: 'Dashboard', rosa: 'Rosa', formazione: 'Formazione', tattiche: 'Tattiche', partite: 'Partite', calendario: 'Calendario',
  classifica: 'Classifica', mercato: 'Mercato', staff: 'Allenatore e staff', giovani: 'Settore giovanile', strutture: 'Strutture',
  finanze: 'Finanze', sponsor: 'Sponsor', competizioni: 'Competizioni', storia: 'Storia del club', posta: 'Posta', notizie: 'Notizie',
  player: 'Scheda giocatore', club: 'Società', report: 'Tabellino', impostazioni: 'Salvataggi',
};

/** Freccia "Indietro" ben visibile (anche su telefono) nelle schede di dettaglio: giocatore, società, tabellino. */
function BackBar() {
  const view = useGame((s) => s.view);
  const stack = useGame((s) => s.stack);
  const back = useGame((s) => s.back);
  if (!['player', 'club', 'report'].includes(view)) return null;
  const prev = stack[stack.length - 1];
  const label = prev ? VIEW_NAMES[prev.view] ?? 'Indietro' : 'Dashboard';
  return (
    <button onClick={back} className="press mb-4 inline-flex items-center gap-2 h-9 pl-2.5 pr-3.5 rounded-lg border border-line-2 text-sm font-medium text-ink hover:border-aqua/70 hover:text-aqua transition-colors">
      <Icon name="back" size={18} />
      Torna a {label}
    </button>
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
        {NAV_GROUPS.map((g) => (
          <div key={g.title || 'home'} className="mb-1">
            {g.title && <div className="px-5 pt-2.5 pb-1 text-[11px] font-medium text-faint">{g.title}</div>}
            {g.items.map((n) => (
              <button
                key={n.view}
                onClick={() => go(n.view)}
                className={cls(
                  'group w-[calc(100%-16px)] mx-2 flex items-center gap-3 px-3 h-8 rounded-lg text-sm font-medium transition-colors',
                  view === n.view ? 'text-ink bg-aqua/[0.1]' : 'text-mute hover:text-ink hover:bg-white/[0.04]',
                )}
              >
                <Icon name={n.icon} size={18} weight={view === n.view ? 'fill' : 'regular'} className={view === n.view ? 'text-aqua' : 'text-faint group-hover:text-mute'} />
                <span className="truncate">{n.label}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="border-t border-line mx-4 my-2" />
        <SideLink view="posta" label="Posta e decisioni" icon="posta" badge={pending || unread} hot={pending > 0} />
        <SideLink view="notizie" label="Notizie" icon="notizie" />
        <SideLink view="impostazioni" label="Salvataggi" icon="save" />
      </nav>
      <CloudStatus />
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
      className={cls('group w-[calc(100%-16px)] mx-2 flex items-center gap-3 px-3 h-8 rounded-lg text-sm font-medium transition-colors', cur === view ? 'text-ink bg-aqua/[0.1]' : 'text-mute hover:text-ink hover:bg-white/[0.04]')}
    >
      <Icon name={icon} size={18} weight={cur === view ? 'fill' : 'regular'} className={cur === view ? 'text-aqua' : 'text-faint group-hover:text-mute'} />
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
  const [guide, setGuide] = useState(false);
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
    <header className="sticky top-0 z-20 border-b border-line bg-abyss/80 backdrop-blur-md">
      <div className="flex items-center gap-3 px-3 sm:px-6 h-16 max-w-[1500px] mx-auto">
        <button className="lg:hidden text-mute hover:text-ink p-1" onClick={() => s.setMenu(true)} aria-label="Menu">
          <Icon name="menu" size={22} />
        </button>
        {s.stack.length > 0 && (
          <button className="text-mute hover:text-ink p-1" onClick={() => s.back()} title="Indietro" aria-label="Indietro">
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
        <button className="text-mute hover:text-aqua p-2 rounded-lg hover:bg-white/5" onClick={() => setGuide(true)} title="Come si gioca" aria-label="Come si gioca">
          <Icon name="help" size={20} />
        </button>
        <GuideModal open={guide} onClose={() => setGuide(false)} />
        <div className="hidden md:flex flex-col items-end mr-2">
          <span className="text-[10px] uppercase tracking-wider text-mute">Saldo</span>
          <span className={cls('font-display text-lg font-bold num', club.finances.balance < 0 ? 'text-bad' : 'text-good')}>{fmtMoney(club.finances.balance)}</span>
        </div>
        <div className="relative flex">
          <button
            onClick={onMain}
            className={cls(
              'press h-10 pl-3 sm:pl-4 pr-2 sm:pr-3 rounded-l-lg font-display text-base sm:text-lg font-bold uppercase tracking-wide flex items-center gap-2 transition-colors whitespace-nowrap',
              b ? 'bg-gold text-abyss hover:bg-[#f6cf55]' : 'bg-aqua text-abyss hover:bg-[#4ddbee]',
            )}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
            <Icon name={b ? 'warn' : 'forward'} size={18} weight="fill" />
          </button>
          <button
            onClick={() => setOpen(!open)}
            disabled={!!b}
            className={cls('h-10 px-2 rounded-r-lg border-l border-black/20 disabled:opacity-60', b ? 'bg-gold text-abyss' : 'bg-aqua text-abyss')}
            aria-label="Opzioni di avanzamento"
          >
            <Icon name="next" size={14} weight="bold" className="rotate-90" />
          </button>
          {open && !b && (
            <div className="absolute right-0 top-12 panel p-1 w-60 z-50" onMouseLeave={() => setOpen(false)}>
              {[
                { m: 'day' as const, t: 'Avanza di un giorno' },
                { m: 'week' as const, t: 'Avanza di una settimana' },
                { m: 'auto' as const, t: 'Fino alla prossima novità' },
              ].map((o) => (
                <button key={o.m} className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-white/5" onClick={() => { setOpen(false); void s.continueGame(o.m); }}>
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
