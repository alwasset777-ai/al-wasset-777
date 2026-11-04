// Couche multi-fournisseurs : une seule interface pour Gemini, OpenAI, Anthropic,
// Groq, OpenRouter, Mistral, Ollama et tout serveur compatible OpenAI.
// Les appels partent directement de l'appareil vers le fournisseur : la clé
// ne transite jamais par un serveur Wakil.
import { providerInfo } from './defaults';
import { demoComplete } from './demo';
import type { ModelRef, ProviderConfig, ProviderId, ToolCall } from './types';

export interface ToolSchema {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  providerMeta?: unknown;
  images?: { mime: string; data: string }[]; // base64 sans préfixe
}

export interface LLMRequest {
  model: ModelRef;
  system: string;
  messages: LLMMessage[];
  tools?: ToolSchema[];
  json?: boolean;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCall[];
  providerMeta?: unknown;
  usage?: { input: number; output: number };
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
/** Utilisé par les tests pour simuler les fournisseurs. */
export function setFetch(f: Fetch) {
  fetchImpl = f;
}

let configResolver: (p: ProviderId) => ProviderConfig | undefined = () => undefined;
export function setProviderConfigResolver(fn: typeof configResolver) {
  configResolver = fn;
}

function cfg(p: ProviderId) {
  const c = configResolver(p) || { enabled: true };
  return { ...c, baseUrl: (c.baseUrl || providerInfo(p).baseUrl).replace(/\/+$/, '') };
}

const callId = () => 'call_' + Math.random().toString(36).slice(2, 12);

function humanError(provider: ProviderId, status: number, body: string): ProviderError {
  let detail = body;
  try {
    const j = JSON.parse(body);
    detail = j?.error?.message || j?.message || j?.error || body;
  } catch {
    /* texte brut */
  }
  detail = String(detail).slice(0, 400);
  const name = providerInfo(provider).label;
  if (status === 401 || status === 403) return new ProviderError(`${name} : clé API invalide ou non autorisée. (${detail})`, status);
  if (status === 429) return new ProviderError(`${name} : quota gratuit atteint pour le moment. Réessayez dans une minute ou changez de modèle. (${detail})`, status, true);
  if (status === 404) return new ProviderError(`${name} : modèle introuvable. Choisissez un autre modèle. (${detail})`, status);
  if (status >= 500) return new ProviderError(`${name} : service momentanément indisponible. (${detail})`, status, true);
  return new ProviderError(`${name} : erreur ${status}. (${detail})`, status);
}

async function post(provider: ProviderId, url: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal) {
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      const hint = provider === 'ollama' ? ' Vérifiez qu’Ollama est lancé (ollama serve) et autorise cette origine (OLLAMA_ORIGINS).' : '';
      throw new ProviderError(`Impossible de joindre ${providerInfo(provider).label}. Vérifiez la connexion internet.${hint}`);
    }
    if (res.ok) return res.json();
    const err = humanError(provider, res.status, await res.text());
    if (err.retryable && attempt < 2) {
      attempt++;
      await sleep(attempt * 4000, signal);
      continue;
    }
    throw err;
  }
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Arrêté', 'AbortError'));
    });
  });
}

// ---------------------------------------------------------------- Gemini
export function toGemini(req: LLMRequest) {
  const contents: { role: 'user' | 'model'; parts: unknown[] }[] = [];
  const push = (role: 'user' | 'model', parts: unknown[]) => {
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else contents.push({ role, parts: [...parts] });
  };
  for (const m of req.messages) {
    if (m.role === 'user') {
      const parts: unknown[] = [{ text: m.content || ' ' }];
      for (const img of m.images || []) parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
      push('user', parts);
    } else if (m.role === 'assistant') {
      if (Array.isArray(m.providerMeta) && m.providerMeta.length) push('model', m.providerMeta as unknown[]);
      else {
        const parts: unknown[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const c of m.toolCalls || []) parts.push({ functionCall: { name: c.name, args: c.args } });
        push('model', parts.length ? parts : [{ text: ' ' }]);
      }
    } else {
      push('user', [{ functionResponse: { name: m.toolName || 'tool', response: { result: m.content } } }]);
    }
  }
  const body: Record<string, unknown> = { contents, generationConfig: { temperature: req.temperature ?? 0.4 } };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  if (req.tools?.length) body.tools = [{ functionDeclarations: req.tools }];
  if (req.json && !req.tools?.length) (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
  return body;
}

export function fromGemini(data: any): LLMResponse {
  const cand = data?.candidates?.[0];
  if (!cand) {
    const reason = data?.promptFeedback?.blockReason;
    throw new ProviderError(reason ? `Gemini a refusé la demande (${reason}).` : 'Gemini n’a renvoyé aucune réponse.');
  }
  const parts: any[] = cand.content?.parts || [];
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  const toolCalls: ToolCall[] = parts.filter((p) => p.functionCall).map((p) => ({ id: callId(), name: p.functionCall.name, args: p.functionCall.args || {} }));
  if (!text && !toolCalls.length && cand.finishReason && cand.finishReason !== 'STOP') {
    throw new ProviderError(`Gemini a interrompu la réponse (${cand.finishReason}).`);
  }
  return {
    text,
    toolCalls,
    providerMeta: parts.length ? parts : undefined,
    usage: data.usageMetadata ? { input: data.usageMetadata.promptTokenCount || 0, output: data.usageMetadata.candidatesTokenCount || 0 } : undefined,
  };
}

async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  const c = cfg('gemini');
  if (!c.apiKey) throw new ProviderError('Ajoutez votre clé Gemini gratuite dans Réglages → Modèles.');
  const url = `${c.baseUrl}/models/${encodeURIComponent(req.model.model)}:generateContent`;
  const data = await post('gemini', url, toGemini(req), { 'x-goog-api-key': c.apiKey }, req.signal);
  return fromGemini(data);
}

/** Recherche web gratuite via la recherche Google intégrée à Gemini. */
export async function geminiSearch(query: string, signal?: AbortSignal): Promise<{ text: string; sources: { title: string; url: string }[] } | null> {
  const c = cfg('gemini');
  if (!c.apiKey) return null;
  const model = 'gemini-2.5-flash';
  const url = `${c.baseUrl}/models/${model}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: `Recherche sur le web et résume précisément, avec chiffres et dates : ${query}` }] }],
    tools: [{ google_search: {} }],
  };
  const data: any = await post('gemini', url, body, { 'x-goog-api-key': c.apiKey }, signal);
  const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
  const chunks: any[] = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return {
    text: parts.map((p) => p.text || '').join(''),
    sources: chunks.filter((ch) => ch.web).map((ch) => ({ title: ch.web.title || ch.web.uri, url: ch.web.uri })),
  };
}

// ------------------------------------------------------- OpenAI-compatible
export function toOpenAI(req: LLMRequest, provider: ProviderId) {
  const messages: unknown[] = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const m of req.messages) {
    if (m.role === 'user') {
      if (m.images?.length) {
        messages.push({
          role: 'user',
          content: [{ type: 'text', text: m.content }, ...m.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } }))],
        });
      } else messages.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: m.content || '' };
      if (m.toolCalls?.length)
        msg.tool_calls = m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }));
      messages.push(msg);
    } else {
      messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  const body: Record<string, unknown> = { model: req.model.model, messages, temperature: req.temperature ?? 0.4 };
  if (req.tools?.length) body.tools = req.tools.map((t) => ({ type: 'function', function: t }));
  if (req.json && !req.tools?.length && ['openai', 'groq', 'mistral', 'ollama'].includes(provider)) body.response_format = { type: 'json_object' };
  return body;
}

export function fromOpenAI(data: any): LLMResponse {
  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new ProviderError(data?.error?.message || 'Réponse vide du modèle.');
  const toolCalls: ToolCall[] = (msg.tool_calls || []).map((c: any) => {
    let args: Record<string, unknown> = {};
    try {
      args = typeof c.function.arguments === 'string' ? JSON.parse(c.function.arguments || '{}') : c.function.arguments || {};
    } catch {
      args = { _raw: c.function.arguments };
    }
    return { id: c.id || callId(), name: c.function.name, args };
  });
  let text: string = typeof msg.content === 'string' ? msg.content : Array.isArray(msg.content) ? msg.content.map((p: any) => p.text || '').join('') : '';
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return { text, toolCalls, usage: data.usage ? { input: data.usage.prompt_tokens || 0, output: data.usage.completion_tokens || 0 } : undefined };
}

async function callOpenAICompat(req: LLMRequest): Promise<LLMResponse> {
  const p = req.model.provider;
  const c = cfg(p);
  if (providerInfo(p).needsKey && !c.apiKey) throw new ProviderError(`Ajoutez votre clé ${providerInfo(p).label} dans Réglages → Modèles.`);
  const headers: Record<string, string> = {};
  if (c.apiKey) headers.Authorization = `Bearer ${c.apiKey}`;
  if (p === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://wakil-ia.vercel.app';
    headers['X-Title'] = 'Wakil';
  }
  const data = await post(p, `${c.baseUrl}/chat/completions`, toOpenAI(req, p), headers, req.signal);
  return fromOpenAI(data);
}

// --------------------------------------------------------------- Anthropic
export function toAnthropic(req: LLMRequest) {
  const messages: { role: 'user' | 'assistant'; content: unknown[] }[] = [];
  const push = (role: 'user' | 'assistant', blocks: unknown[]) => {
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else messages.push({ role, content: [...blocks] });
  };
  for (const m of req.messages) {
    if (m.role === 'user') {
      const blocks: unknown[] = (m.images || []).map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } }));
      blocks.push({ type: 'text', text: m.content || ' ' });
      push('user', blocks);
    } else if (m.role === 'assistant') {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls || []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args });
      push('assistant', blocks.length ? blocks : [{ type: 'text', text: ' ' }]);
    } else {
      push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]);
    }
  }
  const body: Record<string, unknown> = { model: req.model.model, max_tokens: 8192, messages, temperature: req.temperature ?? 0.4 };
  if (req.system) body.system = req.system;
  if (req.tools?.length) body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  return body;
}

export function fromAnthropic(data: any): LLMResponse {
  const blocks: any[] = data?.content || [];
  return {
    text: blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(''),
    toolCalls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} })),
    usage: data.usage ? { input: data.usage.input_tokens || 0, output: data.usage.output_tokens || 0 } : undefined,
  };
}

async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const c = cfg('anthropic');
  if (!c.apiKey) throw new ProviderError('Ajoutez votre clé Anthropic dans Réglages → Modèles.');
  const data = await post(
    'anthropic',
    `${c.baseUrl}/messages`,
    toAnthropic(req),
    { 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    req.signal,
  );
  return fromAnthropic(data);
}

// ------------------------------------------------------------------ public
export async function complete(req: LLMRequest): Promise<LLMResponse> {
  switch (req.model.provider) {
    case 'demo':
      return demoComplete(req);
    case 'gemini':
      return callGemini(req);
    case 'anthropic':
      return callAnthropic(req);
    default:
      return callOpenAICompat(req);
  }
}

/** Récupère la liste réelle des modèles disponibles pour une clé. */
export async function listModels(provider: ProviderId): Promise<string[]> {
  if (provider === 'demo') return ['wakil-demo'];
  const c = cfg(provider);
  const get = async (url: string, headers: Record<string, string>) => {
    const res = await fetchImpl(url, { headers });
    if (!res.ok) throw humanError(provider, res.status, await res.text());
    return res.json();
  };
  if (provider === 'gemini') {
    if (!c.apiKey) throw new ProviderError('Clé Gemini manquante.');
    const data = await get(`${c.baseUrl}/models?pageSize=200`, { 'x-goog-api-key': c.apiKey });
    return (data.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      .filter((n: string) => n.startsWith('gemini') && !/tts|image|embedding|live|audio/.test(n));
  }
  if (provider === 'anthropic') {
    const data = await get(`${c.baseUrl}/models`, {
      'x-api-key': c.apiKey || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    return (data.data || []).map((m: any) => m.id);
  }
  const headers: Record<string, string> = c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {};
  const data = await get(`${c.baseUrl}/models`, headers);
  return (data.data || data.models || []).map((m: any) => m.id || m.name).filter(Boolean);
}

/** Teste rapidement un modèle (renvoie le temps de réponse). */
export async function testModel(model: ModelRef): Promise<number> {
  const t0 = Date.now();
  await complete({ model, system: 'Réponds uniquement « OK ».', messages: [{ role: 'user', content: 'Test' }] });
  return Date.now() - t0;
}
