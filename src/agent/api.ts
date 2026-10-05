// Appels au serveur (server.ts → Gemini, WhatsApp). Le jeton du gérant accompagne chaque appel.
import { getIdToken } from '../services/firebase';
import type { AgentAction, AgentChatResponse, AgentContext, AgentPersona, AgentTask, WaThread } from './types';

async function headers(): Promise<Record<string, string>> {
  const token = await getIdToken().catch(() => null);
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`/api${path}`, { method, headers: await headers(), body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Erreur ${res.status}`, res.status);
  return data as T;
}

export interface InlineFile {
  name?: string;
  mimeType: string;
  data: string;
}

export function chatWithAgent(input: {
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  context: AgentContext;
  persona: AgentPersona;
  files?: InlineFile[];
  audio?: InlineFile;
}): Promise<AgentChatResponse> {
  return call<AgentChatResponse>('/agent/chat', input).then((r) => ({
    reply: String(r.reply || ''),
    transcript: r.transcript,
    actions: Array.isArray(r.actions) ? (r.actions as AgentAction[]) : [],
  }));
}

export const searchWeb = (query: string, urls: string[] = [], language = 'darija') =>
  call<{ text: string; sources: { title: string; url: string }[] }>('/agent/search', { query, urls, language });

export const draftDocument = (kind: string, details: string, language: 'ar' | 'fr' = 'ar') =>
  call<{ title: string; text: string }>('/agent/document', { kind, details, language });

export const syncToServer = (payload: Record<string, unknown>) => call<{ ok: boolean; store: string }>('/agent/sync', payload);

export const fetchTasks = () => call<{ tasks: AgentTask[] }>('/agent/tasks').then((r) => r.tasks);
export const resolveTask = (id: string, status: 'done' | 'rejected') => call<{ task: AgentTask }>(`/agent/tasks/${encodeURIComponent(id)}`, { status });

export interface WaStatus {
  configured: boolean;
  webhook: boolean;
  owners: number;
}

export const fetchThreads = () => call<{ threads: WaThread[]; status: WaStatus; store: string }>('/whatsapp/threads');
export const sendWhatsApp = (to: string, text: string) => call<{ id: string; thread: WaThread }>('/whatsapp/send', { to, text });
export const updateThread = (id: string, changes: Partial<Pick<WaThread, 'status' | 'unread' | 'name' | 'suggestion'>>) =>
  call<{ thread: WaThread }>(`/whatsapp/threads/${encodeURIComponent(id)}`, changes);
export const refreshSuggestion = (id: string) => call<{ thread: WaThread }>(`/whatsapp/threads/${encodeURIComponent(id)}/suggest`, {});

export interface HealthStatus {
  ai: boolean;
  auth: boolean;
  whatsapp?: WaStatus;
  store?: 'firestore' | 'memory';
  cron?: boolean;
}

export async function fetchHealth(): Promise<HealthStatus | null> {
  try {
    return await call<HealthStatus>('/health');
  } catch {
    return null;
  }
}
