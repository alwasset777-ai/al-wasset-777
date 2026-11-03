import { Bot, FileText, History, MessageSquare, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../core/db';
import type { Chat, Message, Task, WorkspaceFile } from '../core/types';
import { timeAgo } from '../ui/hooks';
import { Empty, Input, PageHeader } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';

interface Hit {
  kind: 'chat' | 'task' | 'file';
  id: string;
  href: string;
  title: string;
  excerpt: string;
  at: number;
}

function excerpt(text: string, q: string) {
  if (!q) return text.slice(0, 140);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 140);
  return (i > 40 ? '…' : '') + text.slice(Math.max(0, i - 40), i + 100) + '…';
}

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const diff = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  if (diff < 7) return 'Cette semaine';
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function HistoryPage() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>();
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const [chats, messages, tasks, files] = await Promise.all([db.all<Chat>('chats'), db.all<Message>('messages'), db.all<Task>('tasks'), db.all<WorkspaceFile>('files')]);
      const ql = q.toLowerCase().trim();
      const out: Hit[] = [];
      const chatMap = new Map(chats.map((c) => [c.id, c]));
      const seen = new Set<string>();
      for (const m of messages.sort((a, b) => b.createdAt - a.createdAt)) {
        if (m.role === 'tool' || !m.content) continue;
        const c = chatMap.get(m.chatId);
        if (!c) continue;
        if (ql && !m.content.toLowerCase().includes(ql) && !c.title.toLowerCase().includes(ql)) continue;
        if (!ql && seen.has(c.id)) continue;
        seen.add(c.id);
        out.push({ kind: 'chat', id: m.id, href: `#/chat/${c.id}`, title: c.title, excerpt: excerpt(m.content, ql), at: m.createdAt });
      }
      for (const t of tasks) if (!ql || (t.goal + t.title + (t.result || '')).toLowerCase().includes(ql)) out.push({ kind: 'task', id: t.id, href: `#/task/${t.id}`, title: t.title, excerpt: excerpt(t.result || t.goal, ql), at: t.updatedAt });
      for (const f of files) if (!ql || f.path.toLowerCase().includes(ql) || (!f.binary && f.content.toLowerCase().includes(ql))) out.push({ kind: 'file', id: f.id, href: `#/files/${f.id}`, title: f.path, excerpt: f.binary ? f.mime : excerpt(f.content, ql), at: f.updatedAt });
      if (alive) setHits(out.sort((a, b) => b.at - a.at).slice(0, 300));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const groups = useMemo(() => {
    const g = new Map<string, Hit[]>();
    for (const h of hits || []) {
      const k = dayLabel(h.at);
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(h);
    }
    return [...g.entries()];
  }, [hits]);

  const Icon = { chat: MessageSquare, task: Bot, file: FileText };
  return (
    <PageScroll narrow>
      <PageHeader title="Historique" subtitle="Recherchez dans toutes vos conversations, tâches et fichiers." />
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un mot, un sujet, un fichier…" className="pl-9 h-11" autoFocus aria-label="Rechercher dans l'historique" />
      </div>
      {hits && !hits.length && <Empty icon={<History />} title={q ? 'Aucun résultat' : 'Historique vide'} />}
      {groups.map(([label, list]) => (
        <section key={label} className="mb-5">
          <h2 className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">{label}</h2>
          <div className="card divide-y divide-[var(--line)]">
            {list.map((h) => {
              const I = Icon[h.kind];
              return (
                <a key={h.kind + h.id} href={h.href} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                  <I size={16} className="text-muted mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{h.title}</span>
                      <span className="text-xs text-muted ml-auto shrink-0">{timeAgo(h.at)}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5 line-clamp-2">{h.excerpt}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </PageScroll>
  );
}
