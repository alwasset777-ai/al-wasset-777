import { ArrowLeft, FileCode, FilePlus, FileText, FolderArchive, Image, Search, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { readAttachment } from '../agent/runtime';
import { db } from '../core/db';
import { writeFile } from '../core/store';
import type { Project, WorkspaceFile } from '../core/types';
import { downloadZip } from '../ui/files';
import { formatSize, go, timeAgo, useCollection, useLive } from '../ui/hooks';
import { Button, Empty, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, toast } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';
import { FilePreview } from '../ui/widgets';

const iconFor = (f: WorkspaceFile) => (f.mime.startsWith('image/') ? Image : /html|javascript|json|python|css/.test(f.mime) ? FileCode : FileText);

function EditModal({ file, onClose }: { file?: WorkspaceFile | null; onClose: () => void }) {
  const projects = useCollection<Project>('projects');
  const [path, setPath] = useState(file?.path || 'nouveau.md');
  const [content, setContent] = useState(file?.content || '');
  const [projectId, setProjectId] = useState(file?.projectId || '');
  return (
    <Modal
      open={file !== undefined}
      onClose={onClose}
      wide
      title={file ? `Modifier ${file.path}` : 'Nouveau fichier'}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (file && file.path !== path) await db.remove('files', file.id);
              const f = await writeFile(path, content, { projectId: projectId || undefined, taskId: file?.taskId });
              toast('Fichier enregistré', 'ok');
              onClose();
              go(`files/${f.id}`);
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Chemin">
          <Input value={path} onChange={(e) => setPath(e.target.value)} />
        </Field>
        <Field label="Projet">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Aucun</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Contenu">
        <Textarea rows={16} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-[13px]" spellCheck={false} />
      </Field>
    </Modal>
  );
}

export function FilesPage({ id }: { id?: string }) {
  const files = useCollection<WorkspaceFile>('files');
  const projects = useCollection<Project>('projects');
  const [q, setQ] = useState('');
  const [proj, setProj] = useState('*');
  const [editing, setEditing] = useState<WorkspaceFile | null | undefined>(undefined);
  const upload = useRef<HTMLInputElement>(null);
  const current = useLive(() => (id ? db.get<WorkspaceFile>('files', id) : Promise.resolve(undefined)), ['files'], [id]);

  const list = useMemo(
    () =>
      (files || [])
        .filter((f) => (proj === '*' ? true : (f.projectId || '') === proj))
        .filter((f) => !q || f.path.toLowerCase().includes(q.toLowerCase()) || (!f.binary && f.content.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [files, q, proj],
  );

  if (id && current)
    return (
      <PageScroll>
        <div className="flex items-center gap-2 mb-4">
          <Button size="sm" variant="ghost" onClick={() => go('files')}>
            <ArrowLeft size={15} /> Fichiers
          </Button>
          <h1 className="font-semibold truncate">{current.path}</h1>
          <IconButton
            className="ml-auto"
            label="Supprimer"
            onClick={async () => {
              if (!confirm(`Supprimer ${current.path} ?`)) return;
              await db.remove('files', current.id);
              go('files');
            }}
          >
            <Trash2 size={16} />
          </IconButton>
        </div>
        <FilePreview file={current} onEdit={() => setEditing(current)} />
        {editing !== undefined && <EditModal key={editing?.id || 'new'} file={editing} onClose={() => setEditing(undefined)} />}
      </PageScroll>
    );

  return (
    <PageScroll>
      <PageHeader
        title="Fichiers"
        subtitle="Espace de travail : tout ce que Wakil crée, plus vos documents."
        actions={
          <>
            <input
              ref={upload}
              type="file"
              multiple
              hidden
              onChange={async (e) => {
                for (const f of Array.from(e.target.files || [])) {
                  const a = await readAttachment(f);
                  await writeFile(f.name, a.text ?? `data:${a.mime};base64,${a.base64}`, { projectId: proj !== '*' && proj ? proj : undefined, binary: a.text === undefined });
                }
                e.target.value = '';
                toast('Fichier(s) importé(s)', 'ok');
              }}
            />
            <Button onClick={() => upload.current?.click()}>
              <Upload size={15} /> Importer
            </Button>
            <Button onClick={() => setEditing(null)}>
              <FilePlus size={15} /> Nouveau
            </Button>
            <Button variant="primary" disabled={!list.length} onClick={() => downloadZip(list)}>
              <FolderArchive size={15} /> Tout exporter (.zip)
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans les noms et contenus…" className="pl-9" aria-label="Rechercher un fichier" />
        </div>
        <Select value={proj} onChange={(e) => setProj(e.target.value)} className="w-auto" aria-label="Filtrer par projet">
          <option value="*">Tous les projets</option>
          <option value="">Sans projet</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      {files && !list.length && <Empty icon={<FileText />} title="Aucun fichier" text="Les rapports, sites, codes et tableaux créés par Wakil apparaîtront ici." />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((f) => {
          const Icon = iconFor(f);
          return (
            <a key={f.id} href={`#/files/${f.id}`} className="card p-3.5 flex gap-3 hover:bg-surface-2 transition-colors">
              <div className="size-10 rounded-xl bg-surface-2 flex items-center justify-center text-accent shrink-0">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{f.path}</div>
                <div className="text-xs text-muted">
                  {formatSize(f.size)} · {timeAgo(f.updatedAt)}
                </div>
              </div>
            </a>
          );
        })}
      </div>
      {editing !== undefined && <EditModal key="new" file={editing} onClose={() => setEditing(undefined)} />}
    </PageScroll>
  );
}
