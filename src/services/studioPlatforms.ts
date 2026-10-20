// Plateformes du « استوديو النشر » (publication via Metricool). Partagé entre le navigateur et le serveur.
export type StudioNetwork = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'threads' | 'linkedin' | 'twitter' | 'gmb' | 'bluesky';

export interface StudioPlatformSpec {
  id: StudioNetwork;
  label: string;
  maxChars: number;
  maxHashtags: number;
  needs: 'none' | 'media' | 'video'; // média obligatoire
  title?: boolean; // titre séparé (YouTube, TikTok)
  color: string;
  size: [number, number]; // dimensions de l'affiche recommandées par la plateforme
  format: string; // nom du format affiché au gérant
}

export const STUDIO_PLATFORMS: StudioPlatformSpec[] = [
  { id: 'facebook', label: 'Facebook', maxChars: 5000, maxHashtags: 8, needs: 'none', color: '#0866ff', size: [1080, 1350], format: '4:5' },
  { id: 'instagram', label: 'Instagram', maxChars: 2200, maxHashtags: 15, needs: 'media', color: '#e1306c', size: [1080, 1350], format: '4:5' },
  { id: 'tiktok', label: 'TikTok', maxChars: 2200, maxHashtags: 5, needs: 'media', title: true, color: '#111111', size: [1080, 1920], format: '9:16' },
  { id: 'youtube', label: 'YouTube', maxChars: 5000, maxHashtags: 5, needs: 'video', title: true, color: '#ff0000', size: [1080, 1920], format: 'Short' },
  { id: 'threads', label: 'Threads', maxChars: 500, maxHashtags: 3, needs: 'none', color: '#111111', size: [1080, 1350], format: '4:5' },
  { id: 'linkedin', label: 'LinkedIn', maxChars: 3000, maxHashtags: 5, needs: 'none', color: '#0a66c2', size: [1080, 1350], format: '4:5' },
  { id: 'twitter', label: 'X', maxChars: 280, maxHashtags: 2, needs: 'none', color: '#000000', size: [1600, 900], format: '16:9' },
  { id: 'gmb', label: 'Google Business', maxChars: 1500, maxHashtags: 0, needs: 'none', color: '#4285f4', size: [1200, 900], format: '4:3' },
  { id: 'bluesky', label: 'Bluesky', maxChars: 300, maxHashtags: 2, needs: 'none', color: '#1185fe', size: [1200, 675], format: '16:9' },
];

export const STUDIO_NETWORK_IDS = STUDIO_PLATFORMS.map((p) => p.id);

export const studioSpec = (id: StudioNetwork) => STUDIO_PLATFORMS.find((p) => p.id === id)!;

// Langue des publications : « ar+fr » = un seul texte bilingue (arabe puis français), choix par défaut.
export type StudioLanguage = 'ar+fr' | 'ar' | 'fr' | 'darija';

export const STUDIO_LANGUAGES: { id: StudioLanguage; label: string }[] = [
  { id: 'ar+fr', label: 'العربية + Français' },
  { id: 'ar', label: 'العربية' },
  { id: 'fr', label: 'Français' },
  { id: 'darija', label: 'الدارجة' },
];
