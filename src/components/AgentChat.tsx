import React, { useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Send, X, Volume2, VolumeX, Trash2, Loader2, Megaphone, Download, Lock, Unlock, MessageCircle, ExternalLink, Wrench } from 'lucide-react';
import { Language, Property } from '../types';
import { ChatMessage, GeminiContent, runAgentTurn } from '../services/agentChat';
import { AgentEffect } from '../agent/executor';
import { AgentMode } from '../agent/toolDefs';
import { loadJSON, saveJSON } from '../services/storage';
import { canInstallApp, onInstallAvailable, promptInstall, isStandalone } from '../services/pwa';
import { useManagerAccess } from '../services/managerAccess';
import { LoginCard } from './AuthGate';
import { settingsStore, useStore } from '../agent/stores';
import { tasksLive, waLive } from '../agent/live';
import { AgentAvatar } from './agent/Avatar';
import { AgentConversation } from './agent/AgentConversation';

interface AgentChatProps {
  properties: Property[];
  language: Language;
  onNavigate: (tab: string) => void;
  hideBubble?: boolean; // le gérant est déjà sur la page « الوكيل »
}

type VoiceLang = 'ar-MA' | 'fr-FR';
type UiMessage = ChatMessage & { effects?: AgentEffect[]; tools?: string[] };

const historyKey = (mode: AgentMode) => `alwassit777.agent.${mode}.messages.v2`;
const contentsKey = (mode: AgentMode) => `alwassit777.agent.${mode}.contents.v2`;
const VOICE_KEY = 'alwassit777.agent.voice.v1';
const MODE_KEY = 'alwassit777.agent.mode.v1';

const TOOL_LABELS: Record<string, string> = {
  search_properties: 'بحث في العقارات',
  get_property: 'تفاصيل عقار',
  send_request_to_agency: 'إرسال الطلب للمكتب',
  list_clients: 'قائمة الزبائن',
  add_client: 'إضافة زبون',
  update_client: 'تحديث زبون',
  find_opportunities: 'البحث عن الفرص',
  list_appointments: 'المواعيد',
  add_appointment: 'إضافة موعد',
  list_inbox: 'طلبات الموقع',
  create_ads: 'تحضير الإعلانات',
  ads_summary: 'نتائج الإعلانات',
  prepare_whatsapp: 'رسالة واتساب',
  open_page: 'فتح صفحة',
};

const newMsg = (role: ChatMessage['role'], text: string, extra: Partial<UiMessage> = {}): UiMessage => ({
  id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  role,
  text,
  at: new Date().toISOString(),
  ...extra,
});

const SpeechRecognitionImpl: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

// Bulle « وكيل الوسيط 777 » : assistant des clients du site, et assistant personnel du gérant (mode gérant).
export const AgentChat: React.FC<AgentChatProps> = ({ properties, language, onNavigate, hideBubble = false }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const t = (fr: string, ar: string, en: string) => (isAr ? ar : isEn ? en : fr);

  const access = useManagerAccess();
  const [wantManager, setWantManager] = useState<boolean>(() => loadJSON(MODE_KEY, false));
  const mode: AgentMode = wantManager && access.isManager ? 'manager' : 'customer';
  const avatarSettings = useStore(settingsStore);
  const wa = useStore(waLive);
  const pendingTasks = useStore(tasksLive).filter((x) => x.status === 'pending').length;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [contents, setContents] = useState<GeminiContent[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(() => loadJSON(VOICE_KEY, { speak: false, lang: 'ar-MA' as VoiceLang }));
  const [installable, setInstallable] = useState(canInstallApp());
  const [showUnlock, setShowUnlock] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const recogRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Chaque mode a sa propre conversation (les clients ne voient jamais celle du gérant).
  const [loadedMode, setLoadedMode] = useState<AgentMode | null>(null);
  useEffect(() => {
    setMessages(loadJSON<UiMessage[]>(historyKey(mode), []));
    setContents(loadJSON<GeminiContent[]>(contentsKey(mode), []));
    setLoadedMode(mode);
  }, [mode]);
  // N'enregistre qu'une fois la conversation du mode courant chargée (évite d'écraser l'autre mode).
  useEffect(() => {
    if (loadedMode === mode) saveJSON(historyKey(mode), messages.slice(-60));
  }, [messages, mode, loadedMode]);
  useEffect(() => {
    if (loadedMode === mode) saveJSON(contentsKey(mode), contents.slice(-40));
  }, [contents, mode, loadedMode]);
  useEffect(() => saveJSON(VOICE_KEY, voice), [voice]);
  useEffect(() => saveJSON(MODE_KEY, wantManager), [wantManager]);
  // Déverrouillé ailleurs (page « الوكيل », connexion) : la bulle passe aussi au personnage du gérant.
  const wasManager = useRef(access.isManager);
  useEffect(() => {
    if (access.isManager && !wasManager.current) setWantManager(true);
    wasManager.current = access.isManager;
  }, [access.isManager]);
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, open, busy]);

  const isPhone = () => window.innerWidth < 640;

  const speak = (text: string) => {
    if (!voice.speak || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#•📊✍️🗂️✅👇📞📍🏡💰📐]/gu, ''));
    u.lang = /[؀-ۿ]/.test(text) ? 'ar-MA' : 'fr-FR';
    speechSynthesis.speak(u);
  };

  const goTo = (page: string) => {
    const [tab, sub] = page.split(':');
    onNavigate(tab);
    if (sub) setTimeout(() => window.dispatchEvent(new CustomEvent('alwassit:crm-tab', { detail: sub })), 50);
    if (isPhone()) setOpen(false);
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((prev) => [...prev, newMsg('user', clean)]);
    setInput('');
    setBusy(true);
    try {
      const turn = await runAgentTurn(mode, contents, clean, properties);
      setContents(turn.contents);
      const links = turn.effects.filter((e) => e.type === 'link');
      setMessages((prev) => [...prev, newMsg('assistant', turn.reply, { effects: links, tools: [...new Set(turn.toolsUsed)] })]);
      speak(turn.reply);
      const nav = turn.effects.find((e) => e.type === 'navigate') as Extract<AgentEffect, { type: 'navigate' }> | undefined;
      if (nav) goTo(nav.page);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    if (!SpeechRecognitionImpl) return;
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const r = new SpeechRecognitionImpl();
    r.lang = voice.lang;
    r.interimResults = true;
    r.continuous = false;
    let finalText = '';
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      setInput(finalText + interim);
    };
    r.onend = () => {
      setListening(false);
      if (finalText.trim()) send(finalText);
    };
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return setPinError(true);
    if (access.needsSetup) await access.setupPin(pin);
    else if (!(await access.unlock(pin))) return setPinError(true);
    setPin('');
    setPinError(false);
    setShowUnlock(false);
    setWantManager(true);
  };

  const toggleManager = () => {
    if (mode === 'manager') {
      setWantManager(false);
      return;
    }
    if (access.isManager) setWantManager(true);
    else setShowUnlock(true);
  };

  const suggestions = [
    t('Je cherche un appartement à Meknès', 'كنقلب على شقة ف مكناس', 'Looking for an apartment in Meknes'),
    t('Villas avec piscine à vendre ?', 'واش عندكم فيلا فيها مسبح للبيع؟', 'Villas with a pool for sale?'),
    t('Je veux visiter un bien', 'بغيت نزور شي عقار', 'I want to visit a property'),
  ];

  if (hideBubble) return null;

  // Mode gérant : la bulle devient le personnage (avatar) qui parle et travaille pour le gérant.
  if (mode === 'manager') {
    const badge = wa.threads.filter((x) => x.unread).length + pendingTasks;
    return (
      <>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-5 end-5 z-50 flex items-center gap-2 ps-1.5 pe-4 py-1.5 rounded-full text-white shadow-2xl hover:scale-105 transition-transform cursor-pointer"
            style={{ background: avatarSettings.colors.primary }}
            aria-label={avatarSettings.name}
          >
            <span className="relative">
              <AgentAvatar settings={avatarSettings} size={44} />
              {badge > 0 && (
                <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-black flex items-center justify-center">{badge}</span>
              )}
            </span>
            <span className="text-sm font-extrabold">كلّم الوكيل</span>
          </button>
        )}
        {open && (
          <div className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:end-5 sm:w-[420px] sm:h-[680px] sm:max-h-[88vh] bg-white sm:rounded-3xl shadow-2xl border border-[#f0e4e2] flex flex-col overflow-hidden">
            {installable && !isStandalone() && (
              <button
                onClick={async () => setInstallable(!(await promptInstall()))}
                className="flex items-center justify-center gap-2 py-2 bg-[#fff0ed] text-[#ff6f61] text-xs font-extrabold cursor-pointer"
              >
                <Download className="w-4 h-4" /> ثبّت التطبيق على هذا الهاتف
              </button>
            )}
            <div className="flex-1 min-h-0">
              <AgentConversation
                properties={properties}
                onNavigate={goTo}
                variant="panel"
                onClose={() => setOpen(false)}
                headerExtra={
                  <button onClick={toggleManager} className="p-2 rounded-xl hover:bg-white/10 text-green-300 cursor-pointer" title="الخروج من وضع المدير">
                    <Unlock className="w-4 h-4" />
                  </button>
                }
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 end-5 z-50 flex items-center gap-2 ps-3 pe-4 py-3 rounded-full bg-[#281715] text-white shadow-2xl shadow-[#281715]/30 hover:scale-105 transition-transform cursor-pointer"
          aria-label="وكيل الوسيط 777"
        >
          <span className="w-8 h-8 rounded-full bg-[#ff6f61] flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </span>
          <span className="text-sm font-extrabold">{t('Parler à l’agent', 'كلّم الوكيل', 'Talk to agent')}</span>
        </button>
      )}

      {open && (
        <div className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:end-5 sm:w-[420px] sm:h-[660px] sm:max-h-[88vh] bg-white sm:rounded-3xl shadow-2xl border border-[#f0e4e2] flex flex-col overflow-hidden">
          {/* En-tête */}
          <div className="text-white px-4 py-3 flex items-center gap-2 bg-gradient-to-br from-[#281715] to-[#4a2a26]">
            <span className="w-10 h-10 rounded-full bg-[#ff6f61] flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0" dir="rtl">
              <div className="text-sm font-black">وكيل الوسيط 777</div>
              <div className="text-[11px] text-white/75">مساعد الزبائن</div>
            </div>
            <button onClick={toggleManager} className="p-2 rounded-xl hover:bg-white/10 cursor-pointer" title="وضع المدير">
              <Lock className="w-4 h-4" />
            </button>
            <button onClick={() => setVoice({ ...voice, speak: !voice.speak })} className="p-2 rounded-xl hover:bg-white/10 cursor-pointer" title="الرد بالصوت">
              {voice.speak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setMessages([]);
                setContents([]);
              }}
              className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"
              title="مسح المحادثة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white/10 cursor-pointer" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {installable && !isStandalone() && (
            <button
              onClick={async () => setInstallable(!(await promptInstall()))}
              className="mx-3 mt-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#fff0ed] text-[#ff6f61] text-xs font-extrabold cursor-pointer"
            >
              <Download className="w-4 h-4" /> ثبّت التطبيق على هذا الهاتف
            </button>
          )}

          {/* Déverrouillage du mode gérant */}
          {showUnlock && (
            <div className="p-3 border-b border-[#f0e4e2] bg-[#fff8f7]" dir="rtl">
              {access.usesFirebase ? (
                <LoginCard title="دخول المدير" />
              ) : (
                <form onSubmit={submitPin} className="space-y-2">
                  <div className="text-xs font-bold">
                    {access.needsSetup ? 'اختر رمزاً سرياً (4 أرقام على الأقل) لوضع المدير على هذا الجهاز:' : 'أدخل الرمز السري لوضع المدير:'}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      autoFocus
                      value={pin}
                      onChange={(e) => { setPin(e.target.value); setPinError(false); }}
                      className="flex-1 p-2 rounded-xl border border-[#f0e4e2] text-sm text-center tracking-widest"
                      dir="ltr"
                    />
                    <button type="submit" className="px-4 rounded-xl bg-[#281715] text-white text-xs font-bold cursor-pointer">دخول</button>
                    <button type="button" onClick={() => setShowUnlock(false)} className="px-3 rounded-xl border border-[#f0e4e2] text-xs cursor-pointer">إلغاء</button>
                  </div>
                  {pinError && <div className="text-[11px] text-red-600 font-bold">الرمز غير صحيح</div>}
                </form>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fff8f7]">
            {messages.length === 0 && (
              <div className="text-center space-y-3 pt-6" dir="rtl">
                <div className="text-sm font-extrabold">مرحباً بك في الوسيط 777 👋</div>
                <p className="text-xs text-[#7a5c58]">
                  أساعدك تلقى العقار المناسب وتطلب زيارة. اكتب أو اضغط على الميكروفون.
                </p>
                <div className="flex flex-col gap-2 items-center">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full bg-white border border-[#f0e4e2] text-xs font-bold text-[#5a4340] hover:text-[#ff6f61] cursor-pointer max-w-full truncate">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  dir="auto"
                  className={`max-w-[88%] whitespace-pre-wrap px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-[#ff6f61] text-white rounded-ee-md' : 'bg-white border border-[#f0e4e2] text-[#281715] rounded-es-md'
                  }`}
                >
                  {m.tools && m.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5" dir="rtl">
                      {m.tools.map((tool) => (
                        <span key={tool} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#f3ece9] text-[10px] font-bold text-[#7a5c58]">
                          <Wrench className="w-2.5 h-2.5" /> {TOOL_LABELS[tool] || tool}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.text}
                  {m.effects?.map((e, i) =>
                    e.type === 'link' ? (
                      e.kind === 'ads' ? (
                        <button key={i} onClick={() => goTo('ads')} className="mt-2 w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-[#fff0ed] text-[#ff6f61] text-xs font-extrabold cursor-pointer">
                          <ExternalLink className="w-3.5 h-3.5" /> {e.label}
                        </button>
                      ) : (
                        <a key={i} href={e.url} target="_blank" rel="noopener noreferrer" className={`mt-2 w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-extrabold ${e.kind === 'whatsapp' ? 'bg-[#25d366] text-white' : 'bg-[#fff0ed] text-[#ff6f61]'}`}>
                          <MessageCircle className="w-3.5 h-3.5" /> {e.label}
                        </a>
                      )
                    ) : null
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl bg-white border border-[#f0e4e2] flex items-center gap-2 text-xs text-[#7a5c58]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#ff6f61]" /> كيخدم…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Saisie */}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="p-3 border-t border-[#f0e4e2] flex items-end gap-2 bg-white">
            {SpeechRecognitionImpl && (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#fff0ed] text-[#ff6f61]'}`}
                  title="تكلّم"
                >
                  {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setVoice({ ...voice, lang: voice.lang === 'ar-MA' ? 'fr-FR' : 'ar-MA' })}
                  className="text-[10px] font-black text-[#99807d] cursor-pointer"
                  title="لغة الميكروفون"
                >
                  {voice.lang === 'ar-MA' ? 'عربي' : 'FR'}
                </button>
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              dir="auto"
              placeholder="اكتب رسالتك…"
              className="flex-1 resize-none max-h-28 p-3 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6f61]"
            />
            <button type="submit" disabled={!input.trim() || busy} className="w-11 h-11 rounded-full bg-[#ff6f61] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer">
              <Send className="w-5 h-5 rtl:rotate-180" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
