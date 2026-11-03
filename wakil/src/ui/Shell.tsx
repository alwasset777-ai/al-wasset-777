import { BookOpen, Brain, Download, Folder, FolderKanban, History, Home, ListChecks, Menu, MessageSquare, Moon, Plus, Puzzle, Settings, Sun, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { createChat, getSettings, saveSettings } from '../core/store';
import { go, useMedia, useRoute, useSettings } from './hooks';
import { cx, IconButton, Logo } from './primitives';

const NAV = [
  { path: '', label: 'Accueil', icon: Home },
  { path: 'chat', label: 'Conversations', icon: MessageSquare },
  { path: 'tasks', label: 'Tâches', icon: ListChecks },
  { path: 'files', label: 'Fichiers', icon: Folder },
  { path: 'projects', label: 'Projets', icon: FolderKanban },
  { path: 'history', label: 'Historique', icon: History },
  { path: 'tools', label: 'Outils & agents', icon: Puzzle },
  { path: 'memory', label: 'Mémoire', icon: Brain },
  { path: 'settings', label: 'Réglages', icon: Settings },
  { path: 'install', label: 'Installer', icon: Download },
  { path: 'guide', label: 'Guide', icon: BookOpen },
];
const MOBILE = ['', 'chat', 'tasks', 'files'];

export async function newChat() {
  const c = await createChat();
  go(`chat/${c.id}`);
}

export function ThemeButton() {
  const s = useSettings();
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <IconButton label={dark ? 'Thème clair' : 'Thème sombre'} onClick={() => saveSettings({ theme: dark ? 'light' : 'dark' })}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [section] = useRoute();
  const current = section || '';
  const desktop = useMedia('(min-width: 900px)');
  const [drawer, setDrawer] = useState(false);
  const isActive = (p: string) => (p === '' ? current === '' : current === p || (p === 'tasks' && current === 'task'));

  const navList = (onPick?: () => void) => (
    <nav className="space-y-0.5" aria-label="Navigation principale">
      {NAV.map(({ path, label, icon: Icon }) => (
        <a
          key={path}
          href={`#/${path}`}
          onClick={onPick}
          className={cx(
            'flex items-center gap-3 rounded-xl px-3 h-10 text-[14px] transition-colors',
            isActive(path) ? 'bg-surface-3 font-medium text-ink' : 'text-muted hover:text-ink hover:bg-surface-2',
          )}
        >
          <Icon size={17} /> {label}
        </a>
      ))}
    </nav>
  );

  if (desktop) {
    return (
      <div className="h-full flex">
        <aside className="w-[248px] shrink-0 border-r border-line bg-surface/60 flex flex-col">
          <div className="flex items-center gap-2.5 px-5 h-16">
            <Logo size={30} />
            <div>
              <div className="font-semibold tracking-tight leading-none">Wakil</div>
              <div className="text-[11px] text-muted mt-1">Agent IA autonome</div>
            </div>
            <div className="ml-auto">
              <ThemeButton />
            </div>
          </div>
          <div className="px-3 pb-3">
            <button onClick={newChat} className="w-full h-10 rounded-xl bg-accent text-accent-fg font-medium text-sm inline-flex items-center justify-center gap-2 hover:brightness-105">
              <Plus size={17} /> Nouvelle conversation
            </button>
          </div>
          <div className="px-3 overflow-y-auto flex-1">{navList()}</div>
          <div className="px-5 py-3 text-[11px] text-muted border-t border-line">Données stockées sur cet appareil</div>
        </aside>
        <main className="flex-1 min-w-0 h-full overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="safe-top shrink-0 border-b border-line bg-surface/80 backdrop-blur">
        <div className="h-14 flex items-center gap-2 px-3">
          <IconButton label="Menu" onClick={() => setDrawer(true)}>
            <Menu size={20} />
          </IconButton>
          <a href="#/" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-semibold">Wakil</span>
          </a>
          <div className="ml-auto flex items-center">
            <ThemeButton />
            <IconButton label="Nouvelle conversation" onClick={newChat}>
              <Plus size={20} />
            </IconButton>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      <nav className="shrink-0 border-t border-line bg-surface/90 backdrop-blur safe-bottom" aria-label="Navigation rapide">
        <div className="grid grid-cols-4">
          {NAV.filter((n) => MOBILE.includes(n.path)).map(({ path, label, icon: Icon }) => (
            <a key={path} href={`#/${path}`} className={cx('flex flex-col items-center justify-center gap-0.5 h-14 text-[11px]', isActive(path) ? 'text-accent font-medium' : 'text-muted')}>
              <Icon size={20} />
              {label === 'Conversations' ? 'Chats' : label}
            </a>
          ))}
        </div>
      </nav>
      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setDrawer(false)}>
          <div className="safe-top absolute inset-y-0 left-0 w-[82vw] max-w-[300px] bg-surface border-r border-line flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 h-14">
              <Logo size={26} />
              <span className="font-semibold">Wakil</span>
              <IconButton className="ml-auto" label="Fermer le menu" onClick={() => setDrawer(false)}>
                <X size={18} />
              </IconButton>
            </div>
            <div className="px-3 overflow-y-auto flex-1">{navList(() => setDrawer(false))}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Applique le thème choisi (clair/sombre/système). */
export function applyTheme() {
  const t = getSettings().theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = dark ? '#0d121c' : '#f7f5f0';
  document.head.appendChild(m);
}

export function PageScroll({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cx('mx-auto px-4 sm:px-8 py-6 sm:py-8', narrow ? 'max-w-3xl' : 'max-w-6xl')}>{children}</div>
    </div>
  );
}
