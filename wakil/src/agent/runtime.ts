// Orchestration : relie conversations, messages, tâches et moteur d'agent.
import { db } from '../core/db';
import type { LLMMessage } from '../core/providers';
import { addMessage, createChat, createTask, currentModel, getMessages, getSettings, log, tick, updateChat, writeFile } from '../core/store';
import type { AgentProfile, Chat, ChatMode, Message, Project, Task } from '../core/types';
import { activeTools } from '../tools/registry';
import { AgentRunner, buildSystemPrompt, toolLoop } from './engine';

// ----------------------------------------------------------- exécutions actives
const running = new Map<string, AbortController>();
const runListeners = new Set<() => void>();
const notifyRuns = () => runListeners.forEach((l) => l());
export const isRunning = (chatId: string) => running.has(chatId);
export function onRunsChange(fn: () => void) {
  runListeners.add(fn);
  return () => runListeners.delete(fn);
}
export function stop(chatId: string) {
  running.get(chatId)?.abort();
}

// ----------------------------------------------------------- approbations
export interface ApprovalRequest {
  id: number;
  title: string;
  detail: string;
  resolve: (ok: boolean) => void;
}
let approvalSeq = 0;
const approvalListeners = new Set<(r: ApprovalRequest) => void>();
export function onApproval(fn: (r: ApprovalRequest) => void) {
  approvalListeners.add(fn);
  return () => {
    approvalListeners.delete(fn);
  };
}
export function requestApproval(title: string, detail: string): Promise<boolean> {
  if (!approvalListeners.size) return Promise.resolve(false);
  return new Promise((resolve) => {
    const req = { id: ++approvalSeq, title, detail, resolve };
    approvalListeners.forEach((l) => l(req));
  });
}

// ----------------------------------------------------------- pièces jointes
export interface Attachment {
  name: string;
  mime: string;
  size: number;
  text?: string;
  base64?: string;
}

export async function readAttachment(file: File): Promise<Attachment> {
  const isText = /^text\/|json|csv|xml|javascript|markdown/.test(file.type) || /\.(md|txt|csv|json|js|ts|py|html|css|xml|yml|yaml)$/i.test(file.name);
  if (isText) return { name: file.name, mime: file.type || 'text/plain', size: file.size, text: await file.text() };
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { name: file.name, mime: file.type || 'application/octet-stream', size: file.size, base64: btoa(bin) };
}

// ----------------------------------------------------------- historique → modèle
async function historyFor(chatId: string, excludeId?: string): Promise<LLMMessage[]> {
  const msgs = (await getMessages(chatId)).filter((m) => m.id !== excludeId && !m.error && (m.role === 'user' || (m.role === 'assistant' && !m.toolCalls?.length && m.content)));
  return msgs.slice(-20).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

async function context(chat: Chat) {
  const agent = chat.agentId ? await db.get<AgentProfile>('agents', chat.agentId) : undefined;
  const project = chat.projectId ? await db.get<Project>('projects', chat.projectId) : undefined;
  return { agent, project, model: currentModel(chat, agent) };
}

function autoTitle(text: string) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 46) + '…' : t || 'Conversation';
}

// ----------------------------------------------------------- envoi d'un message
export async function send(chatId: string, text: string, mode: ChatMode, attachments: Attachment[] = []): Promise<void> {
  const chat = await db.get<Chat>('chats', chatId);
  if (!chat) throw new Error('Conversation introuvable');
  if (running.has(chatId)) return;
  const ctrl = new AbortController();
  running.set(chatId, ctrl);
  notifyRuns();
  try {
    // Pièces jointes : enregistrées dans l'espace de travail du projet.
    let content = text;
    const images: { mime: string; data: string }[] = [];
    for (const a of attachments) {
      if (a.text !== undefined) {
        await writeFile(`pieces-jointes/${a.name}`, a.text, { projectId: chat.projectId });
        content += `\n\n[Fichier joint : pieces-jointes/${a.name}]\n\`\`\`\n${a.text.slice(0, 20000)}\n\`\`\``;
      } else if (a.base64) {
        await writeFile(`pieces-jointes/${a.name}`, `data:${a.mime};base64,${a.base64}`, { projectId: chat.projectId, binary: true });
        if (a.mime.startsWith('image/')) images.push({ mime: a.mime, data: a.base64 });
        content += `\n\n[Fichier joint : pieces-jointes/${a.name} (${a.mime})]`;
      }
    }
    const userMsg = await addMessage({ chatId, role: 'user', content: text, attachments: attachments.map(({ name, mime, size }) => ({ name, mime, size })) });
    if (chat.title === 'Nouvelle conversation') await updateChat(chatId, { title: autoTitle(text), mode });
    else if (chat.mode !== mode) await updateChat(chatId, { mode });

    const ctx = await context(chat);
    const history = await historyFor(chatId, userMsg.id);

    if (mode === 'agent') await runAgent(chat, content, history, ctx, ctrl);
    else await runChat(chat, content, images, history, ctx, ctrl);
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError';
    await addMessage({ chatId, role: 'assistant', content: aborted ? '⏹ Arrêté.' : `⚠️ ${(e as Error).message}`, error: !aborted });
    if (!aborted) await log('error', (e as Error).message, { chatId });
  } finally {
    running.delete(chatId);
    notifyRuns();
  }
}

async function runChat(chat: Chat, content: string, images: LLMMessage['images'], history: LLMMessage[], ctx: Awaited<ReturnType<typeof context>>, ctrl: AbortController) {
  const tools = await activeTools(ctx.agent?.tools);
  const system = await buildSystemPrompt(ctx, 'Mode conversation : réponds directement et utilement. Utilise les outils quand ils améliorent vraiment la réponse (recherche, calcul, fichier).');
  const r = await toolLoop({
    model: ctx.model,
    system,
    messages: [...history, { role: 'user', content, images }],
    tools,
    maxCalls: getSettings().maxToolCallsPerStep,
    projectId: chat.projectId,
    signal: ctrl.signal,
    approve: requestApproval,
    onEvent: async (e) => {
      if (e.type === 'assistant' && e.res.toolCalls.length)
        await addMessage({ chatId: chat.id, role: 'assistant', content: e.res.text, toolCalls: e.res.toolCalls });
      else if (e.type === 'tool_result') await addMessage({ chatId: chat.id, role: 'tool', content: e.result.slice(0, 6000), toolName: e.name, error: !e.ok });
    },
  });
  await addMessage({ chatId: chat.id, role: 'assistant', content: r.text || '(réponse vide)' });
}

async function runAgent(chat: Chat, goal: string, history: LLMMessage[], ctx: Awaited<ReturnType<typeof context>>, ctrl: AbortController) {
  const task = await createTask({ goal, chatId: chat.id, projectId: chat.projectId, agentId: chat.agentId, model: ctx.model });
  const card = await addMessage({ chatId: chat.id, role: 'assistant', content: '', taskId: task.id });
  const runner = new AgentRunner(task, { ...ctx, history }, { signal: ctrl.signal, approve: requestApproval });
  const done = await runner.run();
  const updated = await db.get<Message>('messages', card.id);
  if (updated) await db.put('messages', { ...updated, content: done.result || '', error: done.status === 'failed', updatedAt: tick() });
}

/** Lance une tâche autonome hors conversation (depuis le planificateur). */
export async function launchTask(goal: string, opts: { projectId?: string; agentId?: string } = {}): Promise<{ chatId: string; task?: Task }> {
  const chat = await createChat({ title: autoTitle(goal), projectId: opts.projectId, agentId: opts.agentId, mode: 'agent' });
  void send(chat.id, goal, 'agent');
  return { chatId: chat.id };
}
