import { useEffect, useState, useSyncExternalStore } from 'react';
import { db } from '../core/db';
import { getSettings, onSettings } from '../core/store';
import type { CollectionName, Settings } from '../core/types';
import { isRunning, onRunsChange } from '../agent/runtime';

/** Liste réactive d'une collection (se met à jour à chaque écriture). */
export function useCollection<T>(name: CollectionName, deps: unknown[] = []): T[] | undefined {
  const [rows, setRows] = useState<T[]>();
  useEffect(() => {
    let alive = true;
    const load = () => db.all<T>(name).then((r) => alive && setRows(r));
    load();
    const off = db.subscribe(name, load);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ...deps]);
  return rows;
}

/** Valeur dérivée asynchrone recalculée quand des collections changent. */
export function useLive<T>(fn: () => Promise<T>, collections: CollectionName[], deps: unknown[] = []): T | undefined {
  const [val, setVal] = useState<T>();
  useEffect(() => {
    let alive = true;
    const load = () => fn().then((v) => alive && setVal(v));
    load();
    const offs = collections.map((c) => db.subscribe(c, load));
    return () => {
      alive = false;
      offs.forEach((o) => o());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return val;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => onSettings(cb),
    () => getSettings(),
  );
}

export function useRunning(chatId?: string): boolean {
  return useSyncExternalStore(
    (cb) => onRunsChange(cb),
    () => (chatId ? isRunning(chatId) : false),
  );
}

// ------------------------------------------------------------ routeur (hash)
export function useRoute(): string[] {
  const get = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  location.hash = '#/' + path.replace(/^\/+/, '');
};

export function useMedia(query: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatSize(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}
