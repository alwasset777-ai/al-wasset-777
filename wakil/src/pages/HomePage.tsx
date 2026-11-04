import { AlertTriangle, Bot, FileText, ListChecks, MessageSquare, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { send } from '../agent/runtime';
import { EXAMPLE_GOALS, providerInfo } from '../core/defaults';
import { createChat, getProfile, saveSettings } from '../core/store';
import type { Chat, ChatMode, Task, WorkspaceFile } from '../core/types';
import { Composer } from '../ui/Composer';
import { go, timeAgo, useCollection, useLive, useSettings } from '../ui/hooks';
import { PageScroll } from '../ui/Shell';
import { StatusBadge } from '../ui/widgets';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
}

export function HomePage() {
  const s = useSettings();
  const profile = useLive(getProfile, ['profile']);
  const chats = useCollection<Chat>('chats');
  const tasks = useCollection<Task>('tasks');
  const files = useCollection<WorkspaceFile>('files');
  const [mode, setMode] = useState<ChatMode>('agent');
  const [initial, setInitial] = useState('');
  const p = providerInfo(s.defaultModel.provider);
  const missingKey = p.needsKey && !s.providers[p.id]?.apiKey;

  async function start(text: string, md: ChatMode, att: Parameters<typeof send>[3]) {
    const chat = await createChat({ title: 'Nouvelle conversation', mode: md });
    go(`chat/${chat.id}`);
    void send(chat.id, text, md, att);
  }

  const recentTasks = (tasks || []).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const recentChats = (chats || []).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  return (
    <PageScroll>
      <div className="brand-gradient rounded-3xl -mx-2 px-2 sm:px-6 pt-6 sm:pt-10 pb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {greeting()}
          {profile?.name ? `, ${profile.name}` : ''}.
        </h1>
        <p className="text-muted mt-1.5">Que dois-je accomplir pour vous aujourd’hui ?</p>
        {s.defaultModel.provider === 'demo' && (
          <a href="#/settings/models" className="mt-4 flex items-center gap-2 rounded-xl border border-mint/40 bg-mint-soft px-3 py-2.5 text-sm">
            <AlertTriangle size={16} className="text-mint shrink-0" />
            <span>
              <b>Mode démonstration</b> : recherche et fichiers réels, sans intelligence artificielle. Ajoutez une clé gratuite pour tout débloquer →
            </span>
          </a>
        )}
        {missingKey && (
          <a href="#/settings/models" className="mt-4 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2.5 text-sm">
            <AlertTriangle size={16} className="text-accent shrink-0" />
            <span>
              Ajoutez votre clé <b>{p.label}</b> gratuite pour activer l’IA →
            </span>
          </a>
        )}
        <div className="mt-5">
          <Composer
            mode={mode}
            onMode={setMode}
            model={s.defaultModel}
            onModel={(m) => saveSettings({ defaultModel: m })}
            onSend={start}
            initial={initial}
            autoFocus={matchMedia('(pointer: fine)').matches}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_GOALS.map((g) => (
            <button key={g} onClick={() => setInitial(g + ' ')} className="text-left text-xs rounded-full border border-line bg-surface hover:bg-surface-2 px-3 py-1.5 text-muted max-w-full truncate">
              <Sparkles size={11} className="inline mr-1 text-accent" />
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {[
          { label: 'Conversations', n: chats?.length, icon: MessageSquare, href: 'chat' },
          { label: 'Tâches agent', n: tasks?.length, icon: Bot, href: 'tasks' },
          { label: 'Tâches réussies', n: tasks?.filter((t) => t.status === 'done').length, icon: ListChecks, href: 'tasks' },
          { label: 'Fichiers créés', n: files?.length, icon: FileText, href: 'files' },
        ].map((c) => (
          <a key={c.label} href={`#/${c.href}`} className="card p-4 hover:bg-surface-2 transition-colors">
            <c.icon size={18} className="text-accent" />
            <div className="text-2xl font-semibold mt-2">{c.n ?? '–'}</div>
            <div className="text-xs text-muted">{c.label}</div>
          </a>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <section className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Tâches récentes</h2>
            <a href="#/tasks" className="text-xs text-mint hover:underline">
              Tout voir
            </a>
          </div>
          {!recentTasks.length && <p className="text-sm text-muted py-4">Lancez votre première tâche en mode « Agent autonome ».</p>}
          {recentTasks.map((t) => (
            <a key={t.id} href={`#/task/${t.id}`} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{t.title}</div>
                <div className="text-xs text-muted">{timeAgo(t.updatedAt)}</div>
              </div>
              <StatusBadge status={t.status} />
            </a>
          ))}
        </section>
        <section className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Conversations récentes</h2>
            <a href="#/chat" className="text-xs text-mint hover:underline">
              Tout voir
            </a>
          </div>
          {!recentChats.length && <p className="text-sm text-muted py-4">Aucune conversation pour l’instant.</p>}
          {recentChats.map((c) => (
            <a key={c.id} href={`#/chat/${c.id}`} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
              <MessageSquare size={15} className="text-muted shrink-0" />
              <span className="text-sm truncate flex-1">{c.title}</span>
              <span className="text-xs text-muted shrink-0">{timeAgo(c.updatedAt)}</span>
            </a>
          ))}
        </section>
      </div>
    </PageScroll>
  );
}
