// Icone dell'interfaccia: libreria Phosphor (stile "regular"/"bold" coerente in tutta l'app).

import { GAME_ICONS, type GameIconName } from '../gameIcons';
import {
  ArrowLeft, Bank, Barbell, Buildings, CalendarBlank, Check, ChartBar, ClockCounterClockwise, CurrencyEur, Envelope,
  FastForward, FirstAidKit, FloppyDisk, Gear, Handshake, Info, List, ListNumbers, Newspaper, Pause, Play, Plant,
  Question, SquaresFour, Star, Strategy, PersonSimpleSwim, Trophy, Users, UserFocus, Warning, X, Volleyball, Lightning,
  CaretRight, Sparkle, type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

const MAP: Record<string, PhosphorIcon> = {
  dashboard: SquaresFour,
  rosa: Users,
  formazione: PersonSimpleSwim,
  tattiche: Strategy,
  partite: Volleyball,
  calendario: CalendarBlank,
  classifica: ListNumbers,
  mercato: Handshake,
  staff: UserFocus,
  giovani: Plant,
  strutture: Buildings,
  finanze: CurrencyEur,
  sponsor: Bank,
  competizioni: Trophy,
  storia: ClockCounterClockwise,
  posta: Envelope,
  notizie: Newspaper,
  impostazioni: Gear,
  play: Play,
  pause: Pause,
  forward: FastForward,
  menu: List,
  back: ArrowLeft,
  save: FloppyDisk,
  star: Star,
  warn: Warning,
  cross: X,
  check: Check,
  ball: Volleyball,
  medical: FirstAidKit,
  gym: Barbell,
  chart: ChartBar,
  info: Info,
  help: Question,
  bolt: Lightning,
  next: CaretRight,
  spark: Sparkle,
};

export function Icon({ name, size = 18, className, weight = 'regular' }: { name: string; size?: number; className?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }) {
  const C = MAP[name] ?? SquaresFour;
  return <C size={size} weight={weight} className={className} aria-hidden />;
}

/** Icona colorata 3D (generata con l'AI): per menu, titoli e pulsanti principali. */
export function GameIcon({ name, size = 32, className }: { name: GameIconName; size?: number; className?: string }) {
  return <img src={GAME_ICONS[name]} width={size} height={size} alt="" aria-hidden draggable={false} className={className} style={{ width: size, height: size, filter: 'drop-shadow(0 2px 2px rgba(2,8,24,0.45))' }} />;
}
