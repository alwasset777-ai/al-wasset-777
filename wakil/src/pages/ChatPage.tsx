import { ArrowLeft, ChevronRight, Copy, MessageSquare, Pin, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { send, stop } from '../agent/runtime';
import { db } from '../core/db';
import { currentModel, deleteChat, getMessages, updateChat } from '../core/store';
import type { AgentProfile, Chat, ChatMode, Message, Project } from '../core/types';
import { Composer } from '../ui/Composer';
import { go, timeAgo, useCollection, useLive, useMedia, useRunning } from '../ui/hooks';
import { Markdown } from '../ui/Markdown';
import { Badge, Button, cx, Empty, IconButton, Input, Select, toast } from '../ui/primitives';
import { newChat } from '../ui/Shell';
import { TaskCard } from '../ui/widgets';

export function ChatList({ activeId, onPick }: { activeId?: string; onPick?: () => void }) {
  const chats = useCollection<Chat>('chats');
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      (chats || [])
        .filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt),
    [chats, q],
  );
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 space-y-2 border-b border-line">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-9 h-9 text-sm" aria-label="Rechercher une conversation" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {chats && !list.length && <p className="text-sm text-muted text-center py-8">Aucune conversation.</p>}
        {list.map((c) => (
          <a
            key={c.id}
            href={`#/chat/${c.id}`}
            onClick={onPick}
            className={cx('block rounded-xl px-3 py-2.5', c.id === activeId ? 'bg-surface-3' : 'hover:bg-surface-2')}
          >
            <div className="flex items-center gap-2">
              {c.pinned && <Pin size={12} className="text-accent shrink-0" />}
              <span className="truncate text-sm font-medium">{c.title}</span>
              {c.mode === 'agent' && (
                <Badge tone="accent" className="ml-auto">
                  agent
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted mt-0.5">{timeAgo(c.updatedAt)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ToolMessage({ m }: { m: Message }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pl-1">
      <button onClick={() => setOpen((v) => !v)} className={cx('inline-flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 border', m.error ? 'border-danger/40 text-danger' : 'border-line text-muted hover:bg-surface-2')}>
        <Wrench size={12} /> Résultat de {m.toolName}
        <ChevronRight size={12} className={cx('transition-transform', open && 'rotate-90')} />
      </button>
      {open && <pre className="mt-1.5 text-xs bg-surface-2 border border-line rounded-lg p-2.5 whitespace-pre-wrap break-words max-h-72 overflow-auto">{m.content}</pre>}
    </div>
  );
}

function MessageView({ m, chatId }: { m: Message; chatId: string }) {
  if (m.role === 'tool') return <ToolMessage m={m} />;
  if (m.role === 'user')
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-[15px] whitespace-pre-wrap break-words" dir="auto">
          {m.content}
          {!!m.attachments?.length && <div className="mt-1.5 text-xs text-muted">📎 {m.attachments.map((a) => a.name).join(', ')}</div>}
        </div>
      </div>
    );
  return (
    <div className="space-y-2 group">
      {m.taskId && <TaskCard taskId={m.taskId} chatId={chatId} />}
      {!!m.toolCalls?.length && (
        <div className="flex flex-wrap gap-1.5">
          {m.content && <Markdown text={m.content} className="w-full" />}
          {m.toolCalls.map((c) => (
            <Badge key={c.id} tone="accent">
              <Wrench size={11} /> {c.name}
            </Badge>
          ))}
        </div>
      )}
      {!m.toolCalls?.length && m.content && (
        <div className={cx(m.error && 'text-danger')}>
          <Markdown text={m.content} />
          <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
            <IconButton
              label="Copier"
              className="size-7"
              onClick={() => {
                navigator.clipboard?.writeText(m.content);
                toast('Copié', 'ok');
              }}
            >
              <Copy size={14} />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Conversation({ chatId }: { chatId: string }) {
  const chat = useLive(() => db.get<Chat>('chats', chatId), ['chats'], [chatId]);
  const messages = useLive(() => getMessages(chatId), ['messages'], [chatId]);
  const agents = useCollection<AgentProfile>('agents');
  const projects = useCollection<Project>('projects');
  const running = useRunning(chatId);
  const desktop = useMedia('(min-width: 900px)');
  const bottom = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ChatMode>('chat');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (chat) setMode(chat.mode);
  }, [chat?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length, running]);

  if (chat === undefined && messages === undefined) return null;
  if (!chat)
    return <Empty icon={<MessageSquare />} title="Conversation introuvable" action={<Button onClick={() => go('chat')}>Retour</Button>} />;
  const agent = agents?.find((a) => a.id === chat.agentId);
  const model = currentModel(chat, agent);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-line px-3 sm:px-5 py-2 space-y-2 md:space-y-0 md:flex md:items-center md:gap-2">
        <div className="flex items-center gap-1.5 min-w-0 md:flex-1">
          {!desktop && (
            <IconButton label="Retour" onClick={() => go('chat')}>
              <ArrowLeft size={18} />
            </IconButton>
          )}
          {editing ? (
            <Input
              autoFocus
              defaultValue={chat.title}
              className="h-8 max-w-xs"
              onBlur={(e) => {
                updateChat(chat.id, { title: e.target.value.trim() || chat.title });
                setEditing(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button className="font-semibold truncate min-w-0 text-left" title="Renommer" onClick={() => setEditing(true)}>
              {chat.title}
            </button>
          )}
          <div className="ml-auto flex items-center md:order-last">
            <IconButton label={chat.pinned ? 'Désépingler' : 'Épingler'} onClick={() => updateChat(chat.id, { pinned: !chat.pinned })}>
              <Pin size={16} className={chat.pinned ? 'text-accent' : ''} />
            </IconButton>
            <IconButton
              label="Supprimer la conversation"
              onClick={async () => {
                if (!confirm('Supprimer cette conversation ?')) return;
                await deleteChat(chat.id);
                go('chat');
              }}
            >
              <Trash2 size={16} />
            </IconButton>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Select className="h-8 text-xs w-auto max-w-[170px] shrink-0" value={chat.agentId || ''} onChange={(e) => updateChat(chat.id, { agentId: e.target.value || undefined })} aria-label="Agent">
            <option value="">Agent : Wakil</option>
            {agents
              ?.filter((a) => a.id !== 'agent_general')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name}
                </option>
              ))}
          </Select>
          <Select className="h-8 text-xs w-auto max-w-[170px] shrink-0" value={chat.projectId || ''} onChange={(e) => updateChat(chat.id, { projectId: e.target.value || undefined })} aria-label="Projet">
            <option value="">Sans projet</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {!messages?.length && (
            <div className="text-center py-10 text-muted text-sm">
              <p className="font-medium text-ink mb-1">{mode === 'agent' ? 'Mode agent autonome' : 'Nouvelle conversation'}</p>
              {mode === 'agent'
                ? 'Donnez un objectif complet. Wakil le découpe en étapes, utilise ses outils, vérifie et vous livre les fichiers.'
                : 'Posez une question, demandez un texte, du code, une recherche…'}
            </div>
          )}
          {messages?.map((m) => <MessageView key={m.id} m={m} chatId={chat.id} />)}
          {running && !messages?.some((m) => m.taskId && m.content === '') && (
            <div className="dot-pulse py-2" aria-label="Wakil réfléchit">
              <span />
              <span />
              <span />
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>
      <div className="shrink-0 px-3 sm:px-6 pb-3 pt-1">
        <div className="max-w-3xl mx-auto">
          <Composer
            mode={mode}
            onMode={setMode}
            model={model}
            onModel={(m) => updateChat(chat.id, { model: m })}
            running={running}
            onStop={() => stop(chat.id)}
            onSend={(text, md, att) => void send(chat.id, text, md, att)}
            autoFocus={desktop}
          />
        </div>
      </div>
    </div>
  );
}

export function ChatPage({ id }: { id?: string }) {
  const desktop = useMedia('(min-width: 900px)');
  if (desktop)
    return (
      <div className="h-full flex">
        <div className="w-[290px] shrink-0 border-r border-line flex flex-col">
          <div className="px-4 h-14 flex items-center justify-between border-b border-line">
            <span className="font-semibold">Conversations</span>
            <IconButton label="Nouvelle conversation" onClick={newChat}>
              <Plus size={18} />
            </IconButton>
          </div>
          <div className="flex-1 min-h-0">
            <ChatList activeId={id} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {id ? (
            <Conversation chatId={id} />
          ) : (
            <Empty icon={<MessageSquare />} title="Choisissez ou créez une conversation" action={<Button variant="primary" onClick={newChat}>Nouvelle conversation</Button>} />
          )}
        </div>
      </div>
    );
  return id ? (
    <Conversation chatId={id} />
  ) : (
    <div className="h-full flex flex-col">
      <div className="px-4 h-12 flex items-center justify-between">
        <span className="font-semibold">Conversations</span>
        <Button size="sm" variant="primary" onClick={newChat}>
          <Plus size={15} /> Nouvelle
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <ChatList />
      </div>
    </div>
  );
}
