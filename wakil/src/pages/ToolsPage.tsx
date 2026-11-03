import { Monitor, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db, now, uid } from '../core/db';
import { desktop } from '../core/platform';
import { getSettings, saveSettings } from '../core/store';
import type { AgentProfile, CustomTool } from '../core/types';
import { BUILTIN_TOOLS } from '../tools/registry';
import { useCollection, useSettings } from '../ui/hooks';
import { Badge, Button, Field, IconButton, Input, Modal, PageHeader, Textarea, Toggle, toast } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';
import { ModelSelectInline } from '../ui/widgets';

function AgentModal({ agent, onClose }: { agent?: AgentProfile | null; onClose: () => void }) {
  const [a, setA] = useState<Partial<AgentProfile>>(agent || { name: '', emoji: '◆', description: '', systemPrompt: '', tools: [] });
  const tools = [...BUILTIN_TOOLS.map((t) => t.name)];
  return (
    <Modal
      open={agent !== undefined}
      onClose={onClose}
      wide
      title={agent ? `Modifier ${agent.name}` : 'Nouvel agent'}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!a.name?.trim()}
            onClick={async () => {
              await db.put<AgentProfile>('agents', {
                id: agent?.id || uid('agt_'),
                name: a.name!.trim(),
                emoji: a.emoji || '◆',
                description: a.description || '',
                systemPrompt: a.systemPrompt || '',
                tools: a.tools || [],
                model: a.model,
                builtin: agent?.builtin,
                createdAt: agent?.createdAt || now(),
                updatedAt: now(),
              });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[80px_1fr] gap-3">
        <Field label="Icône">
          <Input value={a.emoji} maxLength={2} onChange={(e) => setA({ ...a, emoji: e.target.value })} />
        </Field>
        <Field label="Nom">
          <Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Ex. : Comptable" />
        </Field>
      </div>
      <Field label="Description">
        <Input value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} />
      </Field>
      <Field label="Instructions (rôle, ton, méthode)">
        <Textarea rows={6} value={a.systemPrompt} onChange={(e) => setA({ ...a, systemPrompt: e.target.value })} />
      </Field>
      <Field label="Modèle préféré">
        <ModelSelectInline value={a.model} onChange={(m) => setA({ ...a, model: m })} />
      </Field>
      <Field label="Outils autorisés" hint="Aucun coché = tous les outils actifs.">
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t) => {
            const on = a.tools?.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setA({ ...a, tools: on ? a.tools!.filter((x) => x !== t) : [...(a.tools || []), t] })}
                className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'bg-accent-soft border-accent text-accent' : 'border-line text-muted'}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Field>
    </Modal>
  );
}

function PluginModal({ tool, onClose }: { tool?: CustomTool | null; onClose: () => void }) {
  const [t, setT] = useState<Partial<CustomTool>>(tool || { name: '', description: '', urlTemplate: 'https://', params: [], enabled: true });
  const [paramsText, setParamsText] = useState((tool?.params || []).map((p) => `${p.name}${p.required ? '*' : ''}: ${p.description}`).join('\n'));
  return (
    <Modal
      open={tool !== undefined}
      onClose={onClose}
      title={tool ? 'Modifier le plugin' : 'Nouveau plugin HTTP'}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={async () => {
              const name = (t.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
              if (!name || BUILTIN_TOOLS.some((b) => b.name === name)) return toast('Nom invalide ou déjà utilisé.', 'danger');
              if (!/^https:\/\//.test(t.urlTemplate || '')) return toast('L’URL doit commencer par https://', 'danger');
              const params = paramsText
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .map((l) => {
                  const [n, ...d] = l.split(':');
                  return { name: n.replace('*', '').trim(), required: n.includes('*'), description: d.join(':').trim() };
                });
              await db.put<CustomTool>('tools', { id: tool?.id || uid('tol_'), name, description: t.description || '', urlTemplate: t.urlTemplate!, params, enabled: t.enabled ?? true, createdAt: tool?.createdAt || now(), updatedAt: now() });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">Un plugin donne à l’agent l’accès à une API web (lecture seule, GET). Exemple : météo, taux de change, données publiques.</p>
      <Field label="Nom (snake_case)">
        <Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="meteo_ville" />
      </Field>
      <Field label="Description pour l’agent">
        <Input value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} placeholder="Donne la météo actuelle d’une ville" />
      </Field>
      <Field label="URL" hint="Variables entre accolades, ex. https://wttr.in/{ville}?format=j1">
        <Input value={t.urlTemplate} onChange={(e) => setT({ ...t, urlTemplate: e.target.value })} />
      </Field>
      <Field label="Paramètres (un par ligne)" hint="Format : nom*: description  (* = obligatoire)">
        <Textarea rows={3} value={paramsText} onChange={(e) => setParamsText(e.target.value)} placeholder="ville*: nom de la ville" />
      </Field>
    </Modal>
  );
}

export function ToolsPage() {
  const s = useSettings();
  const agents = useCollection<AgentProfile>('agents');
  const plugins = useCollection<CustomTool>('tools');
  const [agentEdit, setAgentEdit] = useState<AgentProfile | null | undefined>(undefined);
  const [pluginEdit, setPluginEdit] = useState<CustomTool | null | undefined>(undefined);
  const isDesktop = !!desktop();

  const toggleTool = (name: string, on: boolean) => {
    const cur = getSettings().disabledTools;
    saveSettings({ disabledTools: on ? cur.filter((x) => x !== name) : [...cur, name] });
  };
  const toggleApproval = (name: string, on: boolean) => {
    const cur = getSettings().requireApprovalFor;
    saveSettings({ requireApprovalFor: on ? [...new Set([...cur, name])] : cur.filter((x) => x !== name) });
  };

  return (
    <PageScroll>
      <PageHeader title="Outils & agents" subtitle="Ce que Wakil peut faire, et les agents spécialisés que vous configurez." />

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Agents</h2>
          <Button size="sm" onClick={() => setAgentEdit(null)}>
            <Plus size={14} /> Nouvel agent
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents?.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex items-center gap-2">
                <span className="size-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">{a.emoji}</span>
                <span className="font-medium truncate flex-1">{a.name}</span>
                <IconButton label="Modifier" onClick={() => setAgentEdit(a)}>
                  <Pencil size={14} />
                </IconButton>
                {!a.builtin && (
                  <IconButton label="Supprimer" onClick={() => confirm(`Supprimer ${a.name} ?`) && db.remove('agents', a.id)}>
                    <Trash2 size={14} />
                  </IconButton>
                )}
              </div>
              <p className="text-sm text-muted mt-2">{a.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-semibold mb-3">Outils intégrés</h2>
        {!isDesktop && (
          <p className="text-xs text-muted mb-3 flex items-center gap-1.5">
            <Monitor size={13} /> Les outils marqués « Mac » (terminal, export) s’activent dans l’application Mac.
          </p>
        )}
        <div className="card divide-y divide-[var(--line)]">
          {BUILTIN_TOOLS.map((t) => (
            <div key={t.name} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t.label}</span>
                  <code className="text-[11px] text-muted">{t.name}</code>
                  <Badge>{t.category}</Badge>
                  {t.desktopOnly && <Badge tone="mint">Mac</Badge>}
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">{t.description}</p>
                <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={s.requireApprovalFor.includes(t.name) || !!t.needsApproval} disabled={t.needsApproval} onChange={(e) => toggleApproval(t.name, e.target.checked)} />
                  Demander mon accord avant chaque utilisation
                </label>
              </div>
              <Toggle checked={!s.disabledTools.includes(t.name)} onChange={(v) => toggleTool(t.name, v)} label={`Activer ${t.label}`} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Plugins (API web)</h2>
          <Button size="sm" onClick={() => setPluginEdit(null)}>
            <Plus size={14} /> Nouveau plugin
          </Button>
        </div>
        {!plugins?.length && <p className="text-sm text-muted">Aucun plugin. Ajoutez une API publique pour étendre les capacités de l’agent.</p>}
        <div className="card divide-y divide-[var(--line)]">
          {plugins?.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted truncate">{p.urlTemplate}</div>
              </div>
              <IconButton label="Modifier" onClick={() => setPluginEdit(p)}>
                <Pencil size={14} />
              </IconButton>
              <IconButton label="Supprimer" onClick={() => db.remove('tools', p.id)}>
                <Trash2 size={14} />
              </IconButton>
              <Toggle checked={p.enabled} onChange={(v) => db.put('tools', { ...p, enabled: v, updatedAt: now() })} label={`Activer ${p.name}`} />
            </div>
          ))}
        </div>
      </section>
      {agentEdit !== undefined && <AgentModal agent={agentEdit} onClose={() => setAgentEdit(undefined)} />}
      {pluginEdit !== undefined && <PluginModal tool={pluginEdit} onClose={() => setPluginEdit(undefined)} />}
    </PageScroll>
  );
}
