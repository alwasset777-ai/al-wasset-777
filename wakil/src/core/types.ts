// Modèles de données de Wakil (stockés localement dans IndexedDB,
// synchronisables vers Supabase — voir supabase/schema.sql).

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean; // suppression « douce » (utile pour la synchro)
}

/** Profil local (users). En mode cloud, `cloudUserId` relie au compte Supabase. */
export interface UserProfile extends BaseRecord {
  name: string;
  email?: string;
  cloudUserId?: string;
}

export interface Project extends BaseRecord {
  name: string;
  description: string;
  /** Consignes permanentes injectées dans chaque conversation du projet. */
  instructions: string;
  color: string;
  icon: string;
  archived?: boolean;
}

export type ChatMode = 'chat' | 'agent';

export interface Chat extends BaseRecord {
  title: string;
  projectId?: ID;
  agentId?: ID;
  mode: ChatMode;
  pinned?: boolean;
  /** Modèle choisi pour cette conversation (sinon modèle par défaut). */
  model?: ModelRef;
}

export type Role = 'user' | 'assistant' | 'tool' | 'system';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface Message extends BaseRecord {
  chatId: ID;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  /** Tâche agent liée à ce message (mode agent). */
  taskId?: ID;
  /** Données brutes propres au fournisseur (ex. signatures Gemini) à renvoyer telles quelles. */
  providerMeta?: unknown;
  error?: boolean;
  attachments?: { name: string; mime: string; size: number }[];
}

export type TaskStatus = 'queued' | 'planning' | 'running' | 'verifying' | 'done' | 'failed' | 'cancelled' | 'waiting';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface TaskStep {
  id: string;
  title: string;
  detail: string;
  status: StepStatus;
  result?: string;
  startedAt?: number;
  endedAt?: number;
}

export type LogKind = 'info' | 'plan' | 'step' | 'tool' | 'tool_result' | 'verify' | 'error' | 'final' | 'approval';

export interface LogEntry {
  id: string;
  at: number;
  kind: LogKind;
  text: string;
  data?: unknown;
  stepId?: string;
}

export interface Task extends BaseRecord {
  goal: string;
  title: string;
  chatId?: ID;
  projectId?: ID;
  agentId?: ID;
  status: TaskStatus;
  steps: TaskStep[];
  logs: LogEntry[];
  result?: string;
  fileIds: ID[];
  model?: ModelRef;
  iterations: number;
  verification?: { ok: boolean; notes: string };
}

/** Agents = personnalités/configurations réutilisables. */
export interface AgentProfile extends BaseRecord {
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  /** Noms d'outils autorisés ; vide = tous les outils actifs. */
  tools: string[];
  model?: ModelRef;
  builtin?: boolean;
}

/** Outils personnalisés (plugins HTTP déclaratifs). */
export interface CustomTool extends BaseRecord {
  name: string; // snake_case
  description: string;
  /** URL avec variables {param}. GET uniquement, via le proxy sécurisé. */
  urlTemplate: string;
  params: { name: string; description: string; required: boolean }[];
  enabled: boolean;
}

export interface WorkspaceFile extends BaseRecord {
  path: string; // ex. "rapport/analyse.md"
  projectId?: ID;
  taskId?: ID;
  mime: string;
  content: string; // texte, ou data-URL base64 pour les binaires
  size: number;
  binary?: boolean;
}

export interface Memory extends BaseRecord {
  content: string;
  tags: string[];
  projectId?: ID;
  source: 'user' | 'agent';
}

export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'mistral' | 'ollama' | 'custom' | 'demo';

export interface ModelRef {
  provider: ProviderId;
  model: string;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  models?: string[]; // liste récupérée depuis l'API
}

export interface Settings {
  id: 'settings';
  theme: 'system' | 'light' | 'dark';
  language: 'fr';
  defaultModel: ModelRef;
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  disabledTools: string[];
  onboarded: boolean;
  pinHash?: string;
  /** Autonomie : nombre max d'actions par étape et nombre de corrections. */
  maxToolCallsPerStep: number;
  maxFixRounds: number;
  requireApprovalFor: string[];
  cloud?: { url: string; anonKey: string; email?: string; session?: { access_token: string; refresh_token: string; expires_at: number; user_id: string }; lastSync?: number };
  apiBase?: string;
}

export interface AppLog {
  id: ID;
  at: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: unknown;
}

export type CollectionName =
  | 'profile'
  | 'projects'
  | 'chats'
  | 'messages'
  | 'tasks'
  | 'agents'
  | 'tools'
  | 'files'
  | 'memory'
  | 'settings'
  | 'logs';
