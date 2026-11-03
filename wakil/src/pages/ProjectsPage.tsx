import { ArrowLeft, FileText, FolderKanban, MessageSquare, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../core/db';
import { PROJECT_COLORS } from '../core/defaults';
import { createChat, createProject, updateProject } from '../core/store';
import type { Chat, Project, Task, WorkspaceFile } from '../core/types';
import { go, timeAgo, useCollection, useLive } from '../ui/hooks';
import { Button, cx, Empty, Field, Input, Modal, PageHeader, Textarea } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';
import { StatusBadge } from '../ui/widgets';
import { NewTaskModal } from './TasksPage';

function ProjectModal({ project, onClose }: { project?: Project | null; onClose: () => void }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [instructions, setInstructions] = useState(project?.instructions || '');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0]);
  return (
    <Modal
      open={project !== undefined}
      onClose={onClose}
      title={project ? 'Modifier le projet' : 'Nouveau projet'}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={async () => {
              if (project) await updateProject(project.id, { name, description, instructions, color });
              else {
                const p = await createProject({ name, description, instructions, color });
                go(`projects/${p.id}`);
              }
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Nom">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex. : Agence Al Wasset 777" />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="En une phrase" />
      </Field>
      <Field label="Consignes permanentes" hint="Wakil les applique à chaque conversation et tâche de ce projet (ton, langue, contexte, contraintes).">
        <Textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex. : Réponds en français simple. Les prix sont en dirhams. Notre cible : familles à Meknès." />
      </Field>
      <div className="flex gap-2">
        {PROJECT_COLORS.map((c) => (
          <button key={c} aria-label={`Couleur ${c}`} onClick={() => setColor(c)} className={cx('size-7 rounded-full border-2', color === c ? 'border-ink' : 'border-transparent')} style={{ background: c }} />
        ))}
      </div>
    </Modal>
  );
}

export function ProjectsPage({ id }: { id?: string }) {
  const projects = useCollection<Project>('projects');
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  if (id) return <ProjectDetail id={id} />;
  return (
    <PageScroll>
      <PageHeader
        title="Projets"
        subtitle="Regroupez conversations, tâches, fichiers et consignes par sujet."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            <Plus size={15} /> Nouveau projet
          </Button>
        }
      />
      {projects && !projects.length && <Empty icon={<FolderKanban />} title="Aucun projet" text="Créez un projet pour donner à Wakil un contexte permanent (ex. votre agence)." action={<Button variant="primary" onClick={() => setEditing(null)}>Créer un projet</Button>} />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects
          ?.sort((a, b) => b.updatedAt - a.updatedAt)
          .map((p) => (
            <a key={p.id} href={`#/projects/${p.id}`} className="card p-4 hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="size-3 rounded-full" style={{ background: p.color }} />
                <span className="font-semibold truncate">{p.name}</span>
              </div>
              <p className="text-sm text-muted mt-2 line-clamp-2 min-h-[2.5em]">{p.description || 'Sans description'}</p>
              <div className="text-xs text-muted mt-2">Modifié {timeAgo(p.updatedAt)}</div>
            </a>
          ))}
      </div>
      {editing !== undefined && <ProjectModal project={editing} onClose={() => setEditing(undefined)} />}
    </PageScroll>
  );
}

function ProjectDetail({ id }: { id: string }) {
  const project = useLive(() => db.get<Project>('projects', id), ['projects'], [id]);
  const chats = useCollection<Chat>('chats');
  const tasks = useCollection<Task>('tasks');
  const files = useCollection<WorkspaceFile>('files');
  const [editing, setEditing] = useState<Project | undefined>();
  const [taskOpen, setTaskOpen] = useState(false);
  if (!project) return null;
  const pc = (chats || []).filter((c) => c.projectId === id);
  const pt = (tasks || []).filter((t) => t.projectId === id);
  const pf = (files || []).filter((f) => f.projectId === id);
  return (
    <PageScroll>
      <Button size="sm" variant="ghost" onClick={() => go('projects')} className="mb-3">
        <ArrowLeft size={15} /> Projets
      </Button>
      <PageHeader
        title={project.name}
        subtitle={project.description}
        actions={
          <>
            <Button onClick={() => setEditing(project)}>
              <Pencil size={14} /> Modifier
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm('Supprimer ce projet ? (les conversations et fichiers sont conservés)')) return;
                await db.remove('projects', id);
                go('projects');
              }}
            >
              <Trash2 size={14} />
            </Button>
          </>
        }
      />
      {project.instructions && (
        <div className="card p-4 mb-4 text-sm">
          <div className="text-xs text-muted mb-1">Consignes permanentes</div>
          <div className="whitespace-pre-wrap">{project.instructions}</div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-5">
        <Button
          variant="primary"
          onClick={async () => {
            const c = await createChat({ projectId: id });
            go(`chat/${c.id}`);
          }}
        >
          <MessageSquare size={15} /> Conversation dans ce projet
        </Button>
        <Button onClick={() => setTaskOpen(true)}>
          <Play size={15} /> Tâche autonome
        </Button>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="card p-4">
          <h2 className="font-semibold mb-2">Conversations ({pc.length})</h2>
          {pc.map((c) => (
            <a key={c.id} href={`#/chat/${c.id}`} className="block py-2 border-b border-line last:border-0 text-sm truncate hover:text-accent">
              {c.title}
            </a>
          ))}
        </section>
        <section className="card p-4">
          <h2 className="font-semibold mb-2">Tâches ({pt.length})</h2>
          {pt.map((t) => (
            <a key={t.id} href={`#/task/${t.id}`} className="flex items-center gap-2 py-2 border-b border-line last:border-0 text-sm">
              <span className="truncate flex-1">{t.title}</span>
              <StatusBadge status={t.status} />
            </a>
          ))}
        </section>
        <section className="card p-4">
          <h2 className="font-semibold mb-2">Fichiers ({pf.length})</h2>
          {pf.map((f) => (
            <a key={f.id} href={`#/files/${f.id}`} className="flex items-center gap-2 py-2 border-b border-line last:border-0 text-sm hover:text-accent">
              <FileText size={14} className="text-muted shrink-0" />
              <span className="truncate">{f.path}</span>
            </a>
          ))}
        </section>
      </div>
      {editing && <ProjectModal project={editing} onClose={() => setEditing(undefined)} />}
      <NewTaskModal open={taskOpen} onClose={() => setTaskOpen(false)} projectId={id} />
    </PageScroll>
  );
}
