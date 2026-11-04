import { ArrowRight, Bot, FileText, Globe, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { createProject, saveProfile, saveSettings } from '../core/store';
import { Button, cx, Input, Logo } from '../ui/primitives';
import { useSettings } from '../ui/hooks';
import { ProviderCard, hashPin } from './SettingsPage';

export function OnboardingPage({ onDone }: { onDone: () => void }) {
  const s = useSettings();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [agency, setAgency] = useState(true);
  const [pin, setPin] = useState('');
  const ready = Object.entries(s.providers).some(([, c]) => c?.enabled && (c.apiKey || c.baseUrl));

  async function finish() {
    await saveProfile({ name: name.trim() });
    if (agency)
      await createProject({
        name: 'Agence Al Wasset 777',
        description: 'Agence immobilière à Meknès',
        instructions: 'Contexte : agence immobilière « Al Wasset 777 » à Meknès (Maroc). Prix en dirhams. Langues : français, arabe, darija selon le client.',
        color: '#E0A43B',
      });
    await saveSettings({ onboarded: true, pinHash: pin.length >= 4 ? await hashPin(pin) : undefined });
    onDone();
  }

  return (
    <div className="min-h-full overflow-y-auto brand-gradient">
      <div className="max-w-xl mx-auto px-5 py-10 safe-top">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={40} />
          <div>
            <div className="text-xl font-semibold tracking-tight">Wakil</div>
            <div className="text-sm text-muted">Votre agent IA autonome</div>
          </div>
        </div>
        <div className="flex gap-1.5 mb-6" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-surface-3')} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold leading-tight">Confiez un objectif. Wakil s’occupe du reste.</h1>
            <div className="grid gap-3">
              {[
                [Bot, 'Planifie et exécute', 'Découpe vos objectifs en étapes, agit avec ses outils, vérifie et corrige.'],
                [Globe, 'Cherche sur le web', 'Synthèses sourcées, lecture de pages, veille.'],
                [FileText, 'Livre des fichiers', 'Rapports, sites web, code, tableaux, présentations — exportables.'],
                [ShieldCheck, 'Privé et gratuit', 'Vos données restent sur votre appareil. Modèles IA gratuits.'],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Bot;
                return (
                  <div key={t as string} className="card p-4 flex gap-3">
                    <I size={20} className="text-accent shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">{t as string}</div>
                      <div className="text-sm text-muted">{d as string}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Comment vous appelez-vous ?</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre prénom" autoFocus />
            </label>
            <Button variant="primary" className="w-full" onClick={() => setStep(1)}>
              Commencer <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold leading-tight">Activez l’intelligence (gratuit)</h1>
            <ol className="text-sm text-muted space-y-1 list-decimal pl-5">
              <li>Ouvrez « Obtenir une clé » ci-dessous (compte Google).</li>
              <li>Cliquez « Create API key », copiez la clé.</li>
              <li>Collez-la ici puis « Enregistrer et tester ».</li>
            </ol>
            <ProviderCard id="gemini" />
            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-medium">Autres options gratuites (Groq, OpenRouter, Ollama local…)</summary>
              <div className="grid gap-3 mt-3">
                <ProviderCard id="groq" />
                <ProviderCard id="openrouter" />
                <ProviderCard id="ollama" />
              </div>
            </details>
            <div className="flex gap-2">
              <Button onClick={() => setStep(0)}>Retour</Button>
              <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>
                {ready ? 'Continuer' : 'Plus tard'} <ArrowRight size={16} />
              </Button>
            </div>
            {!ready && (
              <button
                className="w-full text-sm text-mint hover:underline"
                onClick={async () => {
                  await saveSettings({ providers: { ...s.providers, demo: { enabled: true } }, defaultModel: { provider: 'demo', model: 'wakil-demo' } });
                  setStep(2);
                }}
              >
                Pas de clé pour l’instant ? Essayer en mode démonstration →
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold leading-tight">Derniers réglages</h1>
            <label className="card p-4 flex gap-3 items-start cursor-pointer">
              <input type="checkbox" className="mt-1" checked={agency} onChange={(e) => setAgency(e.target.checked)} />
              <div>
                <div className="font-medium">Créer le projet « Agence Al Wasset 777 »</div>
                <div className="text-sm text-muted">Wakil connaîtra le contexte de votre agence (Meknès, prix en DH, langues).</div>
              </div>
            </label>
            <div className="card p-4 space-y-2">
              <div className="font-medium">Code de verrouillage (optionnel)</div>
              <div className="text-sm text-muted">Demandé à chaque ouverture de l’application.</div>
              <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="4 à 8 chiffres" className="max-w-[200px]" aria-label="Code" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(1)}>Retour</Button>
              <Button variant="primary" className="flex-1" onClick={finish}>
                Ouvrir Wakil <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LockPage({ onUnlock }: { onUnlock: () => void }) {
  const s = useSettings();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  return (
    <div className="h-full flex items-center justify-center brand-gradient px-6">
      <form
        className="card shadow-soft p-6 w-full max-w-xs text-center space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if ((await hashPin(pin)) === s.pinHash) onUnlock();
          else {
            setErr(true);
            setPin('');
          }
        }}
      >
        <div className="flex justify-center">
          <Logo size={44} />
        </div>
        <div>
          <div className="font-semibold">Wakil est verrouillé</div>
          <div className="text-sm text-muted">Entrez votre code</div>
        </div>
        <Input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setErr(false);
            setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
          }}
          className={cx('text-center tracking-[0.5em] text-lg h-12', err && 'border-danger')}
          aria-label="Code"
        />
        {err && <div className="text-sm text-danger">Code incorrect</div>}
        <Button variant="primary" className="w-full" type="submit" disabled={pin.length < 4}>
          Déverrouiller
        </Button>
      </form>
    </div>
  );
}
