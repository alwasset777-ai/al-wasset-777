// Voix du personnage : lecture à voix haute (voix gratuite du téléphone / navigateur)
// et micro (enregistrement WAV envoyé à Gemini, qui comprend bien la darija).
import type { AgentSettings } from './types';

// ---------- Lecture à voix haute ----------

const listeners = new Set<(speaking: boolean) => void>();
let speaking = false;
let lastBoundary = 0;

function setSpeaking(v: boolean) {
  if (speaking === v) return;
  speaking = v;
  listeners.forEach((l) => l(v));
}

export const isSpeaking = () => speaking;
export function onSpeakingChange(l: (speaking: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Ouverture de la bouche (0..1) pour l'animation : syllabes simulées + impulsions à chaque mot.
export function mouthLevel(t: number): number {
  if (!speaking) return 0;
  const syllables = Math.abs(Math.sin(t / 85)) * 0.55 + Math.abs(Math.sin(t / 47 + 1.3)) * 0.35;
  const pulse = Math.max(0, 1 - (t - lastBoundary) / 220) * 0.4;
  return Math.min(1, syllables * 0.85 + pulse);
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function listVoices(): SpeechSynthesisVoice[] {
  return speechSupported() ? speechSynthesis.getVoices() : [];
}

export function onVoicesReady(cb: () => void): () => void {
  if (!speechSupported()) return () => {};
  speechSynthesis.addEventListener('voiceschanged', cb);
  return () => speechSynthesis.removeEventListener('voiceschanged', cb);
}

const isArabicText = (s: string) => /[؀-ۿ]/.test(s);

function pickVoice(lang: 'ar' | 'fr', settings: AgentSettings['voice']): SpeechSynthesisVoice | undefined {
  const voices = listVoices();
  const chosen = voices.find((v) => v.voiceURI === settings.voiceURI);
  if (chosen && chosen.lang.toLowerCase().startsWith(lang)) return chosen;
  const family = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  return family.find((v) => /ma$/i.test(v.lang)) || family.find((v) => v.localService) || family[0];
}

// Enlève emojis, liens et symboles pour une lecture naturelle.
export function cleanForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>|•]/g, ' ')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Chrome coupe les longues lectures : on découpe par phrases.
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?؟\n]+[.!?؟]*/g) || [text];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > 180 && cur) {
      out.push(cur.trim());
      cur = '';
    }
    cur += `${p} `;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

let speakToken = 0;

export function stopSpeaking() {
  speakToken++;
  if (speechSupported()) speechSynthesis.cancel();
  setSpeaking(false);
}

// Lit le texte ; la promesse se termine à la fin de la lecture (ou si elle est interrompue).
export function speak(text: string, settings: AgentSettings['voice']): Promise<void> {
  stopSpeaking();
  const clean = cleanForSpeech(text);
  if (!speechSupported() || !clean) return Promise.resolve();
  const token = speakToken;
  const lang = isArabicText(clean) ? 'ar' : 'fr';
  const voice = pickVoice(lang, settings);
  const parts = chunks(clean);
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (token !== speakToken || i >= parts.length) {
        if (token === speakToken) setSpeaking(false);
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i++]);
      u.lang = voice?.lang || (lang === 'ar' ? 'ar-MA' : 'fr-FR');
      if (voice) u.voice = voice;
      u.rate = settings.rate;
      u.pitch = settings.pitch;
      u.onstart = () => setSpeaking(true);
      u.onboundary = () => (lastBoundary = performance.now());
      u.onend = next;
      u.onerror = next;
      speechSynthesis.speak(u);
    };
    setSpeaking(true);
    next();
  });
}

// ---------- Micro : enregistrement WAV avec détection de la parole ----------

export const micSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const TARGET_RATE = 16000;

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([buffer], { type: 'audio/wav' });
}

function downsample(frames: Float32Array[], from: number): Float32Array {
  const total = frames.reduce((n, f) => n + f.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  frames.forEach((f) => {
    all.set(f, o);
    o += f.length;
  });
  if (from <= TARGET_RATE) return all;
  const ratio = from / TARGET_RATE;
  const out = new Float32Array(Math.floor(total / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += all[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export interface ListenOptions {
  mode: 'push' | 'auto'; // push : je parle puis j'appuie ; auto : appel mains libres
  onLevel?: (level: number) => void;
  onSpeechStart?: () => void;
}

// Micro ouvert pendant une séance (un appel) ; chaque listen() renvoie une phrase enregistrée.
export class Microphone {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private proc: ScriptProcessorNode | null = null;
  private onFrame: ((data: Float32Array, rms: number) => void) | null = null;
  private stopRequested = false;
  private cancelRequested = false;

  async open() {
    if (this.ctx) return;
    // Créé avant toute attente : iPhone n'autorise le son que pendant l'appui sur le bouton.
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    this.ctx.resume().catch(() => undefined);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      this.close();
      throw err;
    }
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.proc.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      this.onFrame?.(new Float32Array(data), Math.sqrt(sum / data.length));
    };
    source.connect(this.proc);
    this.proc.connect(this.ctx.destination);
  }

  close() {
    this.onFrame = null;
    this.proc?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.stream = null;
    this.proc = null;
  }

  // Termine la phrase en cours (bouton « envoyer »).
  finish() {
    this.stopRequested = true;
  }

  // Abandonne l'écoute sans rien envoyer.
  cancel() {
    this.cancelRequested = true;
  }

  async listen(opts: ListenOptions): Promise<Blob | null> {
    await this.open();
    await this.ctx!.resume();
    const rate = this.ctx!.sampleRate;
    const frameMs = (4096 / rate) * 1000;
    this.stopRequested = false;
    this.cancelRequested = false;
    return new Promise((resolve) => {
      const preRoll: Float32Array[] = [];
      const frames: Float32Array[] = [];
      let floor = 0.01;
      let speech = false;
      let silenceMs = 0;
      let totalMs = 0;
      const done = (keep: boolean) => {
        this.onFrame = null;
        opts.onLevel?.(0);
        resolve(keep && frames.length ? encodeWav(downsample(frames, rate), Math.min(rate, TARGET_RATE)) : null);
      };
      this.onFrame = (data, rms) => {
        totalMs += frameMs;
        opts.onLevel?.(Math.min(1, rms * 12));
        if (this.cancelRequested) return done(false);
        const threshold = Math.max(0.012, floor * 2.5);
        if (!speech) {
          floor = floor * 0.95 + rms * 0.05;
          preRoll.push(data);
          if (preRoll.length > 4) preRoll.shift();
          if (opts.mode === 'push' && this.stopRequested) return done(totalMs > 400);
          if (rms > threshold || opts.mode === 'push') {
            if (rms > threshold) {
              speech = true;
              opts.onSpeechStart?.();
            }
            if (opts.mode === 'push' || speech) frames.push(...preRoll.splice(0));
          }
          // Appel : on attend la parole sans limite ; mode bouton : 60 s maximum.
          if (opts.mode === 'push' && totalMs > 60000) return done(true);
          return;
        }
        frames.push(data);
        silenceMs = rms > threshold ? 0 : silenceMs + frameMs;
        const pauseLimit = opts.mode === 'auto' ? 1200 : 2000;
        if (this.stopRequested || silenceMs > pauseLimit || totalMs > 60000) done(true);
      };
    });
  }
}

// ---------- Reconnaissance vocale du navigateur (sans IA) ----------

export const BrowserRecognition: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

export function recognizeOnce(lang: string, onInterim?: (t: string) => void): { promise: Promise<string>; stop: () => void } {
  const r = new BrowserRecognition();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  let finalText = '';
  const promise = new Promise<string>((resolve) => {
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      onInterim?.(finalText + interim);
    };
    r.onend = () => resolve(finalText.trim());
    r.onerror = () => resolve(finalText.trim());
  });
  r.start();
  return { promise, stop: () => r.stop() };
}
