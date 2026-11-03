import { CheckCircle2, Cloud, Database, ExternalLink, KeyRound, Lock, Palette, Server, SlidersHorizontal, User } from 'lucide-react';
import { useState } from 'react';
import { cloudSignIn, cloudSignOut, cloudSignUp, syncNow } from '../core/cloud';
import { COLLECTIONS, db } from '../core/db';
import { PROVIDERS } from '../core/defaults';
import { APP_VERSION, apiUrl, platformName, setApiBase } from '../core/platform';
import { listModels, testModel } from '../core/providers';
import { getProfile, getSettings, saveProfile, saveSettings } from '../core/store';
import type { CollectionName, ProviderId } from '../core/types';
import { saveBlob } from '../ui/files';
import { go, useLive, useSettings } from '../ui/hooks';
import { Badge, Button, cx, Field, Input, PageHeader, Select, toast } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';

export async function hashPin(pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('wakil::' + pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const SECTIONS = [
  ['general', 'Général', User],
  ['models', 'Modèles IA', KeyRound],
  ['agent', 'Autonomie', SlidersHorizontal],
  ['sync', 'Synchronisation', Cloud],
  ['data', 'Données', Database],
] as const;

export function ProviderCard({ id }: { id: ProviderId }) {
  const s = useSettings();
  const info = PROVIDERS.find((p) => p.id === id)!;
  const conf = s.providers[id] || { enabled: false };
  const [key, setKey] = useState(conf.apiKey || '');
  const [base, setBase] = useState(conf.baseUrl || '');
  const [busy, setBusy] = useState(false);
  const save = (patch: object) => saveSettings({ providers: { ...getSettings().providers, [id]: { ...getSettings().providers[id], ...patch } } });

  async function verify() {
    setBusy(true);
    try {
      await save({ apiKey: key.trim() || undefined, baseUrl: base.trim() || undefined, enabled: true });
      let models: string[] = [];
      try {
        models = await listModels(id);
      } catch {
        /* certains fournisseurs ne listent pas */
      }
      if (models.length) await save({ models });
      const model = models.find((m) => info.defaultModels.includes(m)) || models[0] || info.defaultModels[0];
      const ms = await testModel({ provider: id, model });
      toast(`${info.label} fonctionne ✓ (${ms} ms, ${models.length || info.defaultModels.length} modèles)`, 'ok');
      if (!getSettings().onboarded || getSettings().defaultModel.provider === id || !getSettings().providers[getSettings().defaultModel.provider]?.apiKey)
        await saveSettings({ defaultModel: { provider: id, model } });
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx('card p-4 space-y-3', conf.enabled && (conf.apiKey || !info.needsKey) && 'border-mint/50')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{info.label}</span>
        {info.free ? <Badge tone="mint">gratuit</Badge> : <Badge>payant</Badge>}
        {conf.enabled && (conf.apiKey || !info.needsKey) && <CheckCircle2 size={16} className="text-ok" />}
        {info.keyUrl && (
          <a className="ml-auto text-xs text-mint inline-flex items-center gap-1 hover:underline" href={info.keyUrl} target="_blank" rel="noreferrer">
            {info.needsKey ? 'Obtenir une clé' : 'Télécharger'} <ExternalLink size={12} />
          </a>
        )}
      </div>
      <p className="text-xs text-muted leading-relaxed">{info.note}</p>
      {info.needsKey && (
        <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Collez votre clé API ici" aria-label={`Clé ${info.label}`} />
      )}
      {(id === 'ollama' || id === 'custom' || id === 'openai') && (
        <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder={`Adresse (par défaut ${info.baseUrl})`} aria-label="Adresse du serveur" />
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={busy || (info.needsKey && !key.trim())} onClick={verify}>
          {busy ? 'Vérification…' : 'Enregistrer et tester'}
        </Button>
        {conf.enabled && (
          <Button
            size="sm"
            onClick={() => {
              setKey('');
              save({ apiKey: undefined, enabled: false, models: undefined });
            }}
          >
            Désactiver
          </Button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage({ section = 'general' }: { section?: string }) {
  const s = useSettings();
  const profile = useLive(getProfile, ['profile']);
  return (
    <PageScroll>
      <PageHeader title="Réglages" subtitle={`Wakil ${APP_VERSION} · ${platformName()}`} />
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {SECTIONS.map(([k, label, Icon]) => (
          <button key={k} onClick={() => go(`settings/${k}`)} className={cx('shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-[13px] border', section === k ? 'bg-ink text-bg border-ink' : 'border-line text-muted hover:bg-surface-2')}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {section === 'general' && (
        <div className="grid gap-4 max-w-2xl">
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <User size={16} /> Profil
            </h2>
            <Field label="Votre prénom">
              <Input defaultValue={profile?.name} key={profile?.id} onBlur={(e) => saveProfile({ name: e.target.value.trim() })} />
            </Field>
          </div>
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Palette size={16} /> Apparence
            </h2>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <Button key={t} size="sm" variant={s.theme === t ? 'primary' : 'secondary'} onClick={() => saveSettings({ theme: t })}>
                  {t === 'system' ? 'Automatique' : t === 'light' ? 'Clair' : 'Sombre'}
                </Button>
              ))}
            </div>
          </div>
          <PinCard />
        </div>
      )}

      {section === 'models' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-2 max-w-2xl">
            <h2 className="font-semibold">Modèle par défaut</h2>
            <p className="text-sm">
              {s.defaultModel.provider} · <b>{s.defaultModel.model}</b>
            </p>
            <p className="text-xs text-muted">Changez-le à tout moment depuis le sélecteur sous la zone de saisie. Chaque conversation et chaque agent peut avoir son propre modèle.</p>
          </div>
          <p className="text-sm text-muted max-w-2xl">
            Vos clés restent sur cet appareil et partent directement chez le fournisseur choisi. Elles ne sont jamais synchronisées ni envoyées à un serveur Wakil.
          </p>
          <div className="grid lg:grid-cols-2 gap-3">
            {PROVIDERS.map((p) => (
              <ProviderCard key={p.id} id={p.id} />
            ))}
          </div>
        </div>
      )}

      {section === 'agent' && (
        <div className="card p-4 space-y-4 max-w-2xl">
          <Field label="Actions maximum par étape" hint="Nombre d’appels d’outils autorisés pour chaque étape d’une tâche (plus = plus autonome, mais plus de quota consommé).">
            <Select value={s.maxToolCallsPerStep} onChange={(e) => saveSettings({ maxToolCallsPerStep: +e.target.value })}>
              {[4, 6, 8, 12, 16, 24].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tours de correction après vérification" hint="Si le contrôle qualité trouve un problème, Wakil ajoute des étapes de correction.">
            <Select value={s.maxFixRounds} onChange={(e) => saveSettings({ maxFixRounds: +e.target.value })}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Serveur des outils web" hint={`Utilisé pour lire des pages et chercher sur le web. Actuel : ${apiUrl('/api') || location.origin + '/api'}`}>
            <Input
              defaultValue={s.apiBase}
              placeholder="https://wakil-ia.vercel.app (laisser vide = automatique)"
              onBlur={(e) => {
                const v = e.target.value.trim();
                setApiBase(v);
                saveSettings({ apiBase: v || undefined });
              }}
            />
          </Field>
        </div>
      )}

      {section === 'sync' && <SyncCard />}
      {section === 'data' && <DataCard />}
    </PageScroll>
  );
}

function PinCard() {
  const s = useSettings();
  const [pin, setPin] = useState('');
  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-2">
        <Lock size={16} /> Verrouillage par code
      </h2>
      <p className="text-xs text-muted">Protège l’ouverture de Wakil sur cet appareil (écran de connexion).</p>
      {s.pinHash ? (
        <Button size="sm" onClick={() => saveSettings({ pinHash: undefined }).then(() => toast('Code supprimé'))}>
          Retirer le code
        </Button>
      ) : (
        <div className="flex gap-2">
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="4 à 8 chiffres" className="max-w-[180px]" aria-label="Nouveau code" />
          <Button
            size="sm"
            variant="primary"
            disabled={pin.length < 4}
            onClick={async () => {
              await saveSettings({ pinHash: await hashPin(pin) });
              setPin('');
              toast('Code activé', 'ok');
            }}
          >
            Activer
          </Button>
        </div>
      )}
    </div>
  );
}

function SyncCard() {
  const s = useSettings();
  const c = s.cloud;
  const [url, setUrl] = useState(c?.url || '');
  const [anon, setAnon] = useState(c?.anonKey || '');
  const [email, setEmail] = useState(c?.email || '');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Server size={16} />
        <h2 className="font-semibold">Synchronisation entre appareils (optionnelle)</h2>
      </div>
      <p className="text-sm text-muted leading-relaxed">
        Pour retrouver vos conversations, tâches et fichiers sur le Mac, l’iPhone et le Huawei : créez un projet gratuit sur supabase.com, exécutez le fichier <code>wakil/supabase/schema.sql</code> dans « SQL Editor », puis collez ci-dessous l’URL et la clé « anon » (Project Settings → API). Vos clés IA ne sont jamais synchronisées.
      </p>
      <Field label="URL du projet Supabase">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
      </Field>
      <Field label="Clé publique « anon »">
        <Input value={anon} onChange={(e) => setAnon(e.target.value)} type="password" autoComplete="off" />
      </Field>
      <Button size="sm" disabled={!url || !anon || busy} onClick={() => run(() => saveSettings({ cloud: { ...(c || {}), url: url.trim(), anonKey: anon.trim() } }).then(() => toast('Configuration enregistrée', 'ok')))}>
        Enregistrer la configuration
      </Button>
      {c?.url && (
        <div className="border-t border-line pt-4 space-y-3">
          {c.session ? (
            <>
              <p className="text-sm">
                Connecté : <b>{c.email}</b>
                {c.lastSync ? ` · dernière synchro ${new Date(c.lastSync).toLocaleString('fr-FR')}` : ''}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={busy} onClick={() => run(async () => { const r = await syncNow(); toast(`Synchronisé : ${r.pushed} envoyés, ${r.pulled} reçus`, 'ok'); })}>
                  Synchroniser maintenant
                </Button>
                <Button size="sm" onClick={() => cloudSignOut()}>
                  Se déconnecter
                </Button>
              </div>
            </>
          ) : (
            <>
              <Field label="E-mail">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Mot de passe">
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={busy || !email || pwd.length < 6} onClick={() => run(async () => { await cloudSignIn(email, pwd); await syncNow(); toast('Connecté et synchronisé', 'ok'); })}>
                  Se connecter
                </Button>
                <Button size="sm" disabled={busy || !email || pwd.length < 6} onClick={() => run(async () => { const ok = await cloudSignUp(email, pwd); toast(ok ? 'Compte créé' : 'Vérifiez votre e-mail pour confirmer le compte.', 'ok'); })}>
                  Créer un compte
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DataCard() {
  return (
    <div className="card p-4 space-y-4 max-w-2xl">
      <h2 className="font-semibold">Sauvegarde et données</h2>
      <p className="text-sm text-muted">Tout est stocké sur cet appareil. Exportez une sauvegarde pour la garder ou la transférer (les clés API ne sont pas incluses).</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={async () => {
            const out: Record<string, unknown[]> = {};
            for (const c of COLLECTIONS) if (c !== 'settings' && c !== 'logs') out[c] = await db.all(c);
            await saveBlob(new Blob([JSON.stringify({ app: 'wakil', version: APP_VERSION, exportedAt: new Date().toISOString(), data: out }, null, 1)], { type: 'application/json' }), `wakil-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`);
          }}
        >
          Exporter une sauvegarde
        </Button>
        <label className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-line bg-surface hover:bg-surface-2 text-sm font-medium cursor-pointer">
          Importer une sauvegarde
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const j = JSON.parse(await f.text());
                if (j.app !== 'wakil') throw new Error('Ce fichier n’est pas une sauvegarde Wakil.');
                let n = 0;
                for (const [c, rows] of Object.entries(j.data || {})) {
                  if (!COLLECTIONS.includes(c as CollectionName) || c === 'settings') continue;
                  await db.putMany(c as CollectionName, rows as { id: string }[]);
                  n += (rows as unknown[]).length;
                }
                toast(`${n} éléments importés`, 'ok');
              } catch (err) {
                toast((err as Error).message, 'danger');
              }
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div className="border-t border-line pt-4">
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm('Effacer TOUTES les données de Wakil sur cet appareil ? Cette action est définitive.')) return;
            for (const c of COLLECTIONS) await db.hardClear(c);
            location.hash = '#/';
            location.reload();
          }}
        >
          Tout effacer sur cet appareil
        </Button>
      </div>
    </div>
  );
}
