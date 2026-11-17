import type { InboxCategory, InboxMessage, NewsItem, World } from './types';
import { newId } from './world/context';

const MAX_NEWS = 250;
const MAX_INBOX = 300;

export function addNews(world: World, title: string, body: string, tag = 'generale') {
  const n: NewsItem = { id: newId(world, 'n'), day: world.day, season: world.season, title, body, tag };
  world.news.unshift(n);
  if (world.news.length > MAX_NEWS) world.news.length = MAX_NEWS;
}

export function addMessage(
  world: World, category: InboxCategory, title: string, body: string,
  extra: Partial<Pick<InboxMessage, 'eventId' | 'offerId' | 'link' | 'important'>> = {},
): InboxMessage {
  const m: InboxMessage = { id: newId(world, 'm'), day: world.day, season: world.season, category, title, body, read: false, ...extra };
  world.inbox.unshift(m);
  if (world.inbox.length > MAX_INBOX) {
    // Elimina i messaggi letti più vecchi.
    for (let i = world.inbox.length - 1; i >= 0 && world.inbox.length > MAX_INBOX; i--) if (world.inbox[i].read) world.inbox.splice(i, 1);
    if (world.inbox.length > MAX_INBOX) world.inbox.length = MAX_INBOX;
  }
  return m;
}

export const fmtMoney = (v: number) => {
  const abs = Math.abs(v);
  const s = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',')} mln €` : `${Math.round(abs).toLocaleString('it-IT')} €`;
  return v < 0 ? `−${s}` : s;
};
