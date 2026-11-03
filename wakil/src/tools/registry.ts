// Registre des outils de l'agent (extensible : outils intégrés + plugins HTTP
// déclarés par l'utilisateur + outils du Mac via l'app de bureau).
import { db } from '../core/db';
import { geminiSearch, type ToolSchema } from '../core/providers';
import { addMemory, getSettings, listFiles, normalizePath, readFile, searchMemory, writeFile } from '../core/store';
import type { CustomTool, ID } from '../core/types';
import { apiUrl, desktop } from '../core/platform';
import { runInSandbox } from './sandbox';

export interface ToolContext {
  projectId?: ID;
  taskId?: ID;
  signal?: AbortSignal;
  /** Demande l'accord de l'utilisateur pour une action sensible. */
  approve: (title: string, detail: string) => Promise<boolean>;
  /** Fichiers créés/modifiés pendant l'exécution. */
  onFile?: (fileId: ID) => void;
}

export interface ToolDef {
  name: string;
  label: string;
  description: string;
  parameters: ToolSchema['parameters'];
  category: 'web' | 'fichiers' | 'code' | 'mémoire' | 'système' | 'plugin';
  needsApproval?: boolean;
  desktopOnly?: boolean;
  run: (args: Record<string, any>, ctx: ToolContext) => Promise<string>;
}

const MAX_OUT = 14000;
export const clip = (s: string, n = MAX_OUT) => (s.length > n ? s.slice(0, n) + `\n…[tronqué, ${s.length - n} caractères en plus]` : s);

async function getJSON(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Réponse invalide (${res.status}).`);
  }
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

async function wikipediaSearch(query: string, signal?: AbortSignal) {
  const url = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`;
  const data = await getJSON(url, signal);
  return (data?.query?.search || []).map((r: any) => ({
    title: r.title,
    url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    snippet: String(r.snippet || '').replace(/<[^>]+>/g, ''),
  }));
}

export const BUILTIN_TOOLS: ToolDef[] = [
  {
    name: 'web_search',
    label: 'Recherche web',
    category: 'web',
    description: 'Recherche des informations récentes sur internet. Renvoie un résumé et des sources (titres + liens). Utilise-le pour toute information factuelle, récente ou chiffrée.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'La requête de recherche, précise.' } }, required: ['query'] },
    async run({ query }, ctx) {
      const q = String(query || '').trim();
      if (!q) return 'Erreur : requête vide.';
      const parts: string[] = [];
      try {
        const g = await geminiSearch(q, ctx.signal);
        if (g && (g.text || g.sources.length)) {
          parts.push(`Synthèse (recherche Google via Gemini) :\n${g.text}`);
          if (g.sources.length) parts.push('Sources :\n' + g.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n'));
          return clip(parts.join('\n\n'));
        }
      } catch (e) {
        parts.push(`(Recherche Gemini indisponible : ${(e as Error).message})`);
      }
      try {
        const data = await getJSON(apiUrl(`/api/search?q=${encodeURIComponent(q)}`), ctx.signal);
        if (data.results?.length) {
          parts.push('Résultats :\n' + data.results.map((r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n'));
          return clip(parts.join('\n\n'));
        }
      } catch (e) {
        parts.push(`(Moteur de recherche indisponible : ${(e as Error).message})`);
      }
      try {
        const wiki = await wikipediaSearch(q, ctx.signal);
        if (wiki.length) parts.push('Wikipédia :\n' + wiki.map((r: any, i: number) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet}`).join('\n'));
      } catch {
        /* ignore */
      }
      return clip(parts.join('\n\n') || 'Aucun résultat trouvé.');
    },
  },
  {
    name: 'read_webpage',
    label: 'Lire une page web',
    category: 'web',
    description: 'Télécharge une page web (URL http/https) et renvoie son texte principal (titre, contenu, liens). Utilise-le pour lire une source trouvée par web_search.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'Adresse complète de la page.' } }, required: ['url'] },
    async run({ url }, ctx) {
      if (!/^https?:\/\//i.test(String(url))) return 'Erreur : adresse invalide (doit commencer par http:// ou https://).';
      const data = await getJSON(apiUrl(`/api/fetch?url=${encodeURIComponent(String(url))}`), ctx.signal);
      return clip(`# ${data.title || url}\nURL : ${data.url}\n\n${data.text}`);
    },
  },
  {
    name: 'run_javascript',
    label: 'Exécuter du code',
    category: 'code',
    description:
      'Exécute du JavaScript dans un bac à sable isolé (sans réseau, 15 s max). Utilise console.log pour afficher, `return` pour renvoyer une valeur. API disponible : wakil.listFiles(), wakil.readFile(path) (fichiers texte du projet), wakil.writeFile(path, contenu) pour créer un fichier, wakil.parseCSV(texte). Idéal pour calculs, analyse de données, génération de contenus.',
    parameters: { type: 'object', properties: { code: { type: 'string', description: 'Le code JavaScript (corps d’une fonction async).' } }, required: ['code'] },
    async run({ code }, ctx) {
      const files: Record<string, string> = {};
      for (const f of await listFiles(ctx.projectId || '')) if (!f.binary && f.size < 2_000_000) files[f.path] = f.content;
      const r = await runInSandbox(String(code || ''), files);
      const created: string[] = [];
      for (const f of r.files) {
        const saved = await writeFile(f.path, f.content, { projectId: ctx.projectId, taskId: ctx.taskId });
        ctx.onFile?.(saved.id);
        created.push(saved.path);
      }
      return clip(
        [
          r.ok ? `✓ Exécuté en ${r.ms} ms` : `✗ Erreur : ${r.error}`,
          r.logs.length ? `Sortie :\n${r.logs.join('\n')}` : '',
          r.result !== undefined ? `Valeur renvoyée :\n${r.result}` : '',
          created.length ? `Fichiers créés : ${created.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      );
    },
  },
  {
    name: 'write_file',
    label: 'Créer / modifier un fichier',
    category: 'fichiers',
    description:
      'Crée ou remplace un fichier dans l’espace de travail (le livrable). Extensions utiles : .md (rapport), .html (site, présentation, graphique autonome), .csv, .json, .js, .py, .svg, .txt. Donne un chemin clair, ex. "rapport/marche-meknes.md".',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin du fichier.' }, content: { type: 'string', description: 'Contenu complet du fichier.' } },
      required: ['path', 'content'],
    },
    async run({ path, content }, ctx) {
      const f = await writeFile(String(path), String(content ?? ''), { projectId: ctx.projectId, taskId: ctx.taskId });
      ctx.onFile?.(f.id);
      return `Fichier enregistré : ${f.path} (${f.size} octets).`;
    },
  },
  {
    name: 'read_file',
    label: 'Lire un fichier',
    category: 'fichiers',
    description: 'Lit le contenu d’un fichier de l’espace de travail.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async run({ path }, ctx) {
      const f = await readFile(String(path), ctx.projectId);
      if (!f) return `Fichier introuvable : ${normalizePath(String(path))}. Utilise list_files.`;
      return f.binary ? `(fichier binaire ${f.mime}, ${f.size} octets)` : clip(f.content);
    },
  },
  {
    name: 'list_files',
    label: 'Lister les fichiers',
    category: 'fichiers',
    description: 'Liste les fichiers de l’espace de travail du projet courant.',
    parameters: { type: 'object', properties: {} },
    async run(_a, ctx) {
      const files = await listFiles(ctx.projectId || '');
      return files.length ? files.map((f) => `- ${f.path} (${f.size} o)`).join('\n') : 'Aucun fichier pour le moment.';
    },
  },
  {
    name: 'delete_file',
    label: 'Supprimer un fichier',
    category: 'fichiers',
    needsApproval: true,
    description: 'Supprime un fichier de l’espace de travail (demande l’accord de l’utilisateur).',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async run({ path }, ctx) {
      const f = await readFile(String(path), ctx.projectId);
      if (!f) return 'Fichier introuvable.';
      await db.remove('files', f.id);
      return `Fichier supprimé : ${f.path}`;
    },
  },
  {
    name: 'save_memory',
    label: 'Mémoriser',
    category: 'mémoire',
    description: 'Enregistre un fait durable et utile sur l’utilisateur ou ses préférences (ex. « préfère les rapports courts »). Ne mémorise jamais de mots de passe ni de clés.',
    parameters: {
      type: 'object',
      properties: { content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
      required: ['content'],
    },
    async run({ content, tags }, ctx) {
      const text = String(content || '');
      if (/(api[_-]?key|password|mot de passe|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{10,})/i.test(text)) return 'Refusé : je ne mémorise pas de secrets.';
      await addMemory(text, { tags: Array.isArray(tags) ? tags.map(String) : [], projectId: ctx.projectId, source: 'agent' });
      return 'Mémorisé.';
    },
  },
  {
    name: 'search_memory',
    label: 'Chercher en mémoire',
    category: 'mémoire',
    description: 'Cherche dans la mémoire persistante (préférences, faits enregistrés).',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    async run({ query }, ctx) {
      const r = await searchMemory(String(query || ''), ctx.projectId);
      return r.length ? r.map((m) => `- ${m.content}`).join('\n') : 'Rien de pertinent en mémoire.';
    },
  },
  {
    name: 'get_datetime',
    label: 'Date et heure',
    category: 'système',
    description: 'Donne la date et l’heure actuelles (fuseau de l’appareil).',
    parameters: { type: 'object', properties: {} },
    async run() {
      const d = new Date();
      return `${d.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })} (${Intl.DateTimeFormat().resolvedOptions().timeZone}) — ISO ${d.toISOString()}`;
    },
  },
  // --------- Outils réservés à l'application Mac (moteur d'exécution local)
  {
    name: 'shell_exec',
    label: 'Terminal du Mac',
    category: 'système',
    needsApproval: true,
    desktopOnly: true,
    description:
      'Exécute une commande dans le terminal du Mac (dossier ~/Wakil par défaut). Chaque commande doit être approuvée par l’utilisateur. Utile pour installer des paquets, lancer des scripts Python/Node, convertir des fichiers.',
    parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string', description: 'Sous-dossier de ~/Wakil (optionnel).' } }, required: ['command'] },
    async run({ command, cwd }) {
      const d = desktop();
      if (!d) return 'Disponible uniquement dans l’application Mac.';
      const r = await d.runCommand(String(command), cwd ? String(cwd) : undefined);
      return clip(`Code de sortie : ${r.code}\n${r.stdout ? `Sortie :\n${r.stdout}` : ''}${r.stderr ? `\nErreurs :\n${r.stderr}` : ''}`);
    },
  },
  {
    name: 'export_to_mac',
    label: 'Exporter vers le Mac',
    category: 'fichiers',
    desktopOnly: true,
    description: 'Copie un fichier de l’espace de travail vers le dossier ~/Wakil du Mac (pour l’ouvrir avec d’autres logiciels).',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async run({ path }, ctx) {
      const d = desktop();
      if (!d) return 'Disponible uniquement dans l’application Mac.';
      const f = await readFile(String(path), ctx.projectId);
      if (!f) return 'Fichier introuvable.';
      const full = await d.writeFile(f.path, f.content, !!f.binary);
      return `Exporté : ${full}`;
    },
  },
];

function customToolDef(t: CustomTool): ToolDef {
  const props: Record<string, unknown> = {};
  for (const p of t.params) props[p.name] = { type: 'string', description: p.description };
  return {
    name: t.name,
    label: t.name,
    category: 'plugin',
    description: `${t.description} (plugin HTTP)`,
    parameters: { type: 'object', properties: props, required: t.params.filter((p) => p.required).map((p) => p.name) },
    async run(args, ctx) {
      const url = t.urlTemplate.replace(/\{(\w+)\}/g, (_m, k) => encodeURIComponent(String(args[k] ?? '')));
      const data = await getJSON(apiUrl(`/api/fetch?raw=1&url=${encodeURIComponent(url)}`), ctx.signal);
      return clip(data.text);
    },
  };
}

/** Outils actifs pour une exécution (filtrés par réglages, agent et plateforme). */
export async function activeTools(allowed: string[] = []): Promise<ToolDef[]> {
  const s = getSettings();
  const custom = (await db.all<CustomTool>('tools')).filter((t) => t.enabled).map(customToolDef);
  const isDesktop = !!desktop();
  return [...BUILTIN_TOOLS, ...custom].filter(
    (t) => !s.disabledTools.includes(t.name) && (!t.desktopOnly || isDesktop) && (!allowed.length || allowed.includes(t.name)),
  );
}

export const toolSchemas = (tools: ToolDef[]): ToolSchema[] => tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
