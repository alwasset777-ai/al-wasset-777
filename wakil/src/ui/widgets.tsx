import { Check, ChevronDown, CircleAlert, CircleCheck, CircleDashed, CircleX, Cpu, Download, FileText, Globe, Loader, Pencil, Square, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { onApproval, stop, type ApprovalRequest } from '../agent/runtime';
import { db } from '../core/db';
import { PROVIDERS, providerInfo } from '../core/defaults';
import { listModels } from '../core/providers';
import { getSettings, saveSettings } from '../core/store';
import type { ModelRef, Task, WorkspaceFile } from '../core/types';
import { downloadFile, printAsPdf } from './files';
import { formatSize, go, timeAgo, useLive, useSettings } from './hooks';
import { Markdown } from './Markdown';
import { Badge, Button, cx, Modal, onToast, Select, Spinner, toast, type Toast } from './primitives';
import { marked } from 'marked';

// ------------------------------------------------------------ sélecteur de modèle
export function ModelPicker({ value, onChange, compact }: { value: ModelRef; onChange: (m: ModelRef) => void; compact?: boolean }) {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string>();
  const configured = PROVIDERS.filter((p) => s.providers[p.id]?.enabled && (!p.needsKey || s.providers[p.id]?.apiKey));

  async function refresh(id: ModelRef['provider']) {
    setLoading(id);
    try {
      const models = await listModels(id);
      await saveSettings({ providers: { ...getSettings().providers, [id]: { ...getSettings().providers[id], enabled: true, models } } });
      toast(`${models.length} modèles trouvés`, 'ok');
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setLoading(undefined);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cx('inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface hover:bg-surface-2 text-[12px] text-muted', compact ? 'h-7 px-2' : 'h-8 px-2.5')}
        title="Choisir le modèle IA"
      >
        <Cpu size={13} />
        <span className="max-w-[140px] truncate">{value.model}</span>
        <ChevronDown size={12} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Choisir le modèle IA">
        {!configured.length && (
          <p className="text-sm text-muted">
            Aucun fournisseur configuré.{' '}
            <a className="text-mint underline" href="#/settings/models" onClick={() => setOpen(false)}>
              Ajouter une clé gratuite
            </a>
            .
          </p>
        )}
        {configured.map((p) => {
          const models = Array.from(new Set([...(s.providers[p.id]?.models || []), ...p.defaultModels]));
          return (
            <div key={p.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold flex items-center gap-2">
                  {p.label} {p.free ? <Badge tone="mint">gratuit</Badge> : <Badge>payant</Badge>}
                </div>
                <button className="text-xs text-mint hover:underline disabled:opacity-50" disabled={loading === p.id} onClick={() => refresh(p.id)}>
                  {loading === p.id ? 'Chargement…' : 'Actualiser la liste'}
                </button>
              </div>
              <div className="grid gap-1.5">
                {models.slice(0, 30).map((m) => {
                  const active = value.provider === p.id && value.model === m;
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        onChange({ provider: p.id, model: m });
                        setOpen(false);
                      }}
                      className={cx('flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm', active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2')}
                    >
                      <span className="truncate">{m}</span>
                      {active && <Check size={15} className="text-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <a href="#/settings/models" onClick={() => setOpen(false)} className="block text-[13px] text-mint hover:underline">
          Gérer les fournisseurs et les clés →
        </a>
      </Modal>
    </>
  );
}

// ------------------------------------------------------------ approbations
export function ApprovalHost() {
  const [req, setReq] = useState<ApprovalRequest>();
  useEffect(() => onApproval((r) => setReq(r)), []);
  if (!req) return null;
  const answer = (ok: boolean) => {
    req.resolve(ok);
    setReq(undefined);
  };
  return (
    <Modal
      open
      onClose={() => answer(false)}
      title="Autoriser cette action ?"
      footer={
        <>
          <Button onClick={() => answer(false)}>Refuser</Button>
          <Button variant="primary" onClick={() => answer(true)}>
            Autoriser
          </Button>
        </>
      }
    >
      <p className="text-sm">
        L’agent veut utiliser <b>{req.title}</b>. Vérifiez avant d’accepter :
      </p>
      <pre className="text-xs bg-surface-2 border border-line rounded-lg p-3 whitespace-pre-wrap break-all max-h-60 overflow-auto">{req.detail}</pre>
    </Modal>
  );
}

// ------------------------------------------------------------ toasts
export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setList((l) => [...l, t]);
        setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 4200);
      }),
    [],
  );
  return (
    <div className="fixed z-[60] bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(92vw,420px)] pointer-events-none" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={cx(
            'card shadow-soft px-4 py-2.5 text-sm pointer-events-auto',
            t.tone === 'danger' && 'border-danger/40 text-danger',
            t.tone === 'ok' && 'border-mint/40',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ carte de tâche (mode agent)
const statusLabel: Record<Task['status'], string> = {
  queued: 'En attente',
  planning: 'Planification…',
  running: 'Exécution…',
  verifying: 'Vérification…',
  waiting: 'En attente de vous',
  done: 'Terminée',
  failed: 'Échec',
  cancelled: 'Arrêtée',
};

export function StatusBadge({ status }: { status: Task['status'] }) {
  const tone = status === 'done' ? 'ok' : status === 'failed' ? 'danger' : status === 'cancelled' ? 'neutral' : 'accent';
  return (
    <Badge tone={tone}>
      {['planning', 'running', 'verifying'].includes(status) && <Loader size={11} className="spin" />}
      {statusLabel[status]}
    </Badge>
  );
}

const toolIcon = (name: string) => (/search|webpage/.test(name) ? <Globe size={13} /> : /file|export/.test(name) ? <FileText size={13} /> : <Wrench size={13} />);

export function TaskCard({ taskId, chatId, full }: { taskId: string; chatId?: string; full?: boolean }) {
  const task = useLive(() => db.get<Task>('tasks', taskId), ['tasks'], [taskId]);
  const files = useLive(async () => (await db.all<WorkspaceFile>('files')).filter((f) => task?.fileIds.includes(f.id)), ['files', 'tasks'], [taskId, task?.fileIds.length]);
  const [showLogs, setShowLogs] = useState(!!full);
  if (!task) return <Spinner />;
  const active = ['queued', 'planning', 'running', 'verifying', 'waiting'].includes(task.status);
  const doneSteps = task.steps.filter((s) => s.status === 'done').length;
  const pct = task.steps.length ? Math.round((doneSteps / task.steps.length) * 100) : active ? 5 : 100;
  return (
    <div className="card overflow-hidden" data-testid="task-card">
      <div className="px-4 pt-3.5 pb-3 brand-gradient border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted font-semibold">Tâche autonome</div>
            <div className="font-semibold leading-snug mt-0.5">{task.title}</div>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div className={cx('h-full rounded-full transition-all', task.status === 'failed' ? 'bg-danger' : 'bg-accent')} style={{ width: `${task.status === 'done' ? 100 : pct}%` }} />
        </div>
      </div>
      {task.steps.length > 0 && (
        <ol className="px-4 py-3 space-y-2">
          {task.steps.map((s, i) => (
            <li key={s.id} className="flex gap-2.5 text-sm">
              <span className="mt-0.5 shrink-0">
                {s.status === 'done' ? (
                  <CircleCheck size={17} className="text-ok" />
                ) : s.status === 'running' ? (
                  <Loader size={17} className="spin text-accent" />
                ) : s.status === 'failed' ? (
                  <CircleX size={17} className="text-danger" />
                ) : (
                  <CircleDashed size={17} className="text-muted" />
                )}
              </span>
              <div className="min-w-0">
                <div className={cx(s.status === 'pending' && 'text-muted')}>
                  {i + 1}. {s.title}
                </div>
                {full && s.detail && <div className="text-xs text-muted mt-0.5">{s.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {task.verification && (
        <div className={cx('mx-4 mb-3 rounded-lg px-3 py-2 text-xs flex gap-2', task.verification.ok ? 'bg-mint-soft text-mint' : 'bg-accent-soft text-accent')}>
          {task.verification.ok ? <CircleCheck size={14} className="shrink-0 mt-px" /> : <CircleAlert size={14} className="shrink-0 mt-px" />}
          <span>Contrôle qualité : {task.verification.notes}</span>
        </div>
      )}
      {!!files?.length && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {files.map((f) => (
            <button key={f.id} onClick={() => go(`files/${encodeURIComponent(f.id)}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 hover:bg-surface-3 px-2.5 py-1.5 text-xs">
              <FileText size={13} /> {f.path} <span className="text-muted">{formatSize(f.size)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
        <button className="text-xs text-muted hover:text-ink" onClick={() => setShowLogs((v) => !v)}>
          {showLogs ? 'Masquer' : 'Voir'} le journal ({task.logs.length})
        </button>
        {!full && (
          <button className="text-xs text-mint hover:underline" onClick={() => go(`task/${task.id}`)}>
            Ouvrir la tâche
          </button>
        )}
        {active && chatId && (
          <Button size="sm" variant="danger" className="ml-auto" onClick={() => stop(chatId)}>
            <Square size={12} /> Arrêter
          </Button>
        )}
      </div>
      {showLogs && (
        <div className="border-t border-line bg-surface-2/60 max-h-80 overflow-y-auto px-4 py-2 text-xs font-mono space-y-1">
          {task.logs.map((l) => (
            <div key={l.id} className={cx('flex gap-2', l.kind === 'error' && 'text-danger', l.kind === 'tool' && 'text-accent')}>
              <span className="text-muted shrink-0">{new Date(l.at).toLocaleTimeString('fr-FR')}</span>
              {l.kind === 'tool' && toolIcon(l.text)}
              <span className="whitespace-pre-wrap break-words min-w-0">
                {l.kind === 'tool' ? `${l.text}(${JSON.stringify(l.data).slice(0, 220)})` : l.text.slice(0, 600)}
              </span>
            </div>
          ))}
        </div>
      )}
      {full && task.result && (
        <div className="border-t border-line px-4 py-4">
          <Markdown text={task.result} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ aperçu de fichier
export function FilePreview({ file, onEdit }: { file: WorkspaceFile; onEdit?: () => void }) {
  const kind = useMemo(() => {
    if (file.binary && file.mime.startsWith('image/')) return 'image';
    if (file.mime === 'image/svg+xml') return 'svg';
    if (file.mime === 'text/html') return 'html';
    if (file.mime === 'text/markdown') return 'md';
    if (file.mime === 'text/csv') return 'csv';
    if (file.binary) return 'binary';
    return 'code';
  }, [file]);
  const [tab, setTab] = useState<'apercu' | 'source'>('apercu');
  const csv = useMemo(() => (kind === 'csv' ? file.content.split(/\r?\n/).filter(Boolean).slice(0, 200).map((l) => l.split(l.includes(';') ? ';' : ',')) : []), [kind, file.content]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {['html', 'md', 'svg', 'csv'].includes(kind) && (
          <div className="inline-flex rounded-lg border border-line p-0.5 text-xs">
            {(['apercu', 'source'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cx('px-2.5 py-1 rounded-md', tab === t ? 'bg-surface-3 font-medium' : 'text-muted')}>
                {t === 'apercu' ? 'Aperçu' : 'Source'}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {onEdit && !file.binary && (
            <Button size="sm" onClick={onEdit}>
              <Pencil size={13} /> Modifier
            </Button>
          )}
          {kind === 'md' && (
            <Button size="sm" onClick={() => printAsPdf(file.path, marked.parse(file.content, { async: false }) as string)}>
              PDF
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={() => downloadFile(file)}>
            <Download size={13} /> Télécharger
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted">
        {file.mime} · {formatSize(file.size)} · modifié {timeAgo(file.updatedAt)}
      </div>
      {tab === 'apercu' && kind === 'html' && (
        <iframe title={file.path} sandbox="allow-scripts allow-modals" srcDoc={file.content} className="w-full h-[60vh] rounded-xl border border-line bg-white" />
      )}
      {tab === 'apercu' && kind === 'svg' && <img alt={file.path} className="max-w-full rounded-xl border border-line bg-white" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(file.content)}`} />}
      {kind === 'image' && <img alt={file.path} className="max-w-full rounded-xl border border-line" src={file.content} />}
      {tab === 'apercu' && kind === 'md' && (
        <div className="card p-4">
          <Markdown text={file.content} />
        </div>
      )}
      {tab === 'apercu' && kind === 'csv' && (
        <div className="overflow-auto max-h-[60vh] card">
          <table className="text-xs">
            <tbody>
              {csv.map((r, i) => (
                <tr key={i} className={i === 0 ? 'bg-surface-2 font-semibold' : ''}>
                  {r.map((c, j) => (
                    <td key={j} className="border-b border-line px-2 py-1 whitespace-nowrap">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(kind === 'code' || (tab === 'source' && kind !== 'image')) && (
        <pre className="text-xs font-mono bg-surface-2 border border-line rounded-xl p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words">{file.content}</pre>
      )}
      {kind === 'binary' && <p className="text-sm text-muted">Aperçu indisponible pour ce type de fichier. Téléchargez-le pour l’ouvrir.</p>}
    </div>
  );
}

export function providerLabel(m: ModelRef) {
  return `${providerInfo(m.provider)?.label || m.provider} · ${m.model}`;
}

export function ModelSelectInline({ value, onChange }: { value?: ModelRef; onChange: (m?: ModelRef) => void }) {
  const s = useSettings();
  const options = PROVIDERS.filter((p) => s.providers[p.id]?.enabled).flatMap((p) =>
    Array.from(new Set([...(s.providers[p.id]?.models || []), ...p.defaultModels])).map((m) => ({ provider: p.id, model: m })),
  );
  return (
    <Select
      value={value ? `${value.provider}::${value.model}` : ''}
      onChange={(e) => {
        const [provider, model] = e.target.value.split('::');
        onChange(e.target.value ? { provider: provider as ModelRef['provider'], model } : undefined);
      }}
    >
      <option value="">Modèle par défaut</option>
      {options.map((o) => (
        <option key={`${o.provider}::${o.model}`} value={`${o.provider}::${o.model}`}>
          {providerLabel(o)}
        </option>
      ))}
    </Select>
  );
}
