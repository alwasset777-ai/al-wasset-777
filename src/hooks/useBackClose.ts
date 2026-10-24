import { useEffect, useRef } from 'react';

// Bouton « retour » du téléphone (et du navigateur) : ferme la dernière page ou fenêtre ouverte
// au lieu de quitter l'application. Une seule entrée d'historique « garde » est ajoutée tant
// qu'une page est ouverte ; chaque retour ferme la page du dessus.
type Layer = { close: () => void };
const stack: Layer[] = [];
let guarded = false;

function guard() {
  if (guarded) return;
  window.history.pushState({ backGuard: true }, '');
  guarded = true;
}

if (typeof window !== 'undefined')
  window.addEventListener('popstate', () => {
    guarded = false;
    stack.pop()?.close();
    if (stack.length) guard();
  });

export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const layer: Layer = { close: () => closeRef.current() };
    stack.push(layer);
    guard();
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}
