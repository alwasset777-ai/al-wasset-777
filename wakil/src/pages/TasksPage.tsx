import { ArrowLeft, Bot, MessageSquare, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { launchTask } from '../agent/runtime';
import { db } from '../core/db';
import type { AgentProfile, Project, Task } from '../core/types';
import { go, timeAgo, useCollection, useLive } from '../ui/hooks';
import { Button, cx, Empty, Field, Modal, PageHeader, Select, Textarea } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';
import { StatusBadge, TaskCard } from '../ui/widgets';

const FILTERS = [
  ['all', 'Toutes'],
  ['active', 'En cours'],
  ['done', 'Terminées'],
  ['failed', 'Échecs'],
] as const;

export function NewTaskModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  const agents = useCollection<AgentProfile>('agents');
  const projects = useCollection<Project>('projects');
  const [goal, setGoal] = useState('');
  const [agentId, setAgentId] = useState('');
  const [proj, setProj] = useState(projectId || '');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle tâche autonome"
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!goal.trim()}
            onClick={async () => {
              const { chatId } = await launchTask(goal.trim(), { projectId: proj || undefined, agentId: agentId || undefined });
              setGoal('');
              onClose();
              go(`chat/${chatId}`);
            }}
          >
            <Play size={15} /> Lancer
          </Button>
        </>
      }
    >
      <Field label="Objectif" hint="Soyez précis : ce que vous voulez obtenir, pour qui, sous quel format (rapport, site, tableau…).">
        <Textarea rows={5} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex. : Compare 3 logiciels de gestion immobilière gratuits et livre un tableau comparatif + recommandation." autoFocus />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Agent">
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Wakil (général)</option>
            {agents
              ?.filter((a) => a.id !== 'agent_general')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Projet">
          <Select value={proj} onChange={(e) => setProj(e.target.value)}>
            <option value="">Aucun</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export function TasksPage() {
  const tasks = useCollection<Task>('tasks');
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const [open, setOpen] = useState(false);
  const list = useMemo(
    () =>
      (tasks || [])
        .filter((t) =>
          filter === 'all' ? true : filter === 'active' ? ['queued', 'planning', 'running', 'verifying', 'waiting'].includes(t.status) : filter === 'done' ? t.status === 'done' : ['failed', 'cancelled'].includes(t.status),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [tasks, filter],
  );
  return (
    <PageScroll>
      <PageHeader
        title="Tâches"
        subtitle="Planificateur : chaque objectif est découpé en étapes, exécuté, vérifié puis livré."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Play size={15} /> Nouvelle tâche
          </Button>
        }
      />
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cx('rounded-full px-3 h-8 text-[13px] border', filter === k ? 'bg-ink text-bg border-ink' : 'border-line text-muted hover:bg-surface-2')}>
            {l}
          </button>
        ))}
      </div>
      {tasks && !list.length && <Empty icon={<Bot />} title="Aucune tâche" text="Lancez une tâche autonome : Wakil travaille pour vous, étape par étape." action={<Button variant="primary" onClick={() => setOpen(true)}>Nouvelle tâche</Button>} />}
      <div className="grid gap-3">
        {list.map((t) => {
          const done = t.steps.filter((s) => s.status === 'done').length;
          return (
            <a key={t.id} href={`#/task/${t.id}`} className="card p-4 hover:bg-surface-2 transition-colors block">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug">{t.title}</div>
                  <div className="text-xs text-muted mt-1 line-clamp-2">{t.goal}</div>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                <div className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${t.steps.length ? (done / t.steps.length) * 100 : 0}%` }} />
                </div>
                <span>
                  {done}/{t.steps.length} étapes
                </span>
                <span>{t.fileIds.length} fichier(s)</span>
                <span>{timeAgo(t.updatedAt)}</span>
              </div>
            </a>
          );
        })}
      </div>
      <NewTaskModal open={open} onClose={() => setOpen(false)} />
    </PageScroll>
  );
}

export function TaskDetailPage({ id }: { id: string }) {
  const task = useLive(() => db.get<Task>('tasks', id), ['tasks'], [id]);
  if (task === undefined) return null;
  return (
    <PageScroll narrow>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button size="sm" variant="ghost" onClick={() => history.back()}>
          <ArrowLeft size={15} /> Retour
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {task.chatId && (
            <Button size="sm" onClick={() => go(`chat/${task.chatId}`)}>
              <MessageSquare size={14} /> Conversation
            </Button>
          )}
          {['done', 'failed', 'cancelled'].includes(task.status) && (
            <Button
              size="sm"
              onClick={async () => {
                const { chatId } = await launchTask(task.goal, { projectId: task.projectId, agentId: task.agentId });
                go(`chat/${chatId}`);
              }}
            >
              <RotateCcw size={14} /> Relancer
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (!confirm('Supprimer cette tâche ?')) return;
              await db.remove('tasks', task.id);
              go('tasks');
            }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <div className="card p-4 mb-4">
        <div className="text-xs text-muted mb-1">Objectif</div>
        <div className="whitespace-pre-wrap text-sm">{task.goal}</div>
        {task.model && <div className="text-xs text-muted mt-2">Modèle : {task.model.provider} · {task.model.model} · {task.iterations} actions</div>}
      </div>
      <TaskCard taskId={task.id} chatId={task.chatId} full />
    </PageScroll>
  );
}

export function useProjectsMap() {
  const projects = useCollection<Project>('projects');
  return useMemo(() => new Map((projects || []).map((p) => [p.id, p])), [projects]);
}
