// Plateformes du « استوديو النشر » (publication via Metricool). Partagé entre le navigateur et le serveur.
export type StudioNetwork = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'threads' | 'gmb' | 'bluesky';

export interface StudioPlatformSpec {
  id: StudioNetwork;
  label: string;
  maxChars: number;
  maxHashtags: number;
  needs: 'none' | 'media' | 'video'; // média obligatoire
  title?: boolean; // titre séparé (YouTube, TikTok)
  color: string;
}

export const STUDIO_PLATFORMS: StudioPlatformSpec[] = [
  { id: 'facebook', label: 'Facebook', maxChars: 5000, maxHashtags: 8, needs: 'none', color: '#1877f2' },
  { id: 'instagram', label: 'Instagram', maxChars: 2200, maxHashtags: 15, needs: 'media', color: '#e1306c' },
  { id: 'tiktok', label: 'TikTok', maxChars: 2200, maxHashtags: 5, needs: 'media', title: true, color: '#111111' },
  { id: 'youtube', label: 'YouTube', maxChars: 5000, maxHashtags: 5, needs: 'video', title: true, color: '#ff0000' },
  { id: 'threads', label: 'Threads', maxChars: 500, maxHashtags: 3, needs: 'none', color: '#333333' },
  { id: 'gmb', label: 'Google Business', maxChars: 1500, maxHashtags: 0, needs: 'none', color: '#34a853' },
  { id: 'bluesky', label: 'Bluesky', maxChars: 300, maxHashtags: 2, needs: 'none', color: '#1185fe' },
];

export const STUDIO_NETWORK_IDS = STUDIO_PLATFORMS.map((p) => p.id);

export const studioSpec = (id: StudioNetwork) => STUDIO_PLATFORMS.find((p) => p.id === id)!;
