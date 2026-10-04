// Installation du site comme application sur le téléphone (PWA).
let deferredPrompt: any = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // on affiche notre propre bouton « Installer »
    deferredPrompt = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
}

export const canInstallApp = () => Boolean(deferredPrompt);

export function onInstallAvailable(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Retourne true si l'utilisateur a accepté l'installation.
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export function registerServiceWorker() {
  if (import.meta.env?.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}
