import { useEffect, useState } from 'react';
import { ChatPage } from './pages/ChatPage';
import { FilesPage } from './pages/FilesPage';
import { GuidePage } from './pages/GuidePage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { InstallPage } from './pages/InstallPage';
import { MemoryPage } from './pages/MemoryPage';
import { LockPage, OnboardingPage } from './pages/OnboardingPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TaskDetailPage, TasksPage } from './pages/TasksPage';
import { ToolsPage } from './pages/ToolsPage';
import { useRoute, useSettings } from './ui/hooks';
import { applyTheme, Shell } from './ui/Shell';
import { ApprovalHost, Toaster } from './ui/widgets';

function Router() {
  const [section, id] = useRoute();
  switch (section) {
    case 'chat':
      return <ChatPage id={id} />;
    case 'tasks':
      return <TasksPage />;
    case 'task':
      return id ? <TaskDetailPage id={id} /> : <TasksPage />;
    case 'files':
      return <FilesPage id={id} />;
    case 'projects':
      return <ProjectsPage id={id} />;
    case 'history':
      return <HistoryPage />;
    case 'tools':
      return <ToolsPage />;
    case 'memory':
      return <MemoryPage />;
    case 'settings':
      return <SettingsPage section={id} />;
    case 'install':
      return <InstallPage />;
    case 'guide':
      return <GuidePage slug={id} />;
    default:
      return <HomePage />;
  }
}

export function App() {
  const s = useSettings();
  const [unlocked, setUnlocked] = useState(!s.pinHash);
  const [, force] = useState(0);
  useEffect(() => {
    applyTheme();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [s.theme]);

  let body;
  if (!s.onboarded) body = (
      <OnboardingPage
        onDone={() => {
          setUnlocked(true);
          force((n) => n + 1);
        }}
      />
    );
  else if (!unlocked) body = <LockPage onUnlock={() => setUnlocked(true)} />;
  else
    body = (
      <Shell>
        <Router />
      </Shell>
    );
  return (
    <>
      {body}
      <ApprovalHost />
      <Toaster />
    </>
  );
}
