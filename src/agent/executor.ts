// Exécution des outils de l'agent dans le navigateur (là où se trouvent les données du bureau).
import { AdLanguage, AdPlatform, ClientLead, Property } from '../types';
import { AgentMode, toolsForMode } from './toolDefs';
import { PLATFORMS, platformSpec } from '../services/adGenerator';
import { generateDrafts, getDrafts } from '../services/adsStore';
import { appointmentsStore, clientsStore, newAppointmentId } from '../services/officeStores';
import { registryStore } from '../services/registryStore';
import { listInbox, sendToAgency } from '../services/inbox';
import { forget, getMemory, remember, type MemoryKind } from '../services/muneerMemory';
import { logAchievement } from '../services/agentLog';
import { connectedAccounts, defaultShareUrl, SOCIALS, type SocialId } from '../services/social';
import { loadAgency } from '../services/agencySettings';
import { formatInternational, isValidWhatsApp, resolveCountry, toWhatsAppNumber } from '../services/phone';
import {
  AgencyProspect, GROWTH_SCRIPTS, KILL_AFTER_DAYS, MILESTONES_MAD, OBJECTION_REPLIES, PROSPECT_STATUSES, ProspectStatus, RevenueEntry,
  newGrowthId, opportunitiesStore, opportunityScore, projectsStore, prospectsStore, revenuesStore,
} from '../services/growthStore';

export type AgentEffect =
  | { type: 'link'; label: string; url: string; kind: 'whatsapp' | 'ads' | 'other' }
  | { type: 'navigate'; page: string }
  | { type: 'share'; label: string; text: string; url?: string };

export interface ToolContext {
  mode: AgentMode;
  properties: Property[];
}

export interface ToolOutcome {
  result: Record<string, unknown>;
  effects: AgentEffect[];
}

const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');

const TYPE_AR: Record<string, string> = {
  شقة: 'Appartement', فيلا: 'Villa', منزل: 'Maison', دار: 'Maison', أرض: 'Terrain', 'محل تجاري': 'Local Commercial',
  مكتب: 'Bureau', عمارة: 'Immeuble', رياض: 'Riad', ضيعة: 'Ferme',
};


function summarizeProperty(p: Property) {
  return {
    id: p.id, title: p.titleAr || p.titleFr, titleFr: p.titleFr, type: p.type, deal: p.listingType,
    city: p.city, district: p.district, price: p.priceFormattedFr, priceMad: p.price,
    surface: p.surface, bedrooms: p.bedrooms, status: p.status,
  };
}

async function searchProperties(args: any, ctx: ToolContext) {
  const text = norm(args.text);
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  const fits = (p: Property) => {
    if (args.city && !norm(p.city).includes(norm(args.city))) return false;
    if (args.type && p.type !== args.type && p.type !== TYPE_AR[args.type]) return false;
    if (args.deal && p.listingType !== args.deal) return false;
    if (args.maxPrice && p.price > Number(args.maxPrice) * 1.1) return false;
    if (args.minSurface && p.surface < Number(args.minSurface)) return false;
    if (args.minBedrooms && p.bedrooms < Number(args.minBedrooms)) return false;
    if (words.length) {
      const hay = norm([p.titleFr, p.titleAr, p.city, p.district, p.type, p.descriptionFr, p.features.join(' ')].join(' '));
      if (!words.some((w) => hay.includes(w))) return false;
    }
    return true;
  };
  const site = ctx.properties.filter(fits).slice(0, 8).map(summarizeProperty);
  let registry: unknown[] = [];
  if (ctx.mode === 'manager') {
    const all = await registryStore.getAll().catch(() => []);
    registry = all
      .filter((r) => !words.length || words.some((w) => norm([r.location, r.propertyType, r.notes, r.owner].join(' ')).includes(w)))
      .filter((r) => !args.city || norm(r.location).includes(norm(args.city)))
      .slice(0, 8)
      .map((r) => ({ registryId: r.id, type: r.propertyType, owner: r.owner, ownerPhone: r.ownerPhone, location: r.location, surface: r.surface, price: r.price, photos: r.photos.length }));
  }
  return { siteListings: site, ...(ctx.mode === 'manager' ? { officeRegistry: registry } : {}), total: site.length + registry.length };
}

const clientMatchesProperty = (c: ClientLead, p: Property) => {
  let score = 0;
  if (TYPE_AR[c.propType] === p.type) score += 40;
  const rentWanted = c.requestType === 'كراء';
  if ((rentWanted && p.listingType === 'location') || (!rentWanted && p.listingType !== 'location')) score += 10;
  if (c.budget > 0) {
    const diff = Math.abs(p.price - c.budget) / c.budget;
    if (diff <= 0.15) score += 40;
    else if (diff <= 0.3) score += 20;
  }
  if (c.area && norm(c.area).split(/[\s/،,]+/).some((w) => w.length > 2 && norm(`${p.district} ${p.city}`).includes(w))) score += 10;
  return score;
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' }); // AAAA-MM-JJ
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Tableau de bord « النمو » : uniquement des chiffres réellement enregistrés.
export function growthSummary() {
  const now = today();
  const revenues = revenuesStore.get();
  const totalMad = revenues.reduce((a, r) => a + r.amountMad, 0);
  const month = now.slice(0, 7);
  const thisMonthMad = revenues.filter((r) => r.date.startsWith(month)).reduce((a, r) => a + r.amountMad, 0);
  const reached = MILESTONES_MAD.filter((m, i) => (i === 0 ? totalMad >= m : thisMonthMad >= m));
  const next = MILESTONES_MAD.find((m, i) => (i === 0 ? totalMad < m : thisMonthMad < m));
  const prospects = prospectsStore.get();
  const byStatus: Record<string, number> = {};
  prospects.forEach((p) => (byStatus[p.status] = (byStatus[p.status] || 0) + 1));
  const followUpsDue = prospects
    .filter((p) => p.nextFollowUp && p.nextFollowUp <= now && p.status !== 'client' && p.status !== 'refus')
    .map((p) => ({ id: p.id, name: p.name, phone: p.phone, due: p.nextFollowUp }));
  const days = (from: string) => Math.floor((Date.parse(now) - Date.parse(from)) / 86400_000);
  const projects = projectsStore.get().map((p) => {
    const revenue = revenues.filter((r) => r.project === p.id).reduce((a, r) => a + r.amountMad, 0);
    const contacts = p.signals.contacts + (p.id === 'P-001' ? prospects.filter((x) => ['a répondu', 'démo faite', 'proposition envoyée', 'client'].includes(x.status)).length : 0);
    const hasSignal = p.signals.views + p.signals.clicks + contacts + revenue > 0;
    const elapsed = days(p.start);
    return { ...p, revenueMad: revenue, contacts, daysElapsed: elapsed, alert: !hasSignal && elapsed >= KILL_AFTER_DAYS ? 'Aucun signal après 30 jours : proposer d’arrêter et réallouer le temps' : undefined };
  });
  const opportunities = opportunitiesStore
    .get()
    .map((o) => ({ id: o.id, title: o.title, score: opportunityScore(o), priority: opportunityScore(o) >= 22 }))
    .sort((a, b) => b.score - a.score);
  return {
    totalMad, thisMonthMad, payments: revenues.length,
    milestonesReached: reached, nextMilestoneMad: next ?? null,
    prospects: { total: prospects.length, byStatus }, followUpsDue, projects, opportunities,
  };
}

// Exécute l'outil puis note la réalisation (panneau « 🏆 إنجازاتي ») quand l'action a réussi.
export async function runTool(name: string, args: any, ctx: ToolContext): Promise<ToolOutcome> {
  const outcome = await runToolInner(name, args, ctx);
  if (ctx.mode === 'manager' && !('error' in outcome.result)) {
    const detail = String(args?.name || args?.title || args?.source || args?.agencyName || '').slice(0, 40);
    logAchievement(name, detail);
  }
  return outcome;
}

async function runToolInner(name: string, args: any, ctx: ToolContext): Promise<ToolOutcome> {
  if (!toolsForMode(ctx.mode).some((t) => t.name === name)) {
    return { result: { error: `Outil non autorisé : ${name}` }, effects: [] };
  }
  const effects: AgentEffect[] = [];
  const ok = (result: Record<string, unknown>) => ({ result, effects });

  switch (name) {
    case 'search_properties':
      return ok(await searchProperties(args, ctx));

    case 'get_property': {
      const p = ctx.properties.find((x) => x.id === Number(args.id));
      if (!p) return ok({ error: 'Bien introuvable' });
      return ok({
        ...summarizeProperty(p),
        descriptionFr: p.descriptionFr, descriptionAr: p.descriptionAr, features: p.features,
        bathrooms: p.bathrooms, floor: p.floor, elevator: p.hasElevator, parking: p.hasParking, pool: p.hasPool, garden: p.hasGarden,
        furnished: p.isFurnished, photos: p.images.length,
      });
    }

    case 'send_request_to_agency': {
      const prop = args.propertyId ? ctx.properties.find((x) => x.id === Number(args.propertyId)) : undefined;
      const res = await sendToAgency({
        kind: ['visite', 'rappel', 'recherche'].includes(args.kind) ? args.kind : 'rappel',
        name: args.name, phone: args.phone, message: args.message || '',
        propertyId: prop?.id, propertyTitle: prop ? prop.titleAr || prop.titleFr : undefined,
        preferredAt: args.preferredAt,
      });
      if (!res.sent) effects.push({ type: 'link', label: 'أرسل الطلب عبر واتساب', url: res.whatsappUrl, kind: 'whatsapp' });
      return ok(res.sent ? { delivered: true } : { delivered: false, note: 'Le client doit appuyer sur le bouton WhatsApp affiché pour envoyer sa demande.' });
    }

    case 'list_clients': {
      const text = norm(args.text);
      const list = clientsStore.get().filter(
        (c) => (!args.status || c.status === args.status) && (!text || norm([c.name, c.phone, c.area, c.notes, c.propType].join(' ')).includes(text))
      );
      return ok({ count: list.length, clients: list.slice(0, 25).map(({ linkedPropIds, ...c }) => c) });
    }

    case 'add_client': {
      if (!args.name || !args.phone) return ok({ error: 'Nom et téléphone obligatoires' });
      // Client étranger (MRE…) : on garde le numéro au format international pour WhatsApp.
      const cc = resolveCountry(args.country);
      const intl = cc ? toWhatsAppNumber(String(args.phone), cc) : '';
      const client: ClientLead = {
        id: Date.now(), name: String(args.name), phone: intl && isValidWhatsApp(intl) ? formatInternational(intl) : String(args.phone), category: 'فرد',
        requestType: args.requestType || 'شراء', propType: args.propType || 'شقة', budget: Number(args.budget) || 0,
        area: args.area || '', status: 'نشط', notes: args.notes || '', linkedPropIds: [], dateAdded: new Date().toISOString().split('T')[0],
      };
      clientsStore.set((prev) => [client, ...prev]);
      return ok({ added: true, clientId: client.id });
    }

    case 'update_client': {
      const id = Number(args.clientId);
      let found = false;
      clientsStore.set((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          found = true;
          const stamp = new Date().toLocaleDateString('fr-FR');
          return {
            ...c,
            ...(args.status ? { status: args.status } : {}),
            ...(args.addNote ? { notes: `${c.notes ? `${c.notes}\n` : ''}[${stamp}] ${args.addNote}` } : {}),
          };
        })
      );
      return ok(found ? { updated: true } : { error: 'Client introuvable' });
    }

    case 'find_opportunities': {
      const clients = clientsStore.get().filter((c) => c.status === 'نشط' || c.status === 'في المتابعة');
      const target = args.clientId ? clients.filter((c) => c.id === Number(args.clientId)) : clients;
      const matches = target
        .flatMap((c) => ctx.properties.map((p) => ({ c, p, score: clientMatchesProperty(c, p) })))
        .filter((m) => m.score >= 50)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((m) => ({ clientId: m.c.id, client: m.c.name, phone: m.c.phone, propertyId: m.p.id, property: m.p.titleAr || m.p.titleFr, price: m.p.priceFormattedFr, score: m.score }));
      const monthAgo = Date.now() - 30 * 86400_000;
      const toFollowUp = clients
        .filter((c) => new Date(c.dateAdded).getTime() < monthAgo)
        .slice(0, 10)
        .map((c) => ({ clientId: c.id, client: c.name, phone: c.phone, since: c.dateAdded, status: c.status }));
      const registry = await registryStore.getAll().catch(() => []);
      const draftsProps = new Set(getDrafts().map((d) => d.propertyId));
      const siteWithoutAds = ctx.properties.filter((p) => !draftsProps.has(p.id)).slice(0, 8).map((p) => ({ id: p.id, title: p.titleAr || p.titleFr }));
      return ok({ matches, clientsToFollowUp: toFollowUp, listingsWithoutAds: siteWithoutAds, registryCount: registry.length });
    }

    case 'list_appointments': {
      const from = args.from ? new Date(args.from).getTime() : new Date().setHours(0, 0, 0, 0);
      const to = args.to ? new Date(args.to).getTime() : Infinity;
      const list = appointmentsStore
        .get()
        .filter((a) => {
          const t = new Date(a.at).getTime();
          return t >= from && t <= to && a.status !== 'annulé';
        })
        .sort((a, b) => (a.at < b.at ? -1 : 1));
      return ok({ count: list.length, appointments: list.slice(0, 30) });
    }

    case 'add_appointment': {
      const at = new Date(args.at);
      if (Number.isNaN(at.getTime())) return ok({ error: 'Date invalide' });
      const prop = args.propertyId ? ctx.properties.find((x) => x.id === Number(args.propertyId)) : undefined;
      const id = newAppointmentId();
      appointmentsStore.set((prev) => [
        {
          id, title: String(args.title || 'Rendez-vous'), clientName: args.clientName || '', clientPhone: args.clientPhone || '',
          propertyId: prop?.id, propertyTitle: prop ? prop.titleAr || prop.titleFr : undefined,
          at: at.toISOString(), notes: args.notes || '', status: 'confirmé', source: 'agent', createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      effects.push({ type: 'navigate', page: 'crm:appointments' });
      return ok({ added: true, appointmentId: id, at: at.toISOString() });
    }

    case 'list_inbox': {
      try {
        const items = await listInbox();
        return ok({ count: items.length, requests: items, online: true });
      } catch {
        return ok({ error: 'Lecture impossible (connexion du gérant requise)' });
      }
    }

    case 'create_ads': {
      const p = ctx.properties.find((x) => x.id === Number(args.propertyId));
      if (!p) return ok({ error: 'Bien introuvable' });
      const allPlatforms = PLATFORMS.map((x) => x.id);
      const platforms: AdPlatform[] = (Array.isArray(args.platforms) ? args.platforms : []).filter((x: string) => allPlatforms.includes(x as AdPlatform));
      const languages: AdLanguage[] = (Array.isArray(args.languages) ? args.languages : []).filter((x: string) => ['ar', 'darija', 'fr'].includes(x));
      const created = await generateDrafts(p, platforms.length ? platforms : allPlatforms, languages.length ? languages : ['ar', 'darija', 'fr']);
      effects.push({ type: 'link', label: 'افتح «الإعلانات» للمراجعة', url: '#ads', kind: 'ads' });
      return ok({ created: created.length, status: 'à valider dans Publicités' });
    }

    case 'ads_summary': {
      const drafts = getDrafts();
      const count = (s: string) => drafts.filter((d) => d.status === s).length;
      const today = new Date().toDateString();
      const published = drafts.filter((d) => d.status === 'publié');
      const byPlatform: Record<string, { posts: number; views: number; leads: number }> = {};
      published.forEach((d) => {
        const k = platformSpec(d.platform).label;
        byPlatform[k] ||= { posts: 0, views: 0, leads: 0 };
        byPlatform[k].posts += 1;
        byPlatform[k].views += d.stats.views || 0;
        byPlatform[k].leads += d.stats.leads || 0;
      });
      return ok({
        toReview: count('brouillon'), approved: count('approuvé'), scheduled: count('programmé'), published: published.length,
        scheduledToday: drafts.filter((d) => d.status === 'programmé' && d.scheduledAt && new Date(d.scheduledAt).toDateString() === today).length,
        views: published.reduce((a, d) => a + (d.stats.views || 0), 0),
        messages: published.reduce((a, d) => a + (d.stats.messages || 0), 0),
        leads: published.reduce((a, d) => a + (d.stats.leads || 0), 0),
        byPlatform,
      });
    }

    case 'prepare_social_share': {
      const text = String(args.text || '').trim();
      if (!text) return ok({ error: 'Texte obligatoire' });
      await loadAgency();
      const url = String(args.url || '').trim() || defaultShareUrl();
      const wanted: SocialId[] = Array.isArray(args.platforms) && args.platforms.length ? args.platforms : ['whatsapp', 'facebook', 'telegram', 'x'];
      effects.push({ type: 'share', label: 'شارك فكاع التطبيقات (Instagram، TikTok، Snapchat…)', text, url });
      for (const id of wanted) {
        const p = SOCIALS.find((s) => s.id === id);
        const link = p?.share?.(text, url);
        if (p && link) effects.push({ type: 'link', label: `انشر على ${p.name}`, url: link, kind: id === 'whatsapp' ? 'whatsapp' : 'other' });
      }
      return ok({ prepared: true, url, accounts: connectedAccounts().map((a) => `${a.name}: ${a.url}`), note: 'Boutons de partage affichés au gérant' });
    }

    case 'prepare_whatsapp': {
      if (args.country && !resolveCountry(args.country)) return ok({ error: `Pays inconnu : ${args.country}. Donner l'indicatif (ex. 33) ou écrire le numéro avec +` });
      const phone = toWhatsAppNumber(String(args.phone || ''), resolveCountry(args.country));
      if (!isValidWhatsApp(phone)) return ok({ error: 'Numéro invalide' });
      const shown = formatInternational(phone);
      effects.push({ type: 'link', label: `أرسل عبر واتساب إلى \u2066${shown}\u2069`, url: `https://wa.me/${phone}?text=${encodeURIComponent(String(args.text || ''))}`, kind: 'whatsapp' });
      return ok({ prepared: true, number: shown, note: 'Bouton WhatsApp affiché au gérant' });
    }

    case 'remember': {
      const kind: MemoryKind = ['fact', 'style', 'skill'].includes(args.kind) ? args.kind : 'fact';
      const item = remember(kind, String(args.text || ''));
      return ok(item ? { saved: true, id: item.id, total: getMemory().length } : { error: 'Texte trop court' });
    }

    case 'forget': {
      const removed = forget(String(args.query || ''));
      return ok({ removed: removed.map((m) => m.text), count: removed.length });
    }

    case 'list_memory': {
      const items = getMemory();
      return ok({ count: items.length, items: items.map((m) => ({ id: m.id, kind: m.kind, text: m.text })) });
    }

    case 'open_page': {
      effects.push({ type: 'navigate', page: String(args.page) });
      return ok({ opened: args.page });
    }

    // ---- Service « النمو · Croissance » ----
    case 'growth_summary':
      return ok(growthSummary());

    case 'list_agency_prospects': {
      const text = norm(args.text);
      const list = prospectsStore
        .get()
        .filter((p) => (!args.status || p.status === args.status) && (!text || norm([p.name, p.city, p.notes].join(' ')).includes(text)));
      return ok({ count: list.length, prospects: list.slice(0, 40) });
    }

    case 'save_agency_prospect': {
      const status = PROSPECT_STATUSES.includes(args.status) ? (args.status as ProspectStatus) : undefined;
      const stamp = today();
      const withNote = (notes: string) => (args.addNote ? `${notes ? `${notes}\n` : ''}[${stamp}] ${String(args.addNote)}` : notes);
      if (args.id) {
        let found = false;
        prospectsStore.set((prev) =>
          prev.map((p) => {
            if (p.id !== String(args.id)) return p;
            found = true;
            return {
              ...p,
              ...(args.name ? { name: String(args.name) } : {}),
              ...(args.city ? { city: String(args.city) } : {}),
              ...(args.phone ? { phone: String(args.phone) } : {}),
              ...(status ? { status, ...(status !== 'à vérifier' ? { lastContact: stamp } : {}) } : {}),
              ...(isDate(args.nextFollowUp) ? { nextFollowUp: String(args.nextFollowUp) } : {}),
              notes: withNote(p.notes),
            };
          })
        );
        return ok(found ? { updated: true, id: args.id } : { error: 'Agence introuvable' });
      }
      if (!args.name) return ok({ error: 'Nom de l’agence obligatoire pour un ajout' });
      const prospect: AgencyProspect = {
        id: newGrowthId('AG'), name: String(args.name), city: String(args.city || ''), phone: String(args.phone || ''),
        status: status || 'à vérifier', notes: withNote(''),
        ...(status && status !== 'à vérifier' ? { lastContact: stamp } : {}),
        ...(isDate(args.nextFollowUp) ? { nextFollowUp: String(args.nextFollowUp) } : {}),
      };
      prospectsStore.set((prev) => [...prev, prospect]);
      return ok({ added: true, id: prospect.id });
    }

    case 'add_revenue': {
      const amount = Number(args.amountMad);
      if (!Number.isFinite(amount) || amount <= 0) return ok({ error: 'Montant invalide' });
      if (!args.source) return ok({ error: 'Source obligatoire' });
      const entry: RevenueEntry = {
        id: newGrowthId('REV'), date: isDate(args.date) ? String(args.date) : today(), source: String(args.source),
        project: ['P-001', 'P-002', 'P-003'].includes(args.project) ? args.project : 'autre', amountMad: Math.round(amount), proof: String(args.proof || ''),
      };
      revenuesStore.set((prev) => [...prev, entry]);
      const s = growthSummary();
      return ok({ saved: true, id: entry.id, totalMad: s.totalMad, reminder: entry.proof ? undefined : 'Ajouter une preuve (facture, reçu, capture).' });
    }

    case 'log_growth_signal': {
      let found = false;
      const add = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
      projectsStore.set((prev) =>
        prev.map((p) => {
          if (p.id !== args.project) return p;
          found = true;
          return { ...p, signals: { views: p.signals.views + add(args.views), clicks: p.signals.clicks + add(args.clicks), contacts: p.signals.contacts + add(args.contacts) } };
        })
      );
      return ok(found ? { saved: true, project: args.project } : { error: 'Projet introuvable' });
    }

    case 'growth_script': {
      const name = String(args.agencyName || '').trim() || '…';
      if (args.kind === 'objection') {
        const said = norm(args.objection);
        const match = OBJECTION_REPLIES.find((o) => o.keys.some((k) => said.includes(norm(k))));
        return ok(match ? { objection: match.objection, darija: match.darija, fr: match.fr } : { note: 'Objection non répertoriée : répondre en 1 phrase puis proposer les 3 visuels gratuits.', all: OBJECTION_REPLIES.map((o) => o.objection) });
      }
      const key = args.kind as keyof typeof GROWTH_SCRIPTS;
      if (!GROWTH_SCRIPTS[key]) return ok({ error: 'Type de texte inconnu' });
      return ok({ text: GROWTH_SCRIPTS[key].replace('{name}', name) });
    }
  }
  return ok({ error: 'Outil inconnu' });
}
