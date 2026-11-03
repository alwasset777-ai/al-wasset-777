import { ArrowUp, Bot, MessageSquare, Mic, Paperclip, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { readAttachment, type Attachment } from '../agent/runtime';
import type { ChatMode, ModelRef } from '../core/types';
import { formatSize } from './hooks';
import { cx, toast } from './primitives';
import { ModelPicker } from './widgets';

export function ModeToggle({ mode, onChange }: { mode: ChatMode; onChange: (m: ChatMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface text-[12px]" role="radiogroup" aria-label="Mode">
      {(
        [
          ['chat', 'Chat', MessageSquare],
          ['agent', 'Agent autonome', Bot],
        ] as const
      ).map(([m, label, Icon]) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={cx('inline-flex items-center gap-1.5 rounded-md px-2.5 h-7', mode === m ? (m === 'agent' ? 'bg-accent text-accent-fg font-medium' : 'bg-surface-3 font-medium') : 'text-muted')}
        >
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}

const SpeechRec: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

export function Composer(props: {
  onSend: (text: string, mode: ChatMode, attachments: Attachment[]) => void;
  onStop?: () => void;
  running?: boolean;
  mode: ChatMode;
  onMode: (m: ChatMode) => void;
  model: ModelRef;
  onModel: (m: ModelRef) => void;
  placeholder?: string;
  autoFocus?: boolean;
  initial?: string;
}) {
  const [text, setText] = useState(props.initial || '');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [listening, setListening] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const rec = useRef<any>(null);

  useEffect(() => {
    if (props.initial) setText(props.initial);
  }, [props.initial]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || props.running) return;
    props.onSend(t, props.mode, files);
    setText('');
    setFiles([]);
  };

  async function pick(list: FileList | null) {
    if (!list) return;
    const out: Attachment[] = [];
    for (const f of Array.from(list)) {
      if (f.size > 8 * 1024 * 1024) {
        toast(`${f.name} est trop lourd (max 8 Mo).`, 'danger');
        continue;
      }
      out.push(await readAttachment(f));
    }
    setFiles((x) => [...x, ...out]);
  }

  function toggleMic() {
    if (!SpeechRec) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new SpeechRec();
    r.lang = navigator.language?.startsWith('ar') ? 'ar-MA' : 'fr-FR';
    r.interimResults = true;
    r.continuous = false;
    const base = text ? text + ' ' : '';
    r.onresult = (e: any) => setText(base + Array.from(e.results).map((x: any) => x[0].transcript).join(''));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  return (
    <div className="card shadow-soft p-2.5 focus-within:border-accent transition-colors">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pb-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 border border-line px-2 py-1 text-xs">
              <Paperclip size={12} /> {f.name} <span className="text-muted">{formatSize(f.size)}</span>
              <button aria-label={`Retirer ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={ta}
        value={text}
        autoFocus={props.autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia('(pointer: fine)').matches) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder={props.placeholder || (props.mode === 'agent' ? 'Décrivez un objectif : Wakil le planifie, l’exécute et vous livre le résultat…' : 'Écrivez votre message…')}
        className="w-full resize-none bg-transparent outline-none px-2 py-1.5 text-[15px] leading-relaxed placeholder:text-muted/70"
        aria-label="Message"
      />
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <ModeToggle mode={props.mode} onChange={props.onMode} />
        <ModelPicker value={props.model} onChange={props.onModel} compact />
        <div className="ml-auto flex items-center gap-1">
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => pick(e.target.files).then(() => (e.target.value = ''))} />
          <button className="size-9 inline-flex items-center justify-center rounded-xl text-muted hover:bg-surface-2" aria-label="Joindre des fichiers" title="Joindre des fichiers" onClick={() => fileInput.current?.click()}>
            <Paperclip size={18} />
          </button>
          {SpeechRec && (
            <button
              className={cx('size-9 inline-flex items-center justify-center rounded-xl hover:bg-surface-2', listening ? 'text-danger' : 'text-muted')}
              aria-label="Dicter"
              title="Dicter (voix)"
              onClick={toggleMic}
            >
              <Mic size={18} />
            </button>
          )}
          {props.running ? (
            <button onClick={props.onStop} className="size-9 inline-flex items-center justify-center rounded-xl bg-danger-soft text-danger" aria-label="Arrêter" title="Arrêter">
              <Square size={15} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="size-9 inline-flex items-center justify-center rounded-xl bg-accent text-accent-fg disabled:opacity-40"
              aria-label="Envoyer"
              title="Envoyer"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
