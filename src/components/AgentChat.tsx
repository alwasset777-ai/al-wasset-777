import React, { useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Send, X, Volume2, VolumeX, Trash2, Loader2, Megaphone, Download } from 'lucide-react';
import { Language, Property } from '../types';
import { askAgent, AgentAction, ChatMessage } from '../services/agentChat';
import { generateDrafts, getDrafts } from '../services/adsStore';
import { loadJSON, saveJSON } from '../services/storage';
import { canInstallApp, onInstallAvailable, promptInstall, isStandalone } from '../services/pwa';

interface AgentChatProps {
  properties: Property[];
  language: Language;
  onNavigate: (tab: string) => void;
}

type VoiceLang = 'ar-MA' | 'fr-FR';

const HISTORY_KEY = 'alwassit777.agent.chat.v1';
const VOICE_KEY = 'alwassit777.agent.voice.v1';

const newMsg = (role: ChatMessage['role'], text: string): ChatMessage => ({
  id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  role,
  text,
  at: new Date().toISOString(),
});

const SpeechRecognitionImpl: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

// Bulle « وكيل الوسيط 777 » : discussion écrite ou vocale avec l'agent, sur toutes les pages.
export const AgentChat: React.FC<AgentChatProps> = ({ properties, language, onNavigate }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const t = (fr: string, ar: string, en: string) => (isAr ? ar : isEn ? en : fr);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadJSON<ChatMessage[]>(HISTORY_KEY, []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(() => loadJSON(VOICE_KEY, { speak: false, lang: 'ar-MA' as VoiceLang }));
  const [installable, setInstallable] = useState(canInstallApp());
  const recogRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveJSON(HISTORY_KEY, messages.slice(-60)), [messages]);
  useEffect(() => saveJSON(VOICE_KEY, voice), [voice]);
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, open, busy]);

  const speak = (text: string) => {
    if (!voice.speak || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#•📊✍️🗂️✅👇📞📍🏡💰📐]/gu, ''));
    u.lang = /[؀-ۿ]/.test(text) ? 'ar-MA' : 'fr-FR';
    speechSynthesis.speak(u);
  };

  const runAction = async (action: AgentAction, userText: string): Promise<string | null> => {
    if (action.type === 'open') {
      onNavigate(action.tab);
      setOpen(window.innerWidth >= 640); // sur téléphone, on ferme pour voir la page
      return null;
    }
    const p = properties.find((x) => x.id === action.propertyId);
    if (!p) return null;
    const created = await generateDrafts(p, action.platforms || [], action.languages || []);
    // Même langue que le message de l'utilisateur.
    return /[\u0600-\u06FF]/.test(userText)
      ? `✅ ${created.length} إعلان جاهز للمراجعة في قسم «الإعلانات».`
      : `✅ ${created.length} annonces prêtes à valider dans « Publicités ».`;
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    const userMsg = newMsg('user', clean);
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const res = await askAgent(history.slice(-20), properties, getDrafts());
      setMessages((prev) => [...prev, newMsg('assistant', res.reply)]);
      speak(res.reply);
      if (res.action) {
        const followUp = await runAction(res.action, clean);
        if (followUp) setMessages((prev) => [...prev, newMsg('assistant', followUp)]);
      }
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

  const suggestions = [
    t('Annonce pour le bien 1', 'دير إعلان للعقار رقم 1', 'Ad for property 1'),
    t('Combien de clients cette semaine ?', 'شحال من كليان عندي؟', 'How many leads?'),
    t('Ouvre le registre', 'حل ليا سجل العقارات', 'Open the registry'),
  ];

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
        <div className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:end-5 sm:w-[400px] sm:h-[620px] sm:max-h-[85vh] bg-white sm:rounded-3xl shadow-2xl border border-[#f0e4e2] flex flex-col overflow-hidden">
          {/* En-tête */}
          <div className="bg-gradient-to-br from-[#281715] to-[#4a2a26] text-white px-4 py-3 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[#ff6f61] flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0" dir="rtl">
              <div className="text-sm font-black">وكيل الوسيط 777</div>
              <div className="text-[11px] text-white/70">{t('Votre assistant publicité', 'مساعدك في الإعلانات', 'Your ads assistant')}</div>
            </div>
            <button onClick={() => setVoice({ ...voice, speak: !voice.speak })} className="p-2 rounded-xl hover:bg-white/10 cursor-pointer" title={t('Réponse vocale', 'الرد بالصوت', 'Voice reply')}>
              {voice.speak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => setMessages([])} className="p-2 rounded-xl hover:bg-white/10 cursor-pointer" title={t('Effacer', 'مسح المحادثة', 'Clear')}>
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
              <Download className="w-4 h-4" /> {t('Installer l’application sur ce téléphone', 'ثبّت التطبيق على هذا الهاتف', 'Install the app on this phone')}
            </button>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fff8f7]">
            {messages.length === 0 && (
              <div className="text-center space-y-3 pt-6" dir="rtl">
                <div className="text-sm font-extrabold">السلام عليكم السي منير 👋</div>
                <p className="text-xs text-[#7a5c58]">{t('Écrivez ou appuyez sur le micro pour parler.', 'اكتب أو اضغط على الميكروفون وتكلّم.', 'Type or tap the mic to speak.')}</p>
                <div className="flex flex-col gap-2 items-center">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full bg-white border border-[#f0e4e2] text-xs font-bold text-[#5a4340] hover:text-[#ff6f61] cursor-pointer">
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
                  className={`max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-[#ff6f61] text-white rounded-ee-md' : 'bg-white border border-[#f0e4e2] text-[#281715] rounded-es-md'
                  }`}
                >
                  {m.text}
                  {m.role === 'assistant' && m.text.startsWith('✅') && (
                    <button onClick={() => { onNavigate('ads'); if (window.innerWidth < 640) setOpen(false); }} className="block mt-2 text-xs font-extrabold text-[#ff6f61] cursor-pointer">
                      {t('Ouvrir « Publicités » →', 'افتح «الإعلانات» ←', 'Open “Ads” →')}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl bg-white border border-[#f0e4e2]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#ff6f61]" />
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
                  title={t('Parler', 'تكلّم', 'Speak')}
                >
                  {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setVoice({ ...voice, lang: voice.lang === 'ar-MA' ? 'fr-FR' : 'ar-MA' })}
                  className="text-[10px] font-black text-[#99807d] cursor-pointer"
                  title={t('Langue du micro', 'لغة الميكروفون', 'Mic language')}
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
              placeholder={t('Écrivez votre message…', 'اكتب رسالتك…', 'Type your message…')}
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
