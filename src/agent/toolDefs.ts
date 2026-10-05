// Outils que l'agent IA peut utiliser. Le modèle (côté serveur) choisit l'outil ;
// l'application l'exécute dans le navigateur, là où se trouvent les données, puis renvoie le résultat.
// Fichier partagé entre le serveur (app.ts) et l'application.

export type AgentMode = 'manager' | 'customer';

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  modes: AgentMode[];
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });
const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'search_properties',
    description: "Chercher des biens (annonces du site + registre du bureau). Tous les filtres sont optionnels. Retourne id, titre, ville, quartier, type, transaction, prix, surface, chambres.",
    parameters: obj({
      text: str('Mots-clés libres (quartier, ville, type, équipement…)'),
      city: str('Ville, ex. Meknès, Casablanca'),
      type: str('Appartement, Villa, Maison, Terrain, Local Commercial, Bureau, Immeuble, Riad, Ferme'),
      deal: { type: 'string', enum: ['vente', 'location', 'neuf'], description: 'Type de transaction' },
      maxPrice: num('Budget maximum en MAD'),
      minSurface: num('Surface minimale en m²'),
      minBedrooms: num('Nombre minimal de chambres'),
    }),
    modes: ['manager', 'customer'],
  },
  {
    name: 'get_property',
    description: "Détails complets d'un bien du site (description, équipements, prix, photos).",
    parameters: obj({ id: num('Identifiant du bien') }, ['id']),
    modes: ['manager', 'customer'],
  },
  {
    name: 'send_request_to_agency',
    description:
      "Transmettre au bureau la demande d'un client du site (visite, rappel ou recherche). Exiger d'abord le nom et le téléphone du client. Retourne si la demande est arrivée et un lien WhatsApp de secours.",
    parameters: obj(
      {
        kind: { type: 'string', enum: ['visite', 'rappel', 'recherche'] },
        name: str('Nom du client'),
        phone: str('Téléphone du client'),
        message: str('Résumé de la demande (budget, quartier, type, délai…)'),
        propertyId: num('Bien concerné, si connu'),
        preferredAt: str('Date/heure souhaitée au format ISO, si connue'),
      },
      ['kind', 'name', 'phone', 'message']
    ),
    modes: ['customer'],
  },
  {
    name: 'list_clients',
    description: 'Lister/chercher les clients (prospects) du bureau : nom, téléphone, demande, type, budget, zone, statut, notes.',
    parameters: obj({
      text: str('Recherche libre (nom, téléphone, zone, notes)'),
      status: { type: 'string', enum: ['نشط', 'في المتابعة', 'منجز', 'ملغى'] },
    }),
    modes: ['manager'],
  },
  {
    name: 'add_client',
    description: 'Ajouter un client (prospect) au registre clients.',
    parameters: obj(
      {
        name: str('Nom complet'),
        phone: str('Téléphone'),
        requestType: { type: 'string', enum: ['شراء', 'كراء', 'بيع', 'استثمار'], description: 'Achat, location, vente ou investissement' },
        propType: { type: 'string', enum: ['شقة', 'فيلا', 'أرض', 'محل تجاري', 'منزل', 'مكتب', 'رياض', 'ضيعة'] },
        budget: num('Budget en MAD (0 si inconnu)'),
        area: str('Zone/quartier recherché'),
        notes: str('Notes'),
      },
      ['name', 'phone']
    ),
    modes: ['manager'],
  },
  {
    name: 'update_client',
    description: "Modifier le statut ou ajouter une note à un client existant.",
    parameters: obj(
      {
        clientId: num('Identifiant du client'),
        status: { type: 'string', enum: ['نشط', 'في المتابعة', 'منجز', 'ملغى'] },
        addNote: str('Note à ajouter'),
      },
      ['clientId']
    ),
    modes: ['manager'],
  },
  {
    name: 'find_opportunities',
    description:
      "Trouver les opportunités : correspondances clients ↔ biens (type et budget), clients à relancer, et biens du registre sans annonce. Optionnellement pour un seul client.",
    parameters: obj({ clientId: num('Limiter à ce client') }),
    modes: ['manager'],
  },
  {
    name: 'list_appointments',
    description: 'Lister les rendez-vous (visites, rappels) entre deux dates. Par défaut : à partir d’aujourd’hui.',
    parameters: obj({ from: str('Début ISO'), to: str('Fin ISO') }),
    modes: ['manager'],
  },
  {
    name: 'add_appointment',
    description: 'Ajouter un rendez-vous ou un rappel dans l’agenda du bureau.',
    parameters: obj(
      {
        title: str('Objet, ex. « Visite villa Hamria »'),
        at: str('Date et heure au format ISO (heure du Maroc)'),
        clientName: str('Nom du client'),
        clientPhone: str('Téléphone du client'),
        propertyId: num('Bien concerné'),
        notes: str('Notes'),
      },
      ['title', 'at']
    ),
    modes: ['manager'],
  },
  {
    name: 'list_inbox',
    description: 'Lire les demandes envoyées par les clients du site (visites, rappels, recherches).',
    parameters: obj({}),
    modes: ['manager'],
  },
  {
    name: 'create_ads',
    description:
      "Préparer des annonces publicitaires pour un bien (elles arrivent « à valider » dans Publicités ; rien n'est publié sans le gérant). Par défaut toutes les plateformes et les langues ar, darija, fr.",
    parameters: obj(
      {
        propertyId: num('Bien du site'),
        platforms: { type: 'array', items: { type: 'string', enum: ['facebook', 'instagram', 'tiktok', 'whatsapp', 'snapchat', 'x', 'linkedin', 'threads', 'upscrolled', 'avito', 'mubawab', 'sarouty'] } },
        languages: { type: 'array', items: { type: 'string', enum: ['ar', 'darija', 'fr'] } },
      },
      ['propertyId']
    ),
    modes: ['manager'],
  },
  {
    name: 'ads_summary',
    description: 'Résumé des publicités : à valider, programmées (aujourd’hui), publiées, vues, messages, clients sérieux, par plateforme.',
    parameters: obj({}),
    modes: ['manager'],
  },
  {
    name: 'prepare_whatsapp',
    description:
      "Préparer un message WhatsApp pour un client (réponse, relance, proposition de bien). Le gérant l'envoie lui-même d'un clic. Écrire le texte dans le style du bureau.",
    parameters: obj({ phone: str('Téléphone du client'), text: str('Message complet') }, ['phone', 'text']),
    modes: ['manager'],
  },
  {
    name: 'open_page',
    description: "Ouvrir une page de l'application.",
    parameters: obj({ page: { type: 'string', enum: ['home', 'vendre', 'louer', 'neuf', 'ads', 'crm', 'legal'] } }, ['page']),
    modes: ['manager', 'customer'],
  },
];

export const toolsForMode = (mode: AgentMode) => TOOL_DEFS.filter((t) => t.modes.includes(mode));
