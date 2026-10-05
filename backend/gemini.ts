// Accès à Gemini (Google). La clé reste sur le serveur.
import { GoogleGenAI, type Content, type Part } from '@google/genai';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const apiKey = process.env.GEMINI_API_KEY;
export const ai =
  apiKey && apiKey !== 'MY_GEMINI_API_KEY'
    ? new GoogleGenAI({ apiKey, ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}) })
    : null;
export const aiEnabled = Boolean(ai);

export type { Content, Part };

export interface InlineFile {
  mimeType: string;
  data: string; // base64
  name?: string;
}

// Types de fichiers que Gemini sait lire (images, PDF, audio, texte).
const READABLE = /^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf|audio\/|text\/plain)/;
export const isReadable = (f: InlineFile) => READABLE.test(f.mimeType) && typeof f.data === 'string' && f.data.length > 0;

export function filePart(f: InlineFile): Part {
  // « audio/webm;codecs=opus » → « audio/webm »
  return { inlineData: { mimeType: f.mimeType.split(';')[0], data: f.data } };
}

// Appel Gemini qui renvoie un objet JSON (réponse forcée en JSON).
export async function generateJson<T>(contents: Content[] | string, systemInstruction: string, temperature = 0.5): Promise<T> {
  if (!ai) throw new Error('GEMINI_API_KEY non configurée');
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: { systemInstruction, responseMimeType: 'application/json', temperature },
  });
  return JSON.parse(response.text || '{}') as T;
}

// Appel Gemini en texte libre, avec recherche Google et lecture des liens si demandé.
export async function generateText(
  contents: Content[] | string,
  systemInstruction: string,
  opts: { search?: boolean; temperature?: number } = {}
): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  if (!ai) throw new Error('GEMINI_API_KEY non configurée');
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction,
      temperature: opts.temperature ?? 0.4,
      ...(opts.search ? { tools: [{ googleSearch: {} }, { urlContext: {} }] } : {}),
    },
  });
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const sources = chunks
    .map((c) => ({ title: c.web?.title || c.web?.uri || '', url: c.web?.uri || '' }))
    .filter((s) => s.url && !seen.has(s.url) && seen.add(s.url))
    .slice(0, 8);
  return { text: (response.text || '').trim(), sources };
}
