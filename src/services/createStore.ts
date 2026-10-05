// Petit magasin de données partagé : un seul état en mémoire, sauvegardé dans le navigateur,
// synchronisé entre onglets, et lisible/modifiable aussi bien par l'interface que par l'agent IA.
import { useEffect, useState } from 'react';
import { loadJSON, saveJSON } from './storage';

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  use(): [T, (next: T | ((prev: T) => T)) => void];
}

export function createStore<T>(key: string, initial: T): Store<T> {
  let value: T = loadJSON<T>(key, initial);
  const listeners = new Set<(v: T) => void>();

  const set = (next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
    saveJSON(key, value);
    listeners.forEach((l) => l(value));
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        value = loadJSON<T>(key, initial);
        listeners.forEach((l) => l(value));
      }
    });
  }

  return {
    get: () => value,
    set,
    use() {
      const [state, setState] = useState(value);
      useEffect(() => {
        listeners.add(setState);
        setState(value);
        return () => {
          listeners.delete(setState);
        };
      }, []);
      return [state, set];
    },
  };
}
