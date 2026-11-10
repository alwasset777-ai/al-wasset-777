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
        country: str('Pays du numéro si client étranger / MRE (indicatif ou nom). Vide = pays par défaut'),
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
    name: 'prepare_social_share',
    description:
      "Partager un texte (annonce, publication, lien d'un bien) sur les réseaux : affiche au gérant un bouton « partager dans toutes les applications » (Instagram, TikTok, Snapchat, Messenger… via le téléphone) et des boutons directs (WhatsApp, Facebook, X, Telegram, Threads, LinkedIn). Renvoie aussi les comptes du bureau déjà reliés. Le gérant publie lui-même d'un clic.",
    parameters: obj(
      {
        text: str('Texte complet de la publication'),
        url: str('Lien à partager (fiche du bien, site). Facultatif'),
        platforms: { type: 'array', items: { type: 'string', enum: ['whatsapp', 'facebook', 'x', 'telegram', 'threads', 'linkedin'] }, description: 'Boutons directs à afficher (par défaut : whatsapp, facebook, telegram, x)' },
      },
      ['text'],
    ),
    modes: ['manager'],
  },
  {
    name: 'prepare_whatsapp',
    description:
      "Préparer un message WhatsApp pour un client (réponse, relance, proposition de bien). Le gérant l'envoie lui-même d'un clic. Écrire le texte dans le style du bureau.",
    parameters: obj(
      {
        phone: str('Téléphone du client (local « 06… » ou international « +33… »)'),
        text: str('Message complet'),
        country: str("Pays du numéro si client étranger / MRE : indicatif (33, 34, 39…) ou nom (France, Espagne…). Vide = pays par défaut du bureau"),
      },
      ['phone', 'text'],
    ),
    modes: ['manager'],
  },
  {
    name: 'remember',
    description:
      "Mémoriser ce que M. Mounir t'apprend pour toujours l'appliquer : une information durable (fact), une préférence d'écriture (style), ou une façon de faire / une commande raccourcie (skill, ex. « كي نقول ليك تقرير، عطيني المواعيد والزبناء الجداد »). Une phrase claire par souvenir.",
    parameters: obj({ kind: { type: 'string', enum: ['fact', 'style', 'skill'] }, text: str('Ce qu’il faut retenir, en une phrase claire') }, ['kind', 'text']),
    modes: ['manager'],
  },
  {
    name: 'forget',
    description: "Oublier un souvenir (quand M. Mounir le demande) : par identifiant ou par mots du souvenir.",
    parameters: obj({ query: str('Identifiant ou mots du souvenir à oublier') }, ['query']),
    modes: ['manager'],
  },
  {
    name: 'list_memory',
    description: "Lister tout ce que M. Mounir t'a appris (souvenirs, style, مهارات), avec leurs identifiants.",
    parameters: obj({}),
    modes: ['manager'],
  },
  // ---- Service « النمو · Croissance » (vente de visuels aux autres agences, encaissements, opportunités) ----
  {
    name: 'growth_summary',
    description:
      "Tableau de bord « النمو » : total encaissé (MAD), palier atteint et suivant (1er encaissement → 5 000 → 10 000 → 20 000 MAD/mois), projets avec jours écoulés et signaux (règle : 30 jours sans signal → proposer d'arrêter), agences prospectées par statut, relances en retard, opportunités notées /30.",
    parameters: obj({}),
    modes: ['manager'],
  },
  {
    name: 'list_agency_prospects',
    description: "Lister les agences immobilières prospectées (clients potentiels des visuels) : id, nom, ville, téléphone, statut, notes, dates de contact et de relance.",
    parameters: obj({
      text: str('Recherche libre (nom, ville, notes)'),
      status: { type: 'string', enum: ['à vérifier', 'contacté', 'a répondu', 'démo faite', 'proposition envoyée', 'client', 'refus'] },
    }),
    modes: ['manager'],
  },
  {
    name: 'save_agency_prospect',
    description:
      "Ajouter une agence prospectée (sans id) ou mettre à jour une agence existante (avec id) : statut, téléphone, note, date de relance. Une note est ajoutée datée, sans effacer les anciennes.",
    parameters: obj({
      id: str('Identifiant AG-xxx pour une mise à jour'),
      name: str('Nom de l’agence (obligatoire pour un ajout)'),
      city: str('Ville'),
      phone: str('Téléphone'),
      status: { type: 'string', enum: ['à vérifier', 'contacté', 'a répondu', 'démo faite', 'proposition envoyée', 'client', 'refus'] },
      addNote: str('Note à ajouter (ex. réponse de l’agence, objection entendue)'),
      nextFollowUp: str('Date de relance AAAA-MM-JJ'),
    }),
    modes: ['manager'],
  },
  {
    name: 'add_revenue',
    description:
      "Enregistrer un encaissement RÉEL (argent reçu, pas une promesse) : date, source, projet, montant en MAD, preuve (facture, reçu, capture). Refuser si le gérant parle d'une promesse ou d'une estimation.",
    parameters: obj(
      {
        date: str('Date AAAA-MM-JJ (aujourd’hui par défaut)'),
        source: str('Qui a payé et pourquoi, ex. « Agence X — visuels du mois »'),
        project: { type: 'string', enum: ['P-001', 'P-002', 'P-003', 'autre'] },
        amountMad: num('Montant encaissé en MAD'),
        proof: str('Preuve : nom du fichier ou description'),
      },
      ['source', 'amountMad']
    ),
    modes: ['manager'],
  },
  {
    name: 'log_growth_signal',
    description: "Ajouter des signaux à un projet « النمو » (vues d'une vidéo, clics, contacts entrants), pour la règle des 30 jours.",
    parameters: obj(
      {
        project: { type: 'string', enum: ['P-001', 'P-002', 'P-003'] },
        views: num('Vues à ajouter'),
        clicks: num('Clics à ajouter'),
        contacts: num('Contacts entrants à ajouter'),
      },
      ['project']
    ),
    modes: ['manager'],
  },
  {
    name: 'growth_script',
    description:
      "Textes validés pour prospecter les agences : premier message (darija ou français), relance, présentation de l'offre, ou réponse à une objection. Pour l'envoyer, enchaîner avec prepare_whatsapp.",
    parameters: obj(
      {
        kind: { type: 'string', enum: ['first_message_darija', 'first_message_fr', 'followup', 'offer', 'objection'] },
        agencyName: str('Nom à mettre dans le message'),
        objection: str('Ce que l’agence a répondu (pour kind = objection)'),
      },
      ['kind']
    ),
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
