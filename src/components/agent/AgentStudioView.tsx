import React from 'react';
import { MessageCircle, CalendarDays, MessagesSquare, ClipboardList, BarChart3, Brain, Palette } from 'lucide-react';
import type { Property } from '../../types';
import { isFirebaseEnabled } from '../../services/firebase';
import { tasksLive, waLive } from '../../agent/live';
import { settingsStore, useStore } from '../../agent/stores';
import { LoginCard, SignOutButton, useAuthUser } from '../AuthGate';
import { AgentConversation } from './AgentConversation';
import { AppointmentsPanel } from './AppointmentsPanel';
import { WhatsAppInbox } from './WhatsAppInbox';
import { AvatarSettings } from './AvatarSettings';
import { MemoryPanel, ReportPanel, TasksPanel } from './StudioPanels';

export type StudioSection = 'chat' | 'tasks' | 'appointments' | 'whatsapp' | 'report' | 'memory' | 'settings';

interface Props {
  properties: Property[];
  onNavigate: (tab: string) => void;
  section: StudioSection;
  onSectionChange: (s: StudioSection) => void;
}

// Page « الوكيل » : le personnage, ses tâches, l'agenda, WhatsApp, le rapport, la mémoire et la personnalisation.
export const AgentStudioView: React.FC<Props> = ({ properties, onNavigate, section, onSectionChange }) => {
  const user = useAuthUser();
  const settings = useStore(settingsStore);
  const wa = useStore(waLive);
  const tasks = useStore(tasksLive);

  if (isFirebaseEnabled && user === undefined) return <div className="py-12 text-center text-xs text-[#7a5c58]">…</div>;
  if (isFirebaseEnabled && !user) {
    return (
      <div className="py-10">
        <LoginCard title={`${settings.name} – خاص بمدير المكتب`} />
      </div>
    );
  }

  const unread = wa.threads.filter((t) => t.unread).length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const tabs: Array<{ id: StudioSection; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'chat', label: 'المحادثة', icon: MessageCircle },
    { id: 'tasks', label: 'المهام', icon: ClipboardList, badge: pending },
    { id: 'appointments', label: 'المواعيد', icon: CalendarDays },
    { id: 'whatsapp', label: 'واتساب', icon: MessagesSquare, badge: unread },
    { id: 'report', label: 'التقرير', icon: BarChart3 },
    { id: 'memory', label: 'الذاكرة', icon: Brain },
    { id: 'settings', label: 'التخصيص', icon: Palette },
  ];

  return (
    <div className="pb-16 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-black flex-1">{settings.name}</h1>
        {user && <SignOutButton user={user} />}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => onSectionChange(id)}
            className={`relative shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border cursor-pointer ${
              section === id ? 'text-white border-transparent' : 'bg-white border-[#f0e4e2] text-[#5a4340]'
            }`}
            style={section === id ? { background: settings.colors.primary } : undefined}
          >
            <Icon className="w-4 h-4" /> {label}
            {!!badge && <span className="min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{badge}</span>}
          </button>
        ))}
      </div>

      {section === 'chat' && <AgentConversation properties={properties} onNavigate={onNavigate} variant="page" />}
      {section === 'tasks' && <TasksPanel properties={properties} onNavigate={onNavigate} />}
      {section === 'appointments' && <AppointmentsPanel />}
      {section === 'whatsapp' && <WhatsAppInbox />}
      {section === 'report' && <ReportPanel />}
      {section === 'memory' && <MemoryPanel />}
      {section === 'settings' && <AvatarSettings />}
    </div>
  );
};
