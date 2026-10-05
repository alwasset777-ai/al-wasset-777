import React, { useState } from 'react';
import { MessageCircle, CalendarDays, MessagesSquare, ClipboardList, BarChart3, Brain, Palette, Lock } from 'lucide-react';
import type { Property } from '../../types';
import { tasksLive, waLive } from '../../agent/live';
import { settingsStore, useStore } from '../../agent/stores';
import { LoginCard, SignOutButton, useAuthUser } from '../AuthGate';
import { useManagerAccess } from '../../services/managerAccess';
import { AgentConversation } from './AgentConversation';
import { AppointmentsPanel } from '../AppointmentsPanel';
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
  const access = useManagerAccess();
  const settings = useStore(settingsStore);
  const wa = useStore(waLive);
  const tasks = useStore(tasksLive);

  if (access.usesFirebase && user === undefined) return <div className="py-12 text-center text-xs text-[#7a5c58]">…</div>;
  if (!access.isManager) {
    return (
      <div className="py-10">
        {access.usesFirebase ? <LoginCard title={`${settings.name} – خاص بمدير المكتب`} /> : <PinCard access={access} title={settings.name} />}
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
        {!access.usesFirebase && (
          <button onClick={access.lock} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#99807d] hover:text-[#ff6f61] cursor-pointer">
            <Lock className="w-3.5 h-3.5" /> قفل
          </button>
        )}
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

// Sans Firebase : le même code PIN que le « وضع المدير » de la bulle (choisi sur cet appareil).
const PinCard: React.FC<{ access: ReturnType<typeof useManagerAccess>; title: string }> = ({ access, title }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return setError(true);
    if (access.needsSetup) await access.setupPin(pin);
    else if (!(await access.unlock(pin))) return setError(true);
    setPin('');
  };
  return (
    <form onSubmit={submit} dir="rtl" className="max-w-sm mx-auto bg-white rounded-3xl p-6 border border-[#f0e4e2] space-y-3">
      <div className="flex items-center gap-2 text-sm font-black">
        <Lock className="w-4 h-4 text-[#ff6f61]" /> {title} – خاص بمدير المكتب
      </div>
      <p className="text-xs text-[#7a5c58]">
        {access.needsSetup ? 'اختر رمزاً سرياً (4 أرقام على الأقل) لوضع المدير على هذا الجهاز:' : 'أدخل الرمز السري لوضع المدير:'}
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value);
          setError(false);
        }}
        className="w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm text-center tracking-widest"
        dir="ltr"
      />
      {error && <p className="text-xs text-red-600 font-bold">الرمز غير صحيح</p>}
      <button type="submit" className="w-full py-2.5 rounded-xl bg-[#ff6f61] text-white text-sm font-bold cursor-pointer">دخول</button>
    </form>
  );
};
