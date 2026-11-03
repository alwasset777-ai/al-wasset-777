// Accès « métier » aux données : réglages, conversations, tâches, fichiers, mémoire…
import { db, now, uid } from './db';
import { BUILTIN_AGENTS, DEFAULT_SETTINGS } from './defaults';
import { setProviderConfigResolver } from './providers';
import type { AgentProfile, AppLog, Chat, ChatMode, ID, Memory, Message, ModelRef, Project, Settings, Task, UserProfile, WorkspaceFile } from './types';

let settings: Settings = { ...DEFAULT_SETTINGS };
const settingsListeners = new Set<(s: Settings) => void>();

export async function initStore(): Promise<Settings> {
  const saved = await db.get<Settings>('settings', 'settings');
  settings = { ...DEFAULT_SETTINGS, ...(saved || {}), providers: { ...DEFAULT_SETTINGS.providers, ...(saved?.providers || {}) } };
  setProviderConfigResolver((p) => settings.providers[p]);
  // Agents intégrés : (ré)installés s'ils manquent.
  const agents = await db.allIncludingDeleted<AgentProfile>('agents');
  const missing = BUILTIN_AGENTS.filter((a) => !agents.some((x) => x.id === a.id));
  if (missing.length) await db.putMany('agents', missing.map((a) => ({ ...a, createdAt: now(), updatedAt: now() })));
  return settings;
}

export const getSettings = () => settings;

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  settings = { ...settings, ...patch, id: 'settings' };
  await db.put('settings', settings);
  settingsListeners.forEach((l) => l(settings));
  return settings;
}

export function onSettings(fn: (s: Settings) => void) {
  settingsListeners.add(fn);
  return () => settingsListeners.delete(fn);
}

export function currentModel(chat?: { model?: ModelRef }, agent?: AgentProfile): ModelRef {
  return chat?.model || agent?.model || settings.defaultModel;
}

// ------------------------------------------------------------- profil
export async function getProfile(): Promise<UserProfile | undefined> {
  return db.get<UserProfile>('profile', 'me');
}
export async function saveProfile(p: Partial<UserProfile>) {
  const cur = (await getProfile()) || { id: 'me', name: '', createdAt: now(), updatedAt: now() };
  return db.put<UserProfile>('profile', { ...cur, ...p, id: 'me', updatedAt: now() });
}

// ------------------------------------------------------------- projets
export async function createProject(p: Partial<Project>): Promise<Project> {
  const project: Project = {
    id: uid('prj_'),
    name: p.name || 'Nouveau projet',
    description: p.description || '',
    instructions: p.instructions || '',
    color: p.color || '#E0A43B',
    icon: p.icon || '◆',
    createdAt: now(),
    updatedAt: now(),
  };
  return db.put('projects', project);
}
export const updateProject = async (id: ID, patch: Partial<Project>) => {
  const p = await db.get<Project>('projects', id);
  if (p) await db.put('projects', { ...p, ...patch, updatedAt: now() });
};

// ------------------------------------------------------------- chats
export async function createChat(opts: { title?: string; projectId?: ID; agentId?: ID; mode?: ChatMode; model?: ModelRef } = {}): Promise<Chat> {
  const chat: Chat = {
    id: uid('cht_'),
    title: opts.title || 'Nouvelle conversation',
    projectId: opts.projectId,
    agentId: opts.agentId,
    mode: opts.mode || 'chat',
    model: opts.model,
    createdAt: now(),
    updatedAt: now(),
  };
  return db.put('chats', chat);
}
export async function updateChat(id: ID, patch: Partial<Chat>) {
  const c = await db.get<Chat>('chats', id);
  if (c) return db.put('chats', { ...c, ...patch, updatedAt: now() });
}
export async function deleteChat(id: ID) {
  const msgs = await db.byIndex<Message>('messages', 'chatId', id);
  for (const m of msgs) await db.remove('messages', m.id);
  await db.remove('chats', id);
}

export async function getMessages(chatId: ID): Promise<Message[]> {
  const rows = await db.byIndex<Message>('messages', 'chatId', chatId);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

let lastTs = 0;
/** Horodatage strictement croissant (garantit l'ordre des messages). */
export function tick() {
  const t = Math.max(Date.now(), lastTs + 1);
  lastTs = t;
  return t;
}

export async function addMessage(m: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>): Promise<Message> {
  const t = tick();
  const msg: Message = { ...m, id: uid('msg_'), createdAt: t, updatedAt: t };
  await db.put('messages', msg);
  const chat = await db.get<Chat>('chats', m.chatId);
  if (chat) await db.put('chats', { ...chat, updatedAt: t });
  return msg;
}

// ------------------------------------------------------------- tâches
export async function createTask(t: Partial<Task> & { goal: string }): Promise<Task> {
  const task: Task = {
    id: uid('tsk_'),
    title: t.title || t.goal.slice(0, 80),
    goal: t.goal,
    chatId: t.chatId,
    projectId: t.projectId,
    agentId: t.agentId,
    status: 'queued',
    steps: [],
    logs: [],
    fileIds: [],
    model: t.model,
    iterations: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  return db.put('tasks', task);
}
export const saveTask = (t: Task) => db.put('tasks', { ...t, updatedAt: now() });

// ------------------------------------------------------------- fichiers
export function normalizePath(p: string): string {
  const clean = String(p || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/')
    .replace(/[^\p{L}\p{N}._\-/ ()]/gu, '_')
    .slice(0, 180);
  return clean || 'fichier.txt';
}

const MIME: Record<string, string> = {
  md: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  ts: 'text/plain',
  tsx: 'text/plain',
  json: 'application/json',
  csv: 'text/csv',
  svg: 'image/svg+xml',
  xml: 'application/xml',
  py: 'text/x-python',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
};
export const mimeOf = (path: string) => MIME[path.split('.').pop()?.toLowerCase() || ''] || 'text/plain';

export async function listFiles(projectId?: ID): Promise<WorkspaceFile[]> {
  const all = await db.all<WorkspaceFile>('files');
  return all.filter((f) => (projectId === undefined ? true : (f.projectId || '') === (projectId || ''))).sort((a, b) => a.path.localeCompare(b.path));
}

export async function writeFile(path: string, content: string, opts: { projectId?: ID; taskId?: ID; binary?: boolean } = {}): Promise<WorkspaceFile> {
  const p = normalizePath(path);
  const existing = (await listFiles(opts.projectId || '')).find((f) => f.path === p);
  const file: WorkspaceFile = {
    id: existing?.id || uid('fil_'),
    path: p,
    projectId: opts.projectId,
    taskId: opts.taskId ?? existing?.taskId,
    mime: mimeOf(p),
    content,
    size: new Blob([content]).size,
    binary: opts.binary,
    createdAt: existing?.createdAt || now(),
    updatedAt: now(),
  };
  return db.put('files', file);
}

export async function readFile(path: string, projectId?: ID): Promise<WorkspaceFile | undefined> {
  const p = normalizePath(path);
  return (await listFiles(projectId || '')).find((f) => f.path === p);
}

// ------------------------------------------------------------- mémoire
export async function addMemory(content: string, opts: { tags?: string[]; projectId?: ID; source?: 'user' | 'agent' } = {}): Promise<Memory> {
  const m: Memory = { id: uid('mem_'), content: content.trim().slice(0, 2000), tags: opts.tags || [], projectId: opts.projectId, source: opts.source || 'user', createdAt: now(), updatedAt: now() };
  return db.put('memory', m);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Recherche simple par mots-clés (score = mots trouvés). */
export function scoreText(text: string, query: string): number {
  const t = norm(text);
  const words = norm(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2);
  if (!words.length) return 0;
  return words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0) / words.length;
}

export async function searchMemory(query: string, projectId?: ID, limit = 8): Promise<Memory[]> {
  const all = await db.all<Memory>('memory');
  const scoped = all.filter((m) => !m.projectId || m.projectId === projectId);
  if (!query.trim()) return scoped.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  return scoped
    .map((m) => ({ m, s: scoreText(m.content + ' ' + m.tags.join(' '), query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.m);
}

// ------------------------------------------------------------- journaux
export async function log(level: AppLog['level'], message: string, context?: unknown) {
  try {
    await db.put<AppLog>('logs', { id: uid('log_'), at: now(), level, message, context }, true);
  } catch {
    /* ignore */
  }
}
