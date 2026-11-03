// En-têtes d'identification du gérant pour les appels au serveur :
// jeton Firebase (si Firebase est configuré) ou mot de passe MANAGER_KEY choisi sur Vercel.
import { getIdToken } from './firebase';
import { loadJSON, saveJSON } from './storage';

const KEY = 'alwassit777.manager.serverkey.v1';

export const getManagerKey = (): string | null => loadJSON<string | null>(KEY, null);
export const setManagerKey = (key: string | null) => saveJSON(KEY, key);

export async function managerHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken().catch(() => null);
  const key = getManagerKey();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'x-manager-key': key } : {}) };
}

// Vérifie le mot de passe auprès du serveur. 'ok' | 'wrong' | 'not-configured' (pas de MANAGER_KEY sur Vercel) | 'offline'.
export async function checkManagerKey(key: string): Promise<'ok' | 'wrong' | 'not-configured' | 'offline'> {
  try {
    const res = await fetch('/api/manager/check', { method: 'POST', headers: { 'x-manager-key': key } });
    if (res.status === 200) return 'ok';
    if (res.status === 401) return 'wrong';
    if (res.status === 503) return 'not-configured';
    return 'offline';
  } catch {
    return 'offline';
  }
}
