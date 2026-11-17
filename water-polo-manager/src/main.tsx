import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './ui/App';
import { useGame } from './store/game';

// Aggancio per i test automatici: disponibile solo aprendo il gioco con #debug.
if (location.hash.includes('debug')) (window as unknown as { __wpm: typeof useGame }).__wpm = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
