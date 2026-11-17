import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  dashboard: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
  rosa: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
  formazione: <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm5 2h2v3h3v2h-3v3h-2v-3H8v-2h3V8z" />,
  tattiche: <path d="M7 5a2 2 0 110 4 2 2 0 010-4zm10 10a2 2 0 110 4 2 2 0 010-4zM6 15l3 3m0-3l-3 3M15 6l3 3m0-3l-3 3M8.5 10.5c2 3 5 4 7 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />,
  partite: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.6 0 3.1.5 4.3 1.3-1.5.4-2.9 1.3-4.3 2.7C10.6 6.6 9.2 5.7 7.7 5.3A7.9 7.9 0 0112 4zM4 12c0-1.7.5-3.2 1.4-4.5 1.8.3 3.4 1.2 4.9 2.8-2.1 2.4-3.2 5.2-3.4 8.2A8 8 0 014 12zm8 8c-1 0-2-.2-2.9-.5 0-3 1-5.6 2.9-7.9 1.9 2.3 2.9 4.9 2.9 7.9-.9.3-1.9.5-2.9.5zm5.1-1.5c-.2-3-1.3-5.8-3.4-8.2 1.5-1.6 3.1-2.5 4.9-2.8A7.9 7.9 0 0120 12a8 8 0 01-2.9 6.5z" />,
  calendario: <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10zM7 12h5v5H7v-5z" />,
  classifica: <path d="M3 3h18v4H3V3zm0 7h12v4H3v-4zm0 7h7v4H3v-4z" />,
  mercato: <path d="M7 7h10l-1.5 9h-7L7 7zm2-4h6v2H9V3zM4 7h16v2H4V7zm6 5h4v2h-4v-2z" />,
  staff: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9c0-3.9 3.1-7 7-7s7 3.1 7 7H5zm12.5-17l1.5 2 2-.5-.5 2 1.5 1.5-2 .5-.5 2-1.5-1.5" />,
  giovani: <path d="M12 2l2.4 4.8L20 8l-4 3.9.9 5.6L12 15l-4.9 2.5.9-5.6L4 8l5.6-1.2L12 2zm-6 18h12v2H6v-2z" />,
  strutture: <path d="M3 21V9l9-6 9 6v12h-6v-7H9v7H3z" />,
  finanze: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15.9V19h-2v-1.1c-1.7-.3-3-1.4-3-3h2c0 .8.9 1.5 2 1.5s2-.7 2-1.5-.9-1.3-2.4-1.7C9.8 12.8 8 12 8 10c0-1.5 1.3-2.6 3-2.9V6h2v1.1c1.7.3 3 1.4 3 3h-2c0-.8-.9-1.5-2-1.5s-2 .6-2 1.4c0 .7.9 1.1 2.4 1.5 1.8.5 3.6 1.3 3.6 3.4 0 1.5-1.3 2.6-3 3z" />,
  sponsor: <path d="M21 7l-9-5-9 5v2h18V7zM5 11v7H3v3h18v-3h-2v-7h-3v7h-2v-7h-4v7H8v-7H5z" />,
  competizioni: <path d="M18 2H6v2H2v4c0 2.2 1.8 4 4 4h.5A6 6 0 0011 15.9V18H8v4h8v-4h-3v-2.1A6 6 0 0017.5 12h.5c2.2 0 4-1.8 4-4V4h-4V2zM4 8V6h2v4a2 2 0 01-2-2zm16 0a2 2 0 01-2 2V6h2v2z" />,
  storia: <path d="M13 3a9 9 0 00-9 9H1l4 4 4-4H6a7 7 0 112 4.9l-1.4 1.4A9 9 0 1013 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12z" />,
  posta: <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />,
  notizie: <path d="M4 4h13v16H5a1 1 0 01-1-1V4zm15 3h1v12a1 1 0 01-2 0V7h1zM7 7h7v4H7V7zm0 6h7v1.5H7V13zm0 3h7v1.5H7V16z" />,
  impostazioni: <path d="M19.4 13a7.6 7.6 0 000-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 00-1.7-1L15 3h-4l-.3 2.9a7.4 7.4 0 00-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 000 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.3-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.1-1.6zM13 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" />,
  play: <path d="M8 5v14l11-7z" />,
  pause: <path d="M6 5h4v14H6zm8 0h4v14h-4z" />,
  forward: <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />,
  menu: <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />,
  back: <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z" />,
  save: <path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zm-5 16a3 3 0 110-6 3 3 0 010 6zm3-10H5V5h10v4z" />,
  star: <path d="M12 17.3l6.2 3.7-1.6-7 5.4-4.7-7.2-.6L12 2 9.2 8.7 2 9.3l5.4 4.7-1.6 7z" />,
  warn: <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />,
  cross: <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />,
  check: <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />,
  ball: <g fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M4 9c5 2.5 11 2.5 16 0M4.5 16c5-2.4 10-2.4 15 0M12 3c-3 4-3 14 0 18" /></g>,
  medical: <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z" />,
};

export function Icon({ name, size = 18, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden>
      {P[name] ?? P.dashboard}
    </svg>
  );
}
