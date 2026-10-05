import React, { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Send, Paperclip, X, Phone, PhoneOff, Volume2, VolumeX, Trash2, Loader2, FileText, Check, Ban, ExternalLink, Image as ImageIcon,
} from 'lucide-react';
import type { Property } from '../../types';
import type { ActionRecord, AgentAction, AgentChatResponse, AgentMessage } from '../../agent/types';
import { chatStore, settingsStore, useStore } from '../../agent/stores';
import { healthLive } from '../../agent/live';
import { ApiError, chatWithAgent } from '../../agent/api';
import { actionMode, buildContext, describeAction, executeAction, validateAction } from '../../agent/engine';
import { MAX_TOTAL_BASE64, blobToBase64, prepareAttachment, type Attachment } from '../../agent/media';
import { BrowserRecognition, Microphone, isSpeaking, micSupported, onSpeakingChange, recognizeOnce, speak, stopSpeaking } from '../../agent/voice';
import { localAgent } from '../../services/agentChat';
import { getDrafts } from '../../services/adsStore';
import { AgentAvatar, type AvatarState } from './Avatar';
import { DraftDocumentModal } from './DraftDocumentModal';

interface Props {
  properties: Property[];
  onNavigate: (tab: string) => void;
  variant: 'page' | 'panel';
  onClose?: () => void;
  headerExtra?: React.ReactNode; // bouton en plus dans l'en-tête (ex. quitter le mode gérant)
}

const newId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PROPERTY_TYPES = ['شقة', 'فيلا', 'منزل', 'أرض', 'محل تجاري', 'مكتب', 'عمارة', 'رياض', 'ضيعة'];

const SUGGESTIONS = [
  'شنو عندي اليوم؟',
  'زيد موعد غدا مع 10 ديال الصباح: زيارة شقة فحمرية',
  'قلب ليا على شقق للبيع فمكناس',
  'كتب ليا مسودة عقد كراء',
  'دير إعلان للعقار رقم 1',
];

// Conversation avec le personnage : texte, micro, appel mains libres, fichiers, et cartes d'accord.
export const AgentConversation: React.FC<Props> = ({ properties, onNavigate, variant, onClose, headerExtra }) => {
  const settings = useStore(settingsStore);
  const messages = useStore(chatStore);
  const health = useStore(healthLive);

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [speakingNow, setSpeakingNow] = useState(isSpeaking());
  const [listening, setListening] = useState<false | 'push' | 'call'>(false);
  const [inCall, setInCall] = useState(false);
  const [level, setLevel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<{ title: string; text: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, AgentAction>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const busyRef = useRef(false);
  const pendingRef = useRef<Attachment[]>([]);
  const callRef = useRef(false);
  const micRef = useRef<Microphone | null>(null);
  const browserRecRef = useRef<{ stop: () => void } | null>(null);
  const filesRef = useRef(new Map<string, { blobs: Blob[]; names: string[] }>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  pendingRef.current = pending;
  useEffect(() => onSpeakingChange(setSpeakingNow), []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages.length, busy]);
  useEffect(
    () => () => {
      callRef.current = false;
      micRef.current?.cancel();
      micRef.current?.close();
      browserRecRef.current?.stop();
      stopSpeaking();
    },
    []
  );

  const avatarState: AvatarState = listening ? 'listening' : busy ? 'thinking' : speakingNow ? 'speaking' : 'idle';
  const useBrowserMic = () => settingsStore.get().voice.micMode === 'browser' || healthLive.get()?.ai === false;

  // ---------- Messages ----------

  // 60 messages au plus : un document Firestore est limité à 1 Mo.
  const append = (list: AgentMessage[]) => chatStore.set((prev) => [...prev, ...list].slice(-60)).catch(() => undefined);
  const patchMessage = (id: string, fn: (m: AgentMessage) => AgentMessage) =>
    chatStore.set((prev) => prev.map((m) => (m.id === id ? fn(m) : m))).catch(() => undefined);
  const patchRecord = (msgId: string, recId: string, patch: Partial<ActionRecord>) =>
    patchMessage(msgId, (m) => ({ ...m, actions: m.actions?.map((r) => (r.id === recId ? { ...r, ...patch } : r)) }));

  const speakText = (text: string) => {
    const s = settingsStore.get();
    return s.voice.autoSpeak || callRef.current ? speak(text, s.voice) : Promise.resolve();
  };

  // Exécute une action ; renvoie le texte d'un éventuel message supplémentaire (rapport, recherche).
  const runRecord = async (msgId: string, rec: ActionRecord, action: AgentAction): Promise<string | null> => {
    setRunning((r) => ({ ...r, [rec.id]: true }));
    try {
      const files = filesRef.current.get(msgId);
      const r = await executeAction(action, { properties, onNavigate, files: files?.blobs, fileNames: files?.names });
      await patchRecord(msgId, rec.id, { status: 'done', result: r.text || describeAction(action), action });
      if (r.extra) {
        await append([{ id: newId('a'), role: 'assistant', at: new Date().toISOString(), text: '', ...r.extra }]);
        return r.extra.text || null;
      }
      return null;
    } catch (err) {
      await patchRecord(msgId, rec.id, { status: 'failed', result: `⚠️ ${(err as Error).message || 'وقع مشكل'}` });
      return null;
    } finally {
      setRunning((r) => ({ ...r, [rec.id]: false }));
    }
  };

  // Sans IA : compréhension simple par mots-clés (ancien assistant).
  const localFallback = (text: string): AgentChatResponse => {
    const r = localAgent(text, properties, getDrafts());
    return { reply: r.reply, actions: r.action ? [r.action as AgentAction] : [] };
  };

  const send = async (opts: { text?: string; audio?: Blob }) => {
    const text = (opts.text ?? '').trim();
    const atts = pendingRef.current;
    if ((!text && !opts.audio && atts.length === 0) || busyRef.current) return;
    stopSpeaking();
    busyRef.current = true;
    setBusy(true);
    setInput('');
    setPending([]);
    setNotice(null);
    const userMsg: AgentMessage = {
      id: newId('u'),
      role: 'user',
      text: text || (opts.audio ? '🎤 …' : '📎'),
      at: new Date().toISOString(),
      attachments: atts.length ? atts.map((a) => ({ name: a.name, type: a.mimeType })) : undefined,
      voice: opts.audio ? true : undefined,
    };
    // L'agent voit aussi le résultat de ses actions précédentes (fait, refusé, erreur).
    const history = [...chatStore.get(), userMsg].slice(-20).map((m) => ({
      role: m.role,
      text: m.actions?.length ? `${m.text}\n[${m.actions.map((r) => `${r.status}: ${r.result || describeAction(r.action)}`).join(' | ')}]` : m.text,
    }));
    append([userMsg]); // l'écriture en ligne se fait en arrière-plan

    let spoken: Promise<void> = Promise.resolve();
    const extras: string[] = [];
    try {
      const s = settingsStore.get();
      let res: AgentChatResponse;
      try {
        res = await chatWithAgent({
          messages: history,
          context: buildContext(properties),
          persona: { name: s.name, gender: s.gender, personality: s.personality, extraInstructions: s.extraInstructions },
          files: atts.map(({ name, mimeType, data }) => ({ name, mimeType, data })),
          audio: opts.audio ? { mimeType: 'audio/wav', data: await blobToBase64(opts.audio) } : undefined,
        });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        if (opts.audio || atts.length || status === 401) throw err;
        res = localFallback(text);
      }
      if (res.transcript) patchMessage(userMsg.id, (m) => ({ ...m, text: res.transcript! }));
      const records: ActionRecord[] = res.actions
        .map((a) => validateAction(a, properties))
        .filter((a): a is AgentAction => a !== null)
        .map((a) => ({ id: newId('act'), action: a, status: 'pending' }));
      const botMsg: AgentMessage = {
        id: newId('a'),
        role: 'assistant',
        text: res.reply || (records.length ? '👌' : '…'),
        at: new Date().toISOString(),
        actions: records.length ? records : undefined,
      };
      if (atts.length) filesRef.current.set(botMsg.id, { blobs: atts.map((a) => a.blob), names: atts.map((a) => a.name) });
      append([botMsg]);
      spoken = speakText(botMsg.text);
      for (const rec of records) {
        if (actionMode(rec.action, settingsStore.get()) !== 'auto') continue;
        const extra = await runRecord(botMsg.id, rec, rec.action);
        if (extra) extras.push(extra);
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const text =
        status === 401
          ? '🔒 خاصك تدخل بحسابك (قسم «الوكيل») باش نقدر نخدم.'
          : status === 503
          ? '⚙️ الذكاء الاصطناعي ما مفعّلش بعد (مفتاح Gemini)، الصوت والملفات خاصهم الذكاء الاصطناعي.'
          : '📡 ما قدرتش نوصل للخادم، عاود من بعد شوية.';
      append([{ id: newId('a'), role: 'assistant', text, at: new Date().toISOString() }]);
      spoken = speakText(text);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    await spoken;
    for (const e of extras) if (callRef.current || settingsStore.get().voice.autoSpeak) await speakText(e.slice(0, 700));
  };

  // ---------- Fichiers ----------

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const added: Attachment[] = [];
    let total = pendingRef.current.reduce((n, a) => n + a.data.length, 0);
    for (const f of Array.from(list).slice(0, 6)) {
      try {
        const att = await prepareAttachment(f);
        if (total + att.data.length > MAX_TOTAL_BASE64) {
          setNotice('الملفات كبيرة بزاف مع بعض: صيفطهم واحد بواحد.');
          break;
        }
        total += att.data.length;
        added.push(att);
      } catch (err) {
        setNotice((err as Error).message === 'too_big' ? `الملف «${f.name}» كبير بزاف (أكثر من 3 ميغا).` : `نوع الملف «${f.name}» غير مدعوم (صور أو PDF).`);
      }
    }
    setPending((p) => [...p, ...added].slice(0, 6));
  };

  // ---------- Micro ----------

  const micError = () => setNotice('🎙️ ما قدرتش نحل الميكروفون. سمح للتطبيق يستعمل الميكروفون من إعدادات المتصفح.');

  const toggleMic = async () => {
    if (inCall) return;
    if (listening === 'push') {
      micRef.current?.finish();
      browserRecRef.current?.stop();
      return;
    }
    stopSpeaking();
    if (useBrowserMic()) {
      if (!BrowserRecognition) return setNotice('🎙️ التعرف على الصوت غير متوفر فهاد المتصفح. جرّب Chrome.');
      setListening('push');
      const rec = recognizeOnce('ar-MA', setInput);
      browserRecRef.current = rec;
      const text = await rec.promise;
      browserRecRef.current = null;
      setListening(false);
      if (text) await send({ text });
      return;
    }
    if (!micSupported()) return micError();
    try {
      const mic = new Microphone();
      micRef.current = mic;
      setListening('push');
      const blob = await mic.listen({ mode: 'push', onLevel: setLevel });
      mic.close();
      micRef.current = null;
      setListening(false);
      if (blob) await send({ audio: blob });
    } catch {
      setListening(false);
      micRef.current = null;
      micError();
    }
  };

  const endCall = () => {
    callRef.current = false;
    setInCall(false);
    setListening(false);
    micRef.current?.cancel();
    micRef.current?.close();
    micRef.current = null;
    browserRecRef.current?.stop();
    browserRecRef.current = null;
    stopSpeaking();
  };

  // Appel mains libres : écoute → réponse à voix haute → écoute de nouveau, jusqu'à raccrocher.
  const startCall = async () => {
    if (callRef.current) return;
    stopSpeaking();
    const browser = useBrowserMic();
    if (browser && !BrowserRecognition) return setNotice('🎙️ التعرف على الصوت غير متوفر فهاد المتصفح. جرّب Chrome.');
    callRef.current = true;
    setInCall(true);
    try {
      if (!browser) {
        micRef.current = new Microphone();
        await micRef.current.open();
      }
      await speak(`السلام عليكم السي منير، أنا ${settingsStore.get().name}. تفضل، كنسمع ليك.`, settingsStore.get().voice);
      while (callRef.current) {
        setListening('call');
        let text = '';
        let blob: Blob | null = null;
        if (browser) {
          const rec = recognizeOnce('ar-MA', setInput);
          browserRecRef.current = rec;
          text = await rec.promise;
          browserRecRef.current = null;
        } else {
          blob = await micRef.current!.listen({ mode: 'auto', onLevel: setLevel });
        }
        setListening(false);
        if (!callRef.current) break;
        if (!text && !blob) {
          await sleep(300);
          continue;
        }
        await send(text ? { text } : { audio: blob! });
      }
    } catch {
      micError();
    } finally {
      endCall();
    }
  };

  // ---------- Cartes d'accord ----------

  const approve = async (msg: AgentMessage, rec: ActionRecord) => {
    const action = validateAction(edits[rec.id] || rec.action, properties);
    if (!action) return patchRecord(msg.id, rec.id, { status: 'failed', result: '⚠️ المعلومات ما بقاتش صالحة.' });
    const extra = await runRecord(msg.id, rec, action);
    if (extra && settingsStore.get().voice.autoSpeak) speakText(extra.slice(0, 700));
  };

  const reject = (msg: AgentMessage, rec: ActionRecord) => patchRecord(msg.id, rec.id, { status: 'rejected', result: describeAction(rec.action) });

  const editOf = <T extends AgentAction>(rec: ActionRecord) => (edits[rec.id] || rec.action) as T;
  const setEdit = (rec: ActionRecord, a: AgentAction) => setEdits((e) => ({ ...e, [rec.id]: a }));

  const field = 'w-full p-2 rounded-lg bg-white border border-[#f0e4e2] text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6f61]';

  const renderEditor = (msg: AgentMessage, rec: ActionRecord) => {
    if (rec.action.type === 'whatsapp_reply') {
      const a = editOf<Extract<AgentAction, { type: 'whatsapp_reply' }>>(rec);
      return (
        <textarea value={a.text} onChange={(e) => setEdit(rec, { ...a, text: e.target.value })} rows={4} dir="auto" className={field} />
      );
    }
    if (rec.action.type === 'add_registry') {
      const a = editOf<Extract<AgentAction, { type: 'add_registry' }>>(rec);
      const set = (k: keyof typeof a.entry, v: string) => setEdit(rec, { ...a, entry: { ...a.entry, [k]: v } });
      const hasFiles = filesRef.current.has(msg.id);
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <select value={a.entry.propertyType || 'شقة'} onChange={(e) => set('propertyType', e.target.value)} className={field}>
            {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {([['owner', 'المالك'], ['ownerPhone', 'الهاتف'], ['surface', 'المساحة'], ['location', 'الموقع'], ['price', 'الثمن']] as const).map(([k, label]) => (
            <input key={k} value={a.entry[k] || ''} onChange={(e) => set(k, e.target.value)} placeholder={label} dir="auto" className={field} />
          ))}
          <textarea value={a.entry.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="ملاحظات" rows={2} dir="auto" className={`${field} col-span-2`} />
          {hasFiles && (
            <label className="col-span-2 flex items-center gap-2 text-[11px] font-bold text-[#5a4340]">
              <input type="checkbox" checked={a.attachDocuments !== false} onChange={(e) => setEdit(rec, { ...a, attachDocuments: e.target.checked })} />
              زيد الملفات اللي صيفطتي مع البطاقة
            </label>
          )}
        </div>
      );
    }
    return null;
  };

  // Fonction (et non composant) : les champs modifiables gardent le focus pendant la saisie.
  const renderActionCard = (msg: AgentMessage, rec: ActionRecord) => {
    const isRunning = running[rec.id];
    if (rec.status === 'done') return <div className="mt-2 text-xs font-bold text-green-700">{rec.result || `✅ ${describeAction(rec.action)}`}</div>;
    if (rec.status === 'failed') return <div className="mt-2 text-xs font-bold text-red-600">{rec.result}</div>;
    if (rec.status === 'rejected') return <div className="mt-2 text-xs text-[#99807d] line-through">{describeAction(rec.action)}</div>;
    if (isRunning) {
      return (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#7a5c58]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {describeAction(rec.action)}
        </div>
      );
    }
    return (
      <div className="mt-2 p-2.5 rounded-xl bg-[#fff8f7] border border-[#ffd9d2] space-y-2">
        <div className="text-[11px] font-extrabold text-[#ff6f61]">🔔 بانتظار موافقتك</div>
        <div className="text-xs font-bold">{describeAction(rec.action)}</div>
        {renderEditor(msg, rec)}
        <div className="flex gap-2">
          <button onClick={() => approve(msg, rec)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold cursor-pointer">
            <Check className="w-3.5 h-3.5" /> موافق
          </button>
          <button onClick={() => reject(msg, rec)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white border border-[#f0e4e2] text-xs font-bold cursor-pointer">
            <Ban className="w-3.5 h-3.5" /> لا
          </button>
        </div>
      </div>
    );
  };

  // ---------- Affichage ----------

  const statusText = listening ? 'كنسمع ليك…' : busy ? 'كنفكر…' : speakingNow ? 'كنهضر… (ضغط على الصورة باش توقفني)' : inCall ? 'فالمكالمة' : 'واجد نخدم معاك';
  const page = variant === 'page';
  const accent = settings.colors.accent;

  const header = (
    <div
      className={page ? 'flex flex-col items-center gap-2 py-5 rounded-3xl text-white' : 'flex items-center gap-3 px-4 py-3 text-white'}
      style={{ background: `linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.primary}dd)` }}
      dir="rtl"
    >
      <button onClick={() => speakingNow && stopSpeaking()} className="cursor-pointer" aria-label={settings.name}>
        <AgentAvatar settings={settings} size={page ? 200 : 54} state={avatarState} level={level} />
      </button>
      <div className={page ? 'text-center' : 'flex-1 min-w-0'}>
        <div className={page ? 'text-lg font-black' : 'text-sm font-black truncate'}>{settings.name}</div>
        <div className="text-[11px] text-white/75">{statusText}</div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={inCall ? endCall : startCall}
          className={`flex items-center gap-1.5 rounded-full font-bold cursor-pointer ${page ? 'px-4 py-2 text-sm' : 'p-2'} ${inCall ? 'bg-red-500' : 'bg-green-500'} text-white`}
          title={inCall ? 'قطع المكالمة' : 'مكالمة صوتية'}
        >
          {inCall ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          {page && (inCall ? 'قطع المكالمة' : 'عيّط ليه')}
        </button>
        <button
          onClick={() => settingsStore.set((s) => ({ ...s, voice: { ...s.voice, autoSpeak: !s.voice.autoSpeak } }))}
          className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"
          title="الرد بالصوت"
        >
          {settings.voice.autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button
          onClick={() => window.confirm('مسح المحادثة؟ (الذاكرة كتبقى)') && chatStore.set([])}
          className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"
          title="مسح المحادثة"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {headerExtra}
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 cursor-pointer" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={page ? 'flex flex-col gap-3' : 'flex flex-col h-full'} dir="rtl">
      {header}

      {health?.ai === false && (
        <div className="mx-3 mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          الذكاء الاصطناعي ما مفعّلش بعد: الوكيل كيخدم بطريقة بسيطة. حط المفتاح <b dir="ltr">GEMINI_API_KEY</b> (شوف الدليل).
        </div>
      )}

      <div className={`overflow-y-auto p-3 space-y-3 bg-[#fff8f7] ${page ? 'min-h-[320px] max-h-[60vh] rounded-3xl border border-[#f0e4e2]' : 'flex-1'}`}>
        {messages.length === 0 && (
          <div className="text-center space-y-3 pt-4">
            <div className="text-sm font-extrabold">السلام عليكم السي منير 👋</div>
            <p className="text-xs text-[#7a5c58]">كتب، ولا ضغط على الميكروفون، ولا عيّط ليا. تقدر تصيفط ليا حتى تصاور ولا PDF.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send({ text: s })} className="px-3 py-1.5 rounded-full bg-white border border-[#f0e4e2] text-xs font-bold text-[#5a4340] hover:text-[#ff6f61] cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              dir="auto"
              className={`max-w-[88%] whitespace-pre-wrap px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user' ? 'text-white rounded-ss-md' : 'bg-white border border-[#f0e4e2] text-[#281715] rounded-se-md'
              }`}
              style={m.role === 'user' ? { background: accent } : undefined}
            >
              {m.text}
              {m.attachments && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {m.attachments.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/10 text-[10px]">
                      {a.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />} {a.name}
                    </span>
                  ))}
                </div>
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-bold text-[#ff6f61] truncate">
                      <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{s.title || s.url}</span>
                    </a>
                  ))}
                </div>
              )}
              {m.document && (
                <button onClick={() => setOpenDoc(m.document!)} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#281715] text-white text-xs font-bold cursor-pointer">
                  <FileText className="w-3.5 h-3.5" /> افتح الوثيقة
                </button>
              )}
              {m.actions?.map((rec) => <React.Fragment key={rec.id}>{renderActionCard(m, rec)}</React.Fragment>)}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-end">
            <div className="px-3.5 py-2.5 rounded-2xl bg-white border border-[#f0e4e2]">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {notice && (
        <div className="mx-3 p-2 rounded-xl bg-red-50 border border-red-100 text-[11px] text-red-700 flex items-start gap-2">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3">
          {pending.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#f0e4e2] text-[11px] font-bold">
              {a.mimeType.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              <span className="max-w-[120px] truncate">{a.name}</span>
              <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send({ text: input });
        }}
        className={`p-3 flex items-end gap-2 bg-white ${page ? 'rounded-3xl border border-[#f0e4e2]' : 'border-t border-[#f0e4e2]'}`}
      >
        <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-11 h-11 rounded-full bg-[#fff8f7] border border-[#f0e4e2] flex items-center justify-center cursor-pointer" title="صيفط صورة ولا وثيقة">
          <Paperclip className="w-5 h-5 text-[#7a5c58]" />
        </button>
        <button
          type="button"
          onClick={toggleMic}
          disabled={inCall}
          className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-40 ${listening === 'push' ? 'bg-red-500 text-white animate-pulse' : 'bg-[#fff0ed]'}`}
          style={listening === 'push' ? undefined : { color: accent }}
          title={listening === 'push' ? 'صيفط' : 'تكلّم'}
        >
          {listening === 'push' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send({ text: input });
            }
          }}
          rows={1}
          dir="auto"
          placeholder={listening === 'push' ? 'كنسمع… ضغط مرة أخرى باش تصيفط' : 'كتب رسالتك…'}
          className="flex-1 resize-none max-h-28 p-3 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6f61]"
        />
        <button
          type="submit"
          disabled={(!input.trim() && pending.length === 0) || busy}
          className="w-11 h-11 rounded-full text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
          style={{ background: accent }}
        >
          <Send className="w-5 h-5 rotate-180" />
        </button>
      </form>

      <DraftDocumentModal doc={openDoc} onClose={() => setOpenDoc(null)} />
    </div>
  );
};
