// Publication sur la Page Facebook et le compte Instagram professionnel via l'API Graph de Meta.
// Les jetons restent côté serveur (variables d'environnement), jamais dans le navigateur.
const GRAPH = `${process.env.META_GRAPH_URL || 'https://graph.facebook.com'}/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
const PAGE_ID = process.env.META_PAGE_ID;
const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const IG_USER_ID = process.env.META_IG_USER_ID;

export const metaStatus = {
  facebook: Boolean(PAGE_ID && PAGE_TOKEN),
  instagram: Boolean(IG_USER_ID && PAGE_TOKEN),
};

async function graph(path: string, body: URLSearchParams | FormData): Promise<any> {
  const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Erreur Meta (${res.status})`);
  return data;
}

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: PAGE_TOKEN! });
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Erreur Meta (${res.status})`);
  return data;
}

// Facebook : photo avec légende, depuis une URL publique ou un fichier envoyé directement.
export async function publishFacebook(caption: string, image: { url?: string; jpegBase64?: string }): Promise<string> {
  if (!metaStatus.facebook) throw new Error('Page Facebook non configurée');
  if (image.url) {
    const data = await graph(`${PAGE_ID}/photos`, new URLSearchParams({ url: image.url, caption, access_token: PAGE_TOKEN! }));
    return data.post_id || data.id;
  }
  if (image.jpegBase64) {
    const form = new FormData();
    form.append('caption', caption);
    form.append('access_token', PAGE_TOKEN!);
    form.append('source', new Blob([Buffer.from(image.jpegBase64, 'base64')], { type: 'image/jpeg' }), 'alwassit777.jpg');
    const data = await graph(`${PAGE_ID}/photos`, form);
    return data.post_id || data.id;
  }
  const data = await graph(`${PAGE_ID}/feed`, new URLSearchParams({ message: caption, access_token: PAGE_TOKEN! }));
  return data.id;
}

// Instagram : l'image doit être un JPEG accessible publiquement (lien Firebase Storage).
export async function publishInstagram(caption: string, imageUrl: string): Promise<string> {
  if (!metaStatus.instagram) throw new Error('Compte Instagram non configuré');
  const container = await graph(`${IG_USER_ID}/media`, new URLSearchParams({ image_url: imageUrl, caption, access_token: PAGE_TOKEN! }));
  // Attendre que Meta ait traité l'image avant de publier.
  for (let i = 0; i < 10; i++) {
    const { status_code } = await graphGet(container.id, { fields: 'status_code' });
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR') throw new Error("Instagram a refusé l'image");
    await new Promise((r) => setTimeout(r, 2000));
  }
  const published = await graph(`${IG_USER_ID}/media_publish`, new URLSearchParams({ creation_id: container.id, access_token: PAGE_TOKEN! }));
  return published.id;
}
