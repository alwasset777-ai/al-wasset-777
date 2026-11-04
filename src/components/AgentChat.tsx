import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, X, Volume2, VolumeX, Trash2, Loader2, Download, Lock, Unlock, MessageCircle, ExternalLink, Wrench, Brain, Paperclip, Trophy } from 'lucide-react';
import { Language, Property } from '../types';
import { ChatMessage, GeminiContent, runAgentTurn } from '../services/agentChat';
import { AgentEffect } from '../agent/executor';
import { AgentMode } from '../agent/toolDefs';
import { loadJSON, saveJSON } from '../services/storage';
import { canInstallApp, onInstallAvailable, promptInstall, isStandalone } from '../services/pwa';
import { useManagerAccess } from '../services/managerAccess';
import { LoginCard } from './AuthGate';
import { MuneerAvatar } from './MuneerAvatar';
import { MuneerPanel } from './MuneerPanel';
import { getAvatar, onMemoryChange } from '../services/muneerMemory';
import { readDocument, toRegistryFields, ReadDocumentResult, DOC_TYPE_LABELS } from '../services/documentReader';
import { registryStore, RegistryFields } from '../services/registryStore';
import { DocumentReviewCard } from './DocumentReviewCard';
import { AchievementsPanel } from './AchievementsPanel';
import { logAchievement } from '../services/agentLog';
import { agencyProfile } from '../data/agencyProfile';

const AGENT_NAME = agencyProfile.agentNameAr;

interface AgentChatProps {
  properties: Property[];
  language: Language;
  onNavigate: (tab: string) => void;
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
  remember: 'تعلّم',
  forget: 'نسى',
  list_memory: 'شنو تعلم',
  growth_summary: 'لوحة النمو',
  list_agency_prospects: 'الوكالات',
  save_agency_prospect: 'تحديث وكالة',
  add_revenue: 'تسجيل مدخول',
  log_growth_signal: 'إشارات المشروع',
  growth_script: 'نص جاهز',
};

const newMsg = (role: ChatMessage['role'], text: string, extra: Partial<UiMessage> = {}): UiMessage => ({
  id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  role,
  text,
  at: new Date().toISOString(),
  ...extra,
});

// Affiche le **gras** des réponses de l'IA sans montrer les étoiles.
const richText = (text: string) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

const SpeechRecognitionImpl: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

// Bulle « وكيل الوسيط 777 » : assistant des clients du site, et assistant personnel du gérant (mode gérant).
export const AgentChat: React.FC<AgentChatProps> = ({ properties, language, onNavigate }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const t = (fr: string, ar: string, en: string) => (isAr ? ar : isEn ? en : fr);

  const access = useManagerAccess();
  const [wantManager, setWantManager] = useState<boolean>(() => loadJSON(MODE_KEY, false));
  const mode: AgentMode = wantManager && access.isManager ? 'manager' : 'customer';

  // Lien direct vers منير (raccourci de l'application installée) : /?muneer=1
  const fromShortcut = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('muneer') || window.location.pathname.startsWith('/monymounir'));
  const [open, setOpen] = useState(fromShortcut);
  const [speaking, setSpeaking] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showWins, setShowWins] = useState(false);
  const [photo, setPhoto] = useState<string | null>(getAvatar());
  const [unlockNote, setUnlockNote] = useState('');
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
  const [docReview, setDocReview] = useState<{ file: File; read: ReadDocumentResult; fields: RegistryFields } | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);
  useEffect(() => onMemoryChange(() => setPhoto(getAvatar())), []);
  useEffect(() => {
    if (!fromShortcut) return;
    if (access.isManager) setWantManager(true);
    else setShowUnlock(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Accolades : dans Chrome récent, scrollIntoView renvoie une promesse (React la prendrait pour un nettoyage).
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, busy]);

  const isPhone = () => window.innerWidth < 640;

  const speak = (text: string) => {
    if (!voice.speak || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#•📊✍️🗂️✅👇📞📍🏡💰📐]/gu, ''));
    u.lang = /[؀-ۿ]/.test(text) ? 'ar-MA' : 'fr-FR';
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
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

  // منير lit un document (CIN, شهادة الملكية, contrat) et propose une fiche du registre à vérifier.
  const onPickDocument = async (file?: File) => {
    if (!file || busy) return;
    setMessages((prev) => [...prev, newMsg('user', `📄 ${file.name}`)]);
    setBusy(true);
    try {
      const read = await readDocument(file);
      setDocReview({ file, read, fields: toRegistryFields(read) });
      const reply = `قريت ${DOC_TYPE_LABELS[read.docType] || 'الوثيقة'} 👇 راجع المعلومات قبل ما نسجلها.`;
      setMessages((prev) => [...prev, newMsg('assistant', reply)]);
      speak(reply);
    } catch (err) {
      setMessages((prev) => [...prev, newMsg('assistant', `⚠️ ${(err as Error).message}`)]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveDocument = async (fields: RegistryFields) => {
    if (!docReview) return;
    setSavingDoc(true);
    try {
      await registryStore.add(fields, { photos: [], videos: [], documents: [docReview.file] });
      logAchievement('read_document', fields.owner);
      setDocReview(null);
      setMessages((prev) => [...prev, newMsg('assistant', `✅ تسجلات الفيشة ديال **${fields.owner}** فـ«سجل العقارات» مع الوثيقة.`)]);
    } catch (err) {
      setMessages((prev) => [...prev, newMsg('assistant', `⚠️ ما تسجلاتش: ${(err as Error).message}`)]);
    } finally {
      setSavingDoc(false);
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
    // 1) Mot de passe du serveur (MANAGER_KEY sur Vercel) : donne l'IA de منير.
    const status = await access.unlockWithKey(pin);
    if (status === 'wrong') return setPinError(true);
    if (status !== 'ok') {
      // 2) Sans MANAGER_KEY : code local à l'appareil (les outils marchent, l'IA reste en mode simple).
      if (access.needsSetup) await access.setupPin(pin);
      else if (!(await access.unlock(pin))) return setPinError(true);
      setUnlockNote(status === 'not-configured' ? 'دخلتي بالرمز ديال هاد الجهاز. باش يخدم الذكاء ديال منير، زيد MANAGER_KEY ف Vercel.' : '');
    } else setUnlockNote('');
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

  const suggestions =
    mode === 'manager'
      ? ['تعلّم: كي نقول ليك «تقرير»، عطيني المواعيد ديال اليوم والزبناء الجداد', 'شنو عندي من مواعيد هاد السيمانة؟', 'قلب ليا على فرص للزبناء ديالي', 'زيد زبون جديد: كريم، 0661000000، كيقلب على شقة ف حمرية ب 900000', 'وجد إعلانات للعقار رقم 3', 'كتب رسالة واتساب لمحمد التازي نقترح عليه شقة المعاريف']
      : [
          t('Je cherche un appartement à Meknès', 'كنقلب على شقة ف مكناس', 'Looking for an apartment in Meknes'),
          t('Villas avec piscine à vendre ?', 'واش عندكم فيلا فيها مسبح للبيع؟', 'Villas with a pool for sale?'),
          t('Je veux visiter un bien', 'بغيت نزور شي عقار', 'I want to visit a property'),
        ];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 end-5 z-50 flex items-center gap-2 ps-3 pe-4 py-3 rounded-full bg-[#281715] text-white shadow-2xl shadow-[#281715]/30 hover:scale-105 transition-transform cursor-pointer"
          aria-label={mode === 'manager' ? AGENT_NAME : 'وكيل الوسيط 777'}
        >
          <MuneerAvatar photo={mode === 'manager' ? photo : null} size={32} />
          <span className="text-sm font-extrabold">{mode === 'manager' ? AGENT_NAME : t('Parler à l’agent', 'كلّم الوكيل', 'Talk to agent')}</span>
        </button>
      )}

      {open && (
        <div className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:end-5 sm:w-[420px] sm:h-[660px] sm:max-h-[88vh] bg-white sm:rounded-3xl shadow-2xl border border-[#f0e4e2] flex flex-col overflow-hidden">
          {/* En-tête */}
          <div className={`text-white px-4 py-3 flex items-center gap-2 ${mode === 'manager' ? 'bg-gradient-to-br from-[#1f3a2e] to-[#281715]' : 'bg-gradient-to-br from-[#281715] to-[#4a2a26]'}`}>
            <MuneerAvatar photo={mode === 'manager' ? photo : null} speaking={speaking} listening={listening} size={44} />
            <div className="flex-1 min-w-0" dir="rtl">
              <div className="text-sm font-black"><bdi>{mode === 'manager' ? AGENT_NAME : 'وكيل الوسيط 777'}</bdi></div>
              <div className="text-[11px] text-white/75">
                {mode === 'manager' ? (speaking ? 'كيهضر…' : listening ? 'كيسمع ليك…' : 'وكيلك الشخصي · كيتعلم معاك') : 'مساعد الزبائن · مكتب الوسيط 777'}
              </div>
            </div>
            {mode === 'manager' && (
              <>
                <button onClick={() => { setShowWins(!showWins); setShowMemory(false); }} className={`p-2 rounded-xl hover:bg-white/10 cursor-pointer ${showWins ? 'bg-white/15' : ''}`} title="إنجازاتي" aria-label="إنجازاتي">
                  <Trophy className="w-4 h-4" />
                </button>
                <button onClick={() => { setShowMemory(!showMemory); setShowWins(false); }} className={`p-2 rounded-xl hover:bg-white/10 cursor-pointer ${showMemory ? 'bg-white/15' : ''}`} title={`شنو تعلم ${AGENT_NAME}`}>
                  <Brain className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={toggleManager} className={`p-2 rounded-xl hover:bg-white/10 cursor-pointer ${mode === 'manager' ? 'text-green-300' : ''}`} title={mode === 'manager' ? 'الخروج من وضع المدير' : 'وضع المدير'}>
              {mode === 'manager' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
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

          {mode === 'manager' && showMemory && <MuneerPanel />}
          {mode === 'manager' && showWins && <AchievementsPanel onAsk={(q) => { setShowWins(false); send(q); }} />}
          {mode === 'manager' && unlockNote && (
            <div className="mx-3 mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900" dir="rtl">{unlockNote}</div>
          )}

          {/* Déverrouillage du mode gérant */}
          {showUnlock && (
            <div className="p-3 border-b border-[#f0e4e2] bg-[#fff8f7]" dir="rtl">
              {access.usesFirebase ? (
                <LoginCard title="دخول المدير" />
              ) : (
                <form onSubmit={submitPin} className="space-y-2">
                  <div className="text-xs font-bold">
                    {access.needsSetup ? 'دخل كلمة السر ديال المدير (اللي حطيتي ف Vercel باسم MANAGER_KEY)، ولا اختار رمز لهاد الجهاز (4 أرقام على الأقل):' : 'دخل كلمة السر ديال المدير:'}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
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
                {mode === 'manager' && (
                  <div className="flex justify-center"><MuneerAvatar photo={photo} speaking={speaking} size={72} /></div>
                )}
                <div className="text-sm font-extrabold">{mode === 'manager' ? `السلام عليكم السي منير 👋 أنا ${AGENT_NAME}، رهن إشارتك` : 'مرحباً بك في الوسيط 777 👋'}</div>
                <p className="text-xs text-[#7a5c58]">
                  {mode === 'manager'
                    ? 'كنسيّر الزبناء والمواعيد، كنوجد الإعلانات، كنقلب على الفرص، وكنكتب ميساجات واتساب. 📎 صيفط ليا البطاقة ولا شهادة الملكية ولا العقد ونعمّر ليك الفيشة. وكلما علّمتيني شي حاجة كنعقل عليها 🧠'
                    : 'أساعدك تلقى العقار المناسب وتطلب زيارة. اكتب أو اضغط على الميكروفون.'}
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
                  {richText(m.text)}
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
            {docReview && mode === 'manager' && (
              <DocumentReviewCard
                fileName={docReview.file.name}
                read={docReview.read}
                initial={docReview.fields}
                saving={savingDoc}
                onSave={saveDocument}
                onCancel={() => {
                  setDocReview(null);
                  setMessages((prev) => [...prev, newMsg('assistant', 'واخا، ما سجلت والو.')]);
                }}
              />
            )}
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
            {mode === 'manager' && (
              <>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onPickDocument(e.target.files?.[0])} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-[#fff0ed] text-[#ff6f61] disabled:opacity-40 cursor-pointer"
                  title="قرا وثيقة (البطاقة، شهادة الملكية، عقد)"
                  aria-label="قرا وثيقة"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </>
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
