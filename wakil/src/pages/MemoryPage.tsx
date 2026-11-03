import { Brain, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../core/db';
import { addMemory } from '../core/store';
import type { Memory, Project } from '../core/types';
import { timeAgo, useCollection } from '../ui/hooks';
import { Badge, Button, Empty, IconButton, Input, PageHeader, Select } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';

export function MemoryPage() {
  const memory = useCollection<Memory>('memory');
  const projects = useCollection<Project>('projects');
  const [text, setText] = useState('');
  const [proj, setProj] = useState('');
  return (
    <PageScroll narrow>
      <PageHeader title="Mémoire" subtitle="Ce que Wakil retient de vous d’une conversation à l’autre. Vous gardez le contrôle total." />
      <form
        className="card p-3 flex flex-wrap gap-2 mb-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await addMemory(text, { projectId: proj || undefined });
          setText('');
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : Je dirige l’agence Al Wasset 777 à Meknès." className="flex-1 min-w-[220px]" aria-label="Nouveau souvenir" />
        <Select value={proj} onChange={(e) => setProj(e.target.value)} className="w-auto" aria-label="Portée">
          <option value="">Tous les projets</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button variant="primary" type="submit">
          <Plus size={15} /> Ajouter
        </Button>
      </form>
      {memory && !memory.length && <Empty icon={<Brain />} title="Mémoire vide" text="Ajoutez vos préférences, ou laissez l’agent mémoriser des faits utiles (outil « Mémoriser »)." />}
      <div className="card divide-y divide-[var(--line)]">
        {memory
          ?.sort((a, b) => b.updatedAt - a.updatedAt)
          .map((m) => (
            <div key={m.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm whitespace-pre-wrap" dir="auto">
                  {m.content}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                  <Badge tone={m.source === 'agent' ? 'accent' : 'mint'}>{m.source === 'agent' ? 'appris par l’agent' : 'ajouté par vous'}</Badge>
                  {m.projectId && <Badge>{projects?.find((p) => p.id === m.projectId)?.name || 'projet'}</Badge>}
                  {m.tags.map((t) => (
                    <Badge key={t}>#{t}</Badge>
                  ))}
                  <span className="text-xs text-muted">{timeAgo(m.updatedAt)}</span>
                </div>
              </div>
              <IconButton label="Oublier" onClick={() => db.remove('memory', m.id)}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
      </div>
    </PageScroll>
  );
}
