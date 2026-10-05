// Types partagés du « وكيل الوسيط 777 » (application + serveur).
// Uniquement des types : le serveur les importe avec `import type`, sans code exécuté.
import type { AdLanguage, AdPlatform, Appointment, StoredFileRef } from '../types';

export type { Appointment };

export type AgentTab = 'ads' | 'crm' | 'home' | 'agent' | 'legal';
export type LeadScore = 'جاد' | 'متوسط' | 'ضعيف';
export type DocumentKind = 'كراء' | 'وعد_بالبيع' | 'تفويض_بالبيع' | 'تفويض_بالكراء' | 'محضر_زيارة' | 'رسالة' | 'أخرى';
export type AppointmentKind = NonNullable<Appointment['kind']>;
export type AppointmentStatus = Appointment['status'];

// Fiche client (prospect) enregistrée par l'agent ou depuis le CRM.
export interface ClientFields {
  name: string;
  phone: string;
  category?: 'فرد' | 'شركة';
  requestType?: string; // شراء، كراء، بيع، استثمار...
  propType?: string; // شقة، فيلا، أرض...
  budget?: number;
  area?: string;
  status?: 'نشط' | 'في المتابعة' | 'منجز' | 'ملغى';
  score?: LeadScore;
  notes?: string;
}

// Fiche du registre (bien + propriétaire), mêmes champs que le formulaire « سجل العقارات ».
export interface RegistryFieldsDraft {
  propertyType: string;
  owner: string;
  ownerPhone: string;
  surface: string;
  location: string;
  price: string;
  notes: string;
}

export interface AppointmentFields {
  title: string;
  at: string; // ISO
  kind?: AppointmentKind;
  durationMin?: number;
  clientName?: string;
  clientPhone?: string;
  place?: string;
  notes?: string;
  status?: AppointmentStatus;
}

export interface MemoryItem {
  id: string;
  text: string;
  at: string;
}

// Actions que l'agent peut proposer. L'application décide si elles s'exécutent
// directement ou après l'accord du gérant (publication, message client, suppression, prix).
export type AgentAction =
  | { type: 'open'; tab: AgentTab }
  | { type: 'generate_ads'; propertyId: number; platforms?: AdPlatform[]; languages?: AdLanguage[] }
  | { type: 'remember'; text: string }
  | { type: 'forget'; id: string }
  | { type: 'add_client'; client: ClientFields }
  | { type: 'update_client'; id: string; changes: Partial<ClientFields> }
  | { type: 'delete_client'; id: string }
  | { type: 'add_registry'; entry: RegistryFieldsDraft; attachDocuments?: boolean }
  | { type: 'update_registry'; id: string; changes: Partial<RegistryFieldsDraft> }
  | { type: 'add_appointment'; appointment: AppointmentFields }
  | { type: 'update_appointment'; id: string; changes: Partial<AppointmentFields> }
  | { type: 'delete_appointment'; id: string }
  | { type: 'whatsapp_reply'; to: string; name?: string; text: string }
  | { type: 'web_search'; query: string; urls?: string[] }
  | { type: 'draft_document'; kind: DocumentKind; details: string; language?: 'ar' | 'fr' }
  | { type: 'daily_report' }
  | { type: 'set_outfit'; label: string };

export type ActionStatus = 'pending' | 'done' | 'rejected' | 'failed';

export interface ActionRecord {
  id: string;
  action: AgentAction;
  status: ActionStatus;
  result?: string;
}

export interface AgentAttachmentMeta {
  name: string;
  type: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  attachments?: AgentAttachmentMeta[];
  actions?: ActionRecord[];
  sources?: { title: string; url: string }[];
  document?: { title: string; text: string };
  voice?: boolean; // message dicté à la voix
}

// ---- Apparence et réglages du personnage ----

export interface AvatarPhoto {
  id: string;
  label: string; // جلابة، بدلة...
  file: StoredFileRef;
  mouth: { x: number; y: number; w: number }; // position de la bouche sur la photo (0..1)
}

export interface AvatarLook {
  skin: string;
  hair: 'short' | 'bald' | 'long' | 'curly' | 'hijab';
  hairColor: string;
  beard: 'none' | 'short' | 'full';
  outfit: 'djellaba' | 'suit' | 'casual' | 'caftan';
  outfitColor: string;
  glasses: boolean;
}

export type Personality = 'serious' | 'friendly' | 'formal';

export interface AgentSettings {
  name: string;
  gender: 'male' | 'female';
  avatarMode: 'photo' | 'illustrated';
  photos: AvatarPhoto[];
  activePhotoId?: string;
  look: AvatarLook;
  colors: { primary: string; accent: string };
  voice: { voiceURI?: string; rate: number; pitch: number; autoSpeak: boolean; micMode: 'ai' | 'browser' };
  personality: Personality;
  extraInstructions: string;
  confirmAll: boolean;
  reminders: { enabled: boolean; beforeMin: number };
  dailyReport: { enabled: boolean; hour: number };
}

// ---- Contexte envoyé au serveur avec chaque message ----

export interface AgentContext {
  today: string;
  timezone: string;
  properties: Array<Record<string, unknown>>;
  registry: Array<Record<string, unknown>>;
  clients: Array<Record<string, unknown>>;
  appointments: Array<Record<string, unknown>>;
  ads: Record<string, unknown>;
  whatsapp?: Record<string, unknown>;
  siteRequests?: Array<Record<string, unknown>>;
  opportunities?: Array<Record<string, unknown>>;
  memory: Array<{ id: string; text: string }>;
  outfits: string[];
}

export interface AgentPersona {
  name: string;
  gender: 'male' | 'female';
  personality: Personality;
  extraInstructions: string;
}

export interface AgentChatResponse {
  reply: string;
  transcript?: string;
  actions: AgentAction[];
}

// ---- WhatsApp (côté serveur) ----

export interface WaMessage {
  id: string;
  from: 'client' | 'agency';
  text: string;
  at: string;
  kind?: 'text' | 'audio' | 'image' | 'document' | 'other';
}

export interface WaLead {
  score: LeadScore;
  reason: string;
  intent?: string;
  propType?: string;
  budget?: string;
  area?: string;
}

export interface WaThread {
  id: string; // numéro international sans « + »
  phone: string;
  name: string;
  messages: WaMessage[];
  lastAt: string;
  unread: boolean;
  status: 'open' | 'done';
  lead?: WaLead;
  suggestion?: string;
}

// Action en attente créée hors de l'application (message WhatsApp du gérant à l'agent).
export interface AgentTask {
  id: string;
  createdAt: string;
  source: 'whatsapp';
  note: string;
  action: AgentAction;
  status: 'pending' | 'done' | 'rejected';
}
