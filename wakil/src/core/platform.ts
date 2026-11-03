// Détection de la plateforme : web/PWA, Android (Capacitor), Mac (Electron).
declare const __WAKIL_API_BASE__: string;
declare const __WAKIL_VERSION__: string;

export interface DesktopBridge {
  platform: string;
  workspaceDir: () => Promise<string>;
  runCommand: (command: string, cwd?: string) => Promise<{ code: number; stdout: string; stderr: string }>;
  writeFile: (path: string, content: string, binary?: boolean) => Promise<string>;
  openWorkspace: () => Promise<void>;
}

export const desktop = (): DesktopBridge | undefined => (typeof window !== 'undefined' ? (window as any).wakilDesktop : undefined);

export const isCapacitor = () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

export function platformName(): 'mac' | 'android' | 'ios' | 'web' {
  if (desktop()) return 'mac';
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
  if (cap?.isNativePlatform?.()) return cap.getPlatform() === 'ios' ? 'ios' : 'android';
  return 'web';
}

export const APP_VERSION = typeof __WAKIL_VERSION__ !== 'undefined' ? __WAKIL_VERSION__ : '0.1.0';
const BUILD_API_BASE = typeof __WAKIL_API_BASE__ !== 'undefined' ? __WAKIL_API_BASE__ : '';

let apiBaseOverride = '';
export function setApiBase(url?: string) {
  apiBaseOverride = (url || '').replace(/\/+$/, '');
}

/** Adresse des fonctions serveur (/api/fetch, /api/search). */
export function apiUrl(path: string): string {
  const base = apiBaseOverride || BUILD_API_BASE;
  return base + path;
}

export const DOWNLOADS = {
  repo: 'https://github.com/alwasset777-ai/al-wasset-777',
  releases: 'https://github.com/alwasset777-ai/al-wasset-777/releases/tag/wakil-latest',
  apk: 'https://github.com/alwasset777-ai/al-wasset-777/releases/download/wakil-latest/Wakil-android.apk',
  macArm: 'https://github.com/alwasset777-ai/al-wasset-777/releases/download/wakil-latest/Wakil-mac-apple-silicon.dmg',
  macIntel: 'https://github.com/alwasset777-ai/al-wasset-777/releases/download/wakil-latest/Wakil-mac-intel.dmg',
  docs: 'https://github.com/alwasset777-ai/al-wasset-777/tree/main/wakil/docs',
};
