import type { AgentProfile, ProviderId, Settings } from './types';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  free: boolean;
  needsKey: boolean;
  keyUrl?: string;
  baseUrl: string;
  defaultModels: string[];
  note: string;
}

// Liste des fournisseurs. Les gratuits sont proposés en premier.
export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    free: true,
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    note: 'Gratuit avec une clé Google AI Studio (quota quotidien). Recommandé : outils + recherche Google intégrée.',
  },
  {
    id: 'groq',
    label: 'Groq',
    free: true,
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'],
    note: 'Offre gratuite très rapide (modèles ouverts).',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    free: true,
    needsKey: true,
    keyUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3.1:free'],
    note: 'Modèles se terminant par « :free » gratuits (limites journalières).',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    free: true,
    needsKey: true,
    keyUrl: 'https://console.mistral.ai/api-keys',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModels: ['mistral-small-latest', 'mistral-medium-latest'],
    note: 'Offre « Experiment » gratuite.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local, sur votre Mac)',
    free: true,
    needsKey: false,
    keyUrl: 'https://ollama.com/download',
    baseUrl: 'http://localhost:11434/v1',
    defaultModels: ['llama3.2', 'qwen2.5', 'mistral'],
    note: '100 % gratuit et privé, tourne sur votre ordinateur. Idéal avec l’app Mac.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    free: false,
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
    note: 'Payant à l’usage. Utilisez-le seulement si vous avez déjà une clé.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    free: false,
    needsKey: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    note: 'Payant à l’usage. Utilisez-le seulement si vous avez déjà une clé.',
  },
  {
    id: 'demo',
    label: 'Mode démonstration (sans clé)',
    free: true,
    needsKey: false,
    baseUrl: '',
    defaultModels: ['wakil-demo'],
    note: 'Pour découvrir Wakil sans clé : recherche et fichiers réels, mais pas d’intelligence artificielle. Ajoutez ensuite une clé gratuite.',
  },
  {
    id: 'custom',
    label: 'Compatible OpenAI (personnalisé)',
    free: true,
    needsKey: false,
    baseUrl: 'http://localhost:1234/v1',
    defaultModels: [],
    note: 'LM Studio, vLLM, ou tout serveur compatible OpenAI.',
  },
];

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!;

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  language: 'fr',
  defaultModel: { provider: 'gemini', model: 'gemini-2.5-flash' },
  providers: { gemini: { enabled: true } },
  disabledTools: [],
  onboarded: false,
  maxToolCallsPerStep: 8,
  maxFixRounds: 1,
  requireApprovalFor: ['shell_exec', 'delete_file'],
};

const t = 0;
export const BUILTIN_AGENTS: AgentProfile[] = [
  {
    id: 'agent_general',
    name: 'Wakil',
    emoji: '✦',
    description: 'Agent polyvalent : recherche, rédaction, code, fichiers.',
    systemPrompt: '',
    tools: [],
    builtin: true,
    createdAt: t,
    updatedAt: t,
  },
  {
    id: 'agent_dev',
    name: 'Développeur',
    emoji: '⌘',
    description: 'Écrit, teste et documente du code ; crée des sites et mini-apps.',
    systemPrompt:
      'Tu es un ingénieur logiciel senior. Écris du code complet, propre et testé. Pour un site web, crée un fichier index.html autonome (CSS/JS inclus). Teste la logique avec run_javascript quand c’est possible.',
    tools: [],
    builtin: true,
    createdAt: t,
    updatedAt: t,
  },
  {
    id: 'agent_research',
    name: 'Chercheur',
    emoji: '◎',
    description: 'Recherche web multi-sources, synthèse sourcée, rapports.',
    systemPrompt:
      'Tu es un analyste de recherche rigoureux. Croise plusieurs sources, cite chaque source avec son lien, distingue faits et hypothèses, et livre un rapport structuré en Markdown.',
    tools: [],
    builtin: true,
    createdAt: t,
    updatedAt: t,
  },
  {
    id: 'agent_immo',
    name: 'Agent immobilier Al Wasset 777',
    emoji: '⌂',
    description: 'Annonces, estimations, courriers et suivi clients pour l’agence de Meknès.',
    systemPrompt:
      'Tu assistes l’agence immobilière « Al Wasset 777 » (Meknès, Maroc). Tu rédiges des annonces attractives (FR/AR/darija), des estimations argumentées (prix au m² du quartier, état, étage), des courriers et des fiches clients. Prix en dirhams (DH). Reste prudent : une estimation reste indicative.',
    tools: [],
    builtin: true,
    createdAt: t,
    updatedAt: t,
  },
  {
    id: 'agent_writer',
    name: 'Rédacteur',
    emoji: '✎',
    description: 'Articles, présentations, e-mails, traductions, posts réseaux sociaux.',
    systemPrompt:
      'Tu es un rédacteur professionnel. Adapte le ton au public, structure clairement, et livre des textes prêts à l’emploi. Pour une présentation, crée un fichier HTML de diapositives autonome.',
    tools: [],
    builtin: true,
    createdAt: t,
    updatedAt: t,
  },
];

export const PROJECT_COLORS = ['#E0A43B', '#3BA99C', '#6C7BEA', '#E06C75', '#9B6CE0', '#4FA3E0', '#8FB34A'];

export const EXAMPLE_GOALS = [
  'Rédige un rapport sur le marché immobilier à Meknès en 2026 avec sources, et exporte-le en Markdown.',
  'Crée un site web vitrine d’une page pour une agence immobilière, prêt à publier (index.html).',
  'Analyse ce tableau CSV de ventes et donne-moi les 5 tendances clés avec un graphique HTML.',
  'Prépare une présentation de 8 diapositives sur l’intelligence artificielle pour les PME.',
];
