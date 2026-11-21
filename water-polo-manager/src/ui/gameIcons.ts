// Icone "da gioco" colorate, generate con un motore AI di immagini (stile 3D cartoon coerente).

import club from '../assets/icons/club.webp';
import squad from '../assets/icons/squad.webp';
import tactics from '../assets/icons/tactics.webp';
import market from '../assets/icons/market.webp';
import match from '../assets/icons/match.webp';
import finance from '../assets/icons/finance.webp';
import trophy from '../assets/icons/trophy.webp';
import youth from '../assets/icons/youth.webp';
import training from '../assets/icons/training.webp';
import staff from '../assets/icons/staff.webp';
import stadium from '../assets/icons/stadium.webp';
import settings from '../assets/icons/settings.webp';

import calendar from '../assets/icons/calendar.webp';
import standings from '../assets/icons/standings.webp';
import mail from '../assets/icons/mail.webp';
import news from '../assets/icons/news.webp';
import piggy from '../assets/icons/piggy.webp';
import sponsor from '../assets/icons/sponsor.webp';
import world from '../assets/icons/world.webp';
import history from '../assets/icons/history.webp';
import sunstadium from '../assets/icons/sunstadium.webp';
import save from '../assets/icons/save.webp';
import board from '../assets/icons/board.webp';
import coach from '../assets/icons/coach.webp';

export const GAME_ICONS = { club, squad, tactics, market, match, finance, trophy, youth, training, staff, stadium, settings, calendar, standings, mail, news, piggy, sponsor, world, history, sunstadium, save, board, coach };
export type GameIconName = keyof typeof GAME_ICONS;

/** Voce di menu → icona AI (quando esiste). */
export const NAV_GAME_ICON: Partial<Record<string, GameIconName>> = {
  dashboard: 'club',
  rosa: 'squad',
  formazione: 'tactics',
  staff: 'coach',
  tattiche: 'board',
  calendario: 'calendar',
  classifica: 'standings',
  sponsor: 'sponsor',
  storia: 'history',
  posta: 'mail',
  notizie: 'news',
  giovani: 'youth',
  partite: 'match',
  competizioni: 'trophy',
  mercato: 'market',
  finanze: 'finance',
  strutture: 'stadium',
  impostazioni: 'settings',
};
