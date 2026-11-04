// Service « النمو · Croissance » : suivi de ce que le bureau vend aux autres agences
// (visuels d'annonces), des encaissements réels, des projets et des opportunités notées.
// Mêmes données que le dépôt privé « money-skills-lab » du gérant ; lues et modifiées par l'agent منير.
import { createStore } from './createStore';

export const PROSPECT_STATUSES = ['à vérifier', 'contacté', 'a répondu', 'démo faite', 'proposition envoyée', 'client', 'refus'] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export interface AgencyProspect {
  id: string;
  name: string;
  city: string;
  phone: string;
  status: ProspectStatus;
  notes: string;
  lastContact?: string; // AAAA-MM-JJ
  nextFollowUp?: string; // AAAA-MM-JJ
}

export interface RevenueEntry {
  id: string;
  date: string; // AAAA-MM-JJ
  source: string;
  project: string; // P-001…
  amountMad: number;
  proof: string;
}

export interface GrowthProject {
  id: string;
  name: string;
  opportunity: string;
  start: string; // AAAA-MM-JJ
  signals: { views: number; clicks: number; contacts: number };
}

export interface Opportunity {
  id: string;
  title: string;
  // Demande, vitesse du 1er dirham, coût (5 = gratuit), scalabilité, automatisable IA, faible concurrence
  scores: [number, number, number, number, number, number];
  why: string;
}

const P = (id: number, name: string, city: string, phone = ''): AgencyProspect => ({
  id: `AG-${String(id).padStart(3, '0')}`, name, city, phone, status: 'à vérifier',
  notes: 'Source : annuaire en ligne (telecontact.ma / annuaire-gratuit.ma), numéro peut-être ancien.',
});

const SEED_PROSPECTS: AgencyProspect[] = [
  P(1, 'Bamekna Immobilier', 'Meknès'),
  P(2, 'Agence Immobilière Drissi', 'Meknès'),
  P(3, 'Agence Immobilière Saiss', 'Meknès', '0606451267'),
  P(4, 'Network Com', 'Meknès'),
  P(5, 'Ste Mekamek Immobilier', 'Meknès'),
  P(6, 'Agence Immobilière Touris', 'Meknès'),
  P(7, 'Sté Inov-Promo', 'Meknès'),
  P(8, 'Cabinet L. Benouna', 'Meknès', '0535522209'),
  P(9, 'Centre Commercial et Immobilier Bab Mansour', 'Meknès'),
  P(10, 'Fès Immobilier', 'Fès', '0675040975'),
  P(11, 'Agence Immobilière Challa', 'Fès', '0535640848'),
  P(12, 'Agence Al Mostakbal', 'Fès'),
  P(13, 'Hyper Immo', 'Fès'),
  P(14, 'AGI Fès (Agence immobilière de Fès)', 'Fès', '0535932015'),
  P(15, 'Appart Fès', 'Fès'),
];

const SEED_PROJECTS: GrowthProject[] = [
  { id: 'P-001', name: 'Pack Agence Digitale (visuels pour les agences)', opportunity: 'OPP-001', start: '2026-11-02', signals: { views: 0, clicks: 0, contacts: 0 } },
  { id: 'P-002', name: 'Vidéos « Acheter à Meknès depuis l’étranger » (MRE)', opportunity: 'OPP-002', start: '2026-11-02', signals: { views: 0, clicks: 0, contacts: 0 } },
  { id: 'P-003', name: 'Guide gratuit « Aide directe au logement »', opportunity: 'OPP-003', start: '2026-11-02', signals: { views: 0, clicks: 0, contacts: 0 } },
];

const SEED_OPPORTUNITIES: Opportunity[] = [
  { id: 'OPP-001', title: 'Vendre le « Pack Agence Digitale » aux agences du Maroc', scores: [4, 4, 5, 4, 4, 4], why: 'Produit déjà construit, réseau de confrères.' },
  { id: 'OPP-002', title: 'Vidéos bilingues pour les MRE → acheteurs pour l’agence', scores: [4, 3, 5, 4, 4, 4], why: 'Une vente = une grosse commission ; délai long.' },
  { id: 'OPP-003', title: 'Guide gratuit « Aide directe au logement » → acheteurs éligibles', scores: [5, 4, 5, 3, 4, 3], why: 'Forte demande, contenu facile à produire.' },
  { id: 'OPP-004', title: 'Freelance visuels immobiliers (Fiverr / Upwork)', scores: [3, 3, 5, 3, 4, 2], why: 'Concurrence mondiale, retrait de l’argent à vérifier.' },
  { id: 'OPP-005', title: 'Conseil / contenu logement social & PPP', scores: [3, 1, 5, 3, 3, 4], why: 'Crédibilité forte, 1er dirham lent.' },
  { id: 'OPP-006', title: 'Chaîne YouTube enfants', scores: [3, 1, 4, 2, 3, 1], why: '« Made for Kids » : publicité très limitée.' },
  { id: 'OPP-007', title: 'Vente de modèles Notion / Canva immobilier', scores: [3, 2, 5, 3, 3, 2], why: 'Encaissement en ligne depuis le Maroc à vérifier.' },
  { id: 'OPP-008', title: 'GitHub Sponsors / bounties', scores: [1, 1, 5, 1, 1, 1], why: 'Pas d’audience de développeurs.' },
];

export const prospectsStore = createStore<AgencyProspect[]>('alwassit777.growth.prospects.v1', SEED_PROSPECTS);
export const revenuesStore = createStore<RevenueEntry[]>('alwassit777.growth.revenues.v1', []);
export const projectsStore = createStore<GrowthProject[]>('alwassit777.growth.projects.v1', SEED_PROJECTS);
export const opportunitiesStore = createStore<Opportunity[]>('alwassit777.growth.opportunities.v1', SEED_OPPORTUNITIES);

export const MILESTONES_MAD = [1, 5000, 10000, 20000] as const; // 1er encaissement, puis par mois
export const KILL_AFTER_DAYS = 30;

export const opportunityScore = (o: Opportunity) => o.scores.reduce((a, b) => a + b, 0);
export const newGrowthId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

// Textes validés par le gérant (à envoyer par WhatsApp, jamais automatiquement).
export const GROWTH_SCRIPTS = {
  first_message_darija:
    'السلام عليكم سي/لالة {name}، معاك منير رادوي من وكالة الوسيط 777 بمكناس. كنصاوب لوكالتي تصاور إعلانات احترافية (فيسبوك، إنستغرام، ستوري) بالعربية والفرنسية فدقايق. بغيت نهديك 3 تصاور مجانية لواحد من العقارات ديالك باش تشوف النتيجة. واش نصيفط ليك مثال؟ 📞 0777777848',
  first_message_fr:
    'Bonjour {name}, Mounir Radoui de l’agence Al Wasset 777 à Meknès. Je produis pour mon agence des visuels d’annonces pro (Facebook, Instagram, story) en français et en arabe. Je vous offre 3 visuels gratuits pour l’un de vos biens, pour juger sur pièce. Je vous envoie un exemple ? 📞 0777777848',
  followup:
    'Je me permets de revenir vers vous : voici un exemple réalisé pour un de nos biens. Toujours partant pour vos 3 visuels gratuits ?',
  offer:
    'Formules : « Visuels du mois » (6 ou 12 visuels à votre logo, livrés sur WhatsApp sous 24 h, textes FR/AR) et « Installation du Studio à vos couleurs + formation 1 h ». Sans engagement de durée. Prix à fixer après les premiers échanges.',
} as const;

export const OBJECTION_REPLIES: { objection: string; keys: string[]; darija: string; fr: string }[] = [
  { objection: 'Je fais mes visuels moi-même', keys: ['محتاج', 'براسي', 'moi-même', 'besoin'], darija: 'مزيان! خليني نصاوب ليك 3 مجانية، وقارن بيدك. إلا ما عجبوكش ما خسرتي والو.', fr: 'Très bien. Je vous en fais 3 gratuitement, vous comparez. Aucun engagement.' },
  { objection: 'C’est cher', keys: ['غالي', 'cher', 'prix'], darija: 'شحال كتصرف دابا على الإشهار؟ نقدرو نبداو بـ6 تصاور فالشهر.', fr: 'Combien dépensez-vous en publicité ? On peut démarrer à 6 visuels par mois.' },
  { objection: 'Pas le temps', keys: ['الوقت', 'temps'], darija: 'هادشي علاش كاين: صيفط ليا التصاور فالواتساب، ونرجعهم ليك واجدين فـ24 ساعة.', fr: 'Justement : vous m’envoyez les photos sur WhatsApp, je vous rends tout prêt en 24 h.' },
  { objection: 'Tu es un concurrent', keys: ['منافس', 'concurrent'], darija: 'أنا ما كنتاصلش بالزبناء ديالك، كنصاوب غير التصويرة بالشعار ديالك. ونقدر نوقّع ليك التزام بالسرية.', fr: 'Je ne contacte jamais vos clients, le visuel porte uniquement votre logo. Je peux signer un engagement de confidentialité.' },
  { objection: 'J’ai déjà quelqu’un', keys: ['عندي واحد', 'déjà'], darija: 'مزيان. جرب 3 ديالي جنب ديالو، وخلي النتائج هي اللي تحكم.', fr: 'Parfait, testez 3 visuels côte à côte et comparez les réactions.' },
  { objection: 'Je vais réfléchir', keys: ['نفكر', 'réfléchir'], darija: 'واخا. نصيفط ليك المثال على عقار ديالك باش تفكر وانت شايف النتيجة؟', fr: 'Bien sûr. Je vous envoie l’exemple sur un de vos biens pour vous aider à décider ?' },
  { objection: 'Envoie juste le prix', keys: ['الثمن', 'tarif', 'prix seulement'], darija: 'نصيفطو اليوم. غير قول ليا: شحال من إعلان كتنشر فالشهر؟ باش نعطيك الثمن المناسب.', fr: 'Je vous l’envoie aujourd’hui. Combien d’annonces publiez-vous par mois ?' },
];
