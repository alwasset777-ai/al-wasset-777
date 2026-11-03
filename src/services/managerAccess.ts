// Accès « gérant » à l'agent (actions sur les clients, rendez-vous, annonces…).
// Avec Firebase : être connecté avec le compte du gérant.
// Sans Firebase : un code PIN choisi sur l'appareil (protège l'interface sur un appareil partagé ;
// les données restent de toute façon sur cet appareil).
import { useEffect, useState } from 'react';
import { isFirebaseEnabled, onUserChange } from './firebase';
import { loadJSON, saveJSON } from './storage';
import { checkManagerKey, getManagerKey, setManagerKey } from './managerKey';

const PIN_KEY = 'alwassit777.manager.pin.v1';
const UNLOCK_KEY = 'alwassit777.manager.unlocked.v1';

async function hash(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`alwassit777:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useManagerAccess() {
  const [, force] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState<boolean>(false);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    const off = onUserChange((u) => setFirebaseUser(Boolean(u)));
    return () => {
      listeners.delete(l);
      off();
    };
  }, []);

  const hasPin = Boolean(loadJSON<string | null>(PIN_KEY, null));
  const localUnlocked = loadJSON<boolean>(UNLOCK_KEY, false);

  return {
    usesFirebase: isFirebaseEnabled,
    isManager: isFirebaseEnabled ? firebaseUser || (Boolean(getManagerKey()) && localUnlocked) : (hasPin || Boolean(getManagerKey())) && localUnlocked,
    needsSetup: !isFirebaseEnabled && !hasPin,
    async setupPin(pin: string) {
      saveJSON(PIN_KEY, await hash(pin));
      saveJSON(UNLOCK_KEY, true);
      notify();
    },
    async unlock(pin: string): Promise<boolean> {
      const ok = (await hash(pin)) === loadJSON<string | null>(PIN_KEY, null);
      if (ok) {
        saveJSON(UNLOCK_KEY, true);
        notify();
      }
      return ok;
    },
    // Mot de passe du gérant vérifié par le serveur (MANAGER_KEY sur Vercel) : donne accès à l'IA de منير.
    async unlockWithKey(code: string) {
      const status = await checkManagerKey(code);
      if (status === 'ok') {
        setManagerKey(code);
        saveJSON(UNLOCK_KEY, true);
        notify();
      }
      return status;
    },
    lock() {
      saveJSON(UNLOCK_KEY, false);
      notify();
    },
  };
}
