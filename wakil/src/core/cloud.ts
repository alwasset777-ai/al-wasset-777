// Synchronisation cloud OPTIONNELLE via Supabase (offre gratuite).
// Tout fonctionne sans compte ; la synchro sert à retrouver ses données
// sur le Mac, l'iPhone et le Huawei. Les clés API ne sont JAMAIS envoyées.
import { COLLECTIONS, db, setWriteHook } from './db';
import { getSettings, saveSettings } from './store';
import type { CollectionName } from './types';

const SYNCED: CollectionName[] = COLLECTIONS.filter((c) => c !== 'settings' && c !== 'logs');
const MAX_RECORD = 900_000;

type Session = NonNullable<NonNullable<ReturnType<typeof getSettings>['cloud']>['session']>;

function conf() {
  const c = getSettings().cloud;
  if (!c?.url || !c.anonKey) throw new Error('Synchronisation non configurée.');
  return { ...c, url: c.url.replace(/\/+$/, '') };
}

async function authCall(path: string, body: unknown) {
  const c = conf();
  const res = await fetch(`${c.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || `Erreur ${res.status}`);
  return data;
}

function toSession(d: any): Session {
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user_id: d.user?.id };
}

export async function cloudSignUp(email: string, password: string) {
  const d = await authCall('signup', { email, password });
  if (d.access_token) await saveSettings({ cloud: { ...conf(), email, session: toSession(d) } });
  return !!d.access_token; // false = e-mail de confirmation envoyé
}

export async function cloudSignIn(email: string, password: string) {
  const d = await authCall('token?grant_type=password', { email, password });
  await saveSettings({ cloud: { ...conf(), email, session: toSession(d), lastSync: 0 } });
}

export async function cloudSignOut() {
  const c = getSettings().cloud;
  if (c) await saveSettings({ cloud: { url: c.url, anonKey: c.anonKey } });
}

async function token(): Promise<string> {
  const c = conf();
  if (!c.session) throw new Error('Non connecté.');
  if (c.session.expires_at - Date.now() < 60_000) {
    const d = await authCall('token?grant_type=refresh_token', { refresh_token: c.session.refresh_token });
    await saveSettings({ cloud: { ...c, session: toSession(d) } });
    return d.access_token;
  }
  return c.session.access_token;
}

async function rest(path: string, init: RequestInit = {}) {
  const c = conf();
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: c.anonKey, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

let syncing = false;
export async function syncNow(): Promise<{ pushed: number; pulled: number }> {
  if (syncing) return { pushed: 0, pulled: 0 };
  syncing = true;
  try {
    const c = conf();
    if (!c.session) throw new Error('Connectez-vous d’abord.');
    const since = c.lastSync || 0;
    const startedAt = Date.now();
    // 1. Envoi des changements locaux
    let pushed = 0;
    for (const name of SYNCED) {
      const rows = (await db.allIncludingDeleted<{ id: string; updatedAt?: number }>(name)).filter((r) => (r.updatedAt || 0) > since);
      const payload = rows
        .map((r) => ({ user_id: c.session!.user_id, collection: name, id: r.id, data: r, deleted: !!(r as any).deleted, updated_at: new Date(r.updatedAt || Date.now()).toISOString() }))
        .filter((r) => JSON.stringify(r.data).length < MAX_RECORD);
      for (let i = 0; i < payload.length; i += 200) {
        await rest('wakil_records?on_conflict=user_id,collection,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(payload.slice(i, i + 200)) });
      }
      pushed += payload.length;
    }
    // 2. Réception des changements distants (le plus récent gagne)
    let pulled = 0;
    let cursor = new Date(since).toISOString();
    for (;;) {
      const rows: any[] = (await rest(`wakil_records?select=collection,id,data,updated_at&updated_at=gt.${encodeURIComponent(cursor)}&order=updated_at.asc&limit=500`)) || [];
      for (const r of rows) {
        if (!SYNCED.includes(r.collection)) continue;
        const local = await db.getRaw<{ id: string; updatedAt?: number }>(r.collection, r.id);
        if (!local || (local.updatedAt || 0) < (r.data?.updatedAt || 0)) {
          await db.put(r.collection, r.data, true);
          pulled++;
        }
      }
      if (rows.length < 500) break;
      cursor = rows[rows.length - 1].updated_at;
    }
    for (const name of SYNCED) db.emit(name);
    await saveSettings({ cloud: { ...conf(), lastSync: startedAt } });
    return { pushed, pulled };
  } finally {
    syncing = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Synchro automatique quelques secondes après chaque modification. */
export function startAutoSync() {
  setWriteHook((name) => {
    if (!SYNCED.includes(name) || !getSettings().cloud?.session) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow().catch(() => undefined), 8000);
  });
  if (getSettings().cloud?.session) syncNow().catch(() => undefined);
}
