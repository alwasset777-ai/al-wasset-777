// Exécution des outils de l'agent dans le navigateur (là où se trouvent les données du bureau).
import { AdLanguage, AdPlatform, ClientLead, Property } from '../types';
import { AgentMode, toolsForMode } from './toolDefs';
import { PLATFORMS, platformSpec } from '../services/adGenerator';
import { generateDrafts, getDrafts } from '../services/adsStore';
import { appointmentsStore, clientsStore, newAppointmentId } from '../services/officeStores';
import { registryStore } from '../services/registryStore';
import { listInbox, sendToAgency } from '../services/inbox';

export type AgentEffect =
  | { type: 'link'; label: string; url: string; kind: 'whatsapp' | 'ads' | 'other' }
  | { type: 'navigate'; page: string };

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

const toPhone = (p: string) => {
  const digits = p.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `212${digits.slice(1)}`;
  return digits;
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

export async function runTool(name: string, args: any, ctx: ToolContext): Promise<ToolOutcome> {
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
      const client: ClientLead = {
        id: Date.now(), name: String(args.name), phone: String(args.phone), category: 'فرد',
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

    case 'prepare_whatsapp': {
      const phone = toPhone(String(args.phone || ''));
      if (phone.length < 9) return ok({ error: 'Numéro invalide' });
      effects.push({ type: 'link', label: `أرسل عبر واتساب إلى ${args.phone}`, url: `https://wa.me/${phone}?text=${encodeURIComponent(String(args.text || ''))}`, kind: 'whatsapp' });
      return ok({ prepared: true, note: 'Bouton WhatsApp affiché au gérant' });
    }

    case 'open_page': {
      effects.push({ type: 'navigate', page: String(args.page) });
      return ok({ opened: args.page });
    }
  }
  return ok({ error: 'Outil inconnu' });
}
