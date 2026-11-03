import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startAutoSync } from './core/cloud';
import { isCapacitor, setApiBase } from './core/platform';
import { initStore, log } from './core/store';
import { applyTheme } from './ui/Shell';
import './styles/app.css';

window.addEventListener('error', (e) => void log('error', e.message, { src: e.filename, line: e.lineno }));
window.addEventListener('unhandledrejection', (e) => void log('error', String(e.reason?.message || e.reason)));

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  try {
    if (!('indexedDB' in window)) throw new Error('Stockage local indisponible (navigation privée ?).');
    const s = await initStore();
    setApiBase(s.apiBase);
    applyTheme();
    startAutoSync();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (e) {
    root.render(
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Wakil n’a pas pu démarrer</h1>
        <p>{(e as Error).message}</p>
      </div>,
    );
  }
  // Mode hors-ligne (PWA) : uniquement sur le web en https.
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !isCapacitor()) {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }
}
boot();
