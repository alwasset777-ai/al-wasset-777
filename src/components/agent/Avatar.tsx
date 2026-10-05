import React, { useEffect, useRef, useState } from 'react';
import type { AgentSettings, AvatarLook, AvatarPhoto } from '../../agent/types';
import { photoUrl } from '../../agent/stores';
import { mouthLevel } from '../../agent/voice';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AvatarProps {
  settings: AgentSettings;
  size: number;
  state?: AvatarState;
  level?: number; // niveau du micro (0..1) pendant l'écoute
  photo?: AvatarPhoto; // pour l'aperçu dans les réglages
}

export function activePhoto(settings: AgentSettings): AvatarPhoto | undefined {
  return settings.photos.find((p) => p.id === settings.activePhotoId) || settings.photos[0];
}

// Le personnage : la photo du gérant (bouche animée) ou un personnage dessiné personnalisable.
export const AgentAvatar: React.FC<AvatarProps> = ({ settings, size, state = 'idle', level = 0, photo }) => {
  const p = photo || (settings.avatarMode === 'photo' ? activePhoto(settings) : undefined);
  const ring =
    state === 'listening'
      ? `0 0 0 ${3 + level * 10}px rgba(34,197,94,0.35)`
      : state === 'speaking'
      ? `0 0 0 4px ${settings.colors.accent}55`
      : state === 'thinking'
      ? `0 0 0 4px ${settings.colors.primary}33`
      : 'none';
  return (
    <div
      className="relative rounded-full overflow-hidden shrink-0 transition-shadow duration-150"
      style={{ width: size, height: size, boxShadow: ring, background: `radial-gradient(circle at 50% 35%, ${settings.colors.accent}33, ${settings.colors.primary}22)` }}
    >
      {p ? <PhotoAvatar photo={p} size={size} /> : <DrawnAvatar look={settings.look} gender={settings.gender} accent={settings.colors.accent} size={size} />}
      {state === 'thinking' && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Photo animée (canvas) ----------

const PhotoAvatar: React.FC<{ photo: AvatarPhoto; size: number }> = ({ photo, size }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    photoUrl(photo.file).then((url) => {
      if (!url || !alive) return;
      const i = new Image();
      i.onload = () => alive && setImg(i);
      i.src = url;
    });
    return () => {
      alive = false;
    };
  }, [photo.file.id, photo.file.url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = Math.round(size * dpr);
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const jaw = document.createElement('canvas');
    jaw.width = S;
    jaw.height = S;
    const jctx = jaw.getContext('2d')!;

    // Recadrage carré (« cover ») de la photo.
    const scale = Math.max(S / img.width, S / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const ox = (S - w) / 2;
    const oy = (S - h) / 2;
    const mx = ox + photo.mouth.x * w;
    const my = oy + photo.mouth.y * h;
    const mw = Math.max(8, photo.mouth.w * w);

    const drawPhoto = (c: CanvasRenderingContext2D, t: number) => {
      c.save();
      const breathe = 1 + 0.008 * Math.sin(t / 900);
      c.translate(S / 2, S / 2 + 1.5 * dpr * Math.sin(t / 900));
      c.rotate(0.006 * Math.sin(t / 1700));
      c.scale(breathe, breathe);
      c.translate(-S / 2, -S / 2);
      c.drawImage(img, ox, oy, w, h);
      c.restore();
    };

    let raf = 0;
    const frame = (t: number) => {
      ctx.clearRect(0, 0, S, S);
      drawPhoto(ctx, t);
      const o = mouthLevel(t);
      if (o > 0.03) {
        const d = o * mw * 0.2;
        // Intérieur de la bouche entre la lèvre du haut (fixe) et le menton (déplacé vers le bas).
        ctx.save();
        ctx.fillStyle = 'rgba(48,14,12,0.88)';
        ctx.beginPath();
        ctx.ellipse(mx, my + d / 2, mw * 0.36 * (0.75 + 0.25 * o), d / 2 + 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Menton : partie sous la bouche, adoucie sur les bords, descendue de d.
        jctx.clearRect(0, 0, S, S);
        jctx.save();
        jctx.beginPath();
        jctx.rect(0, my, S, S - my);
        jctx.clip();
        drawPhoto(jctx, t);
        jctx.restore();
        jctx.save();
        jctx.globalCompositeOperation = 'destination-in';
        const cy = my + mw * 0.45;
        const g = jctx.createRadialGradient(mx, cy, mw * 0.55, mx, cy, mw * 1.2);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        jctx.fillStyle = g;
        jctx.fillRect(0, 0, S, S);
        jctx.restore();
        ctx.drawImage(jaw, 0, d);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [img, size, photo.mouth.x, photo.mouth.y, photo.mouth.w]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} className="block" />;
};

// ---------- Personnage dessiné (SVG) ----------

const DrawnAvatar: React.FC<{ look: AvatarLook; gender: 'male' | 'female'; accent: string; size: number }> = ({ look, gender, accent, size }) => {
  const mouthRef = useRef<SVGEllipseElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    let nextBlink = performance.now() + 2500;
    const frame = (t: number) => {
      const o = mouthLevel(t);
      mouthRef.current?.setAttribute('ry', String(1.6 + o * 6.5));
      mouthRef.current?.setAttribute('rx', String(7 - o * 1.5));
      const blinking = t > nextBlink && t < nextBlink + 140;
      if (t > nextBlink + 140) nextBlink = t + 2500 + Math.random() * 3000;
      // Clignement : écrasement vertical autour de la ligne des yeux (y = 81).
      eyesRef.current?.setAttribute('transform', blinking ? 'translate(0 72.9) scale(1 0.1)' : '');
      headRef.current?.setAttribute('transform', `rotate(${Math.sin(t / 1600) * 1.5} 100 150) translate(0 ${Math.sin(t / 900) * 0.8})`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const skin = look.skin;
  const shade = 'rgba(0,0,0,0.12)';
  const hair = look.hairColor;
  const cloth = look.outfitColor;
  const female = gender === 'female';

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="block">
      {/* Tenue */}
      {look.outfit === 'djellaba' && (
        <g>
          <path d="M28 200 C30 160 60 140 100 138 C140 140 170 160 172 200 Z" fill={cloth} />
          <path d="M62 150 C70 108 130 108 138 150 C120 140 80 140 62 150 Z" fill={cloth} stroke={shade} />
          <path d="M100 150 L100 200" stroke={accent} strokeWidth="3" strokeDasharray="2 4" />
        </g>
      )}
      {look.outfit === 'caftan' && (
        <g>
          <path d="M28 200 C30 160 60 140 100 138 C140 140 170 160 172 200 Z" fill={cloth} />
          <path d="M86 140 L100 172 L114 140" fill="none" stroke="#d4a72c" strokeWidth="4" />
          <path d="M100 172 L100 200" stroke="#d4a72c" strokeWidth="4" />
        </g>
      )}
      {look.outfit === 'suit' && (
        <g>
          <path d="M28 200 C30 160 60 142 100 140 C140 142 170 160 172 200 Z" fill={cloth} />
          <path d="M84 142 L100 180 L116 142 Z" fill="#ffffff" />
          <path d="M96 150 L104 150 L106 182 L100 190 L94 182 Z" fill={accent} />
          <path d="M84 142 L100 180 L78 168 Z M116 142 L100 180 L122 168 Z" fill={shade} />
        </g>
      )}
      {look.outfit === 'casual' && (
        <g>
          <path d="M28 200 C30 160 60 142 100 140 C140 142 170 160 172 200 Z" fill={cloth} />
          <path d="M84 141 C90 152 110 152 116 141" fill="none" stroke={shade} strokeWidth="4" />
        </g>
      )}
      {/* Cou */}
      <rect x="88" y="118" width="24" height="26" rx="8" fill={skin} />
      <rect x="88" y="128" width="24" height="10" fill={shade} />

      <g ref={headRef}>
        {/* Cheveux longs / foulard derrière la tête */}
        {look.hair === 'long' && <path d="M58 84 C56 40 144 40 142 84 L148 140 C130 150 70 150 52 140 Z" fill={hair} />}
        {look.hair === 'hijab' && <path d="M52 92 C50 30 150 30 148 92 L156 150 C130 162 70 162 44 150 Z" fill={hair} />}
        {/* Oreilles et tête */}
        <ellipse cx="62" cy="88" rx="7" ry="11" fill={skin} />
        <ellipse cx="138" cy="88" rx="7" ry="11" fill={skin} />
        <ellipse cx="100" cy="84" rx="38" ry="46" fill={skin} />
        {/* Barbe */}
        {!female && look.beard === 'short' && <path d="M66 92 C68 128 132 128 134 92 C128 120 72 120 66 92 Z" fill={hair} opacity="0.35" />}
        {!female && look.beard === 'full' && <path d="M63 86 C62 140 138 140 137 86 C134 112 122 120 100 121 C78 120 66 112 63 86 Z" fill={hair} />}
        {/* Cheveux */}
        {look.hair === 'short' && <path d="M62 78 C58 36 142 36 138 78 C132 60 118 52 100 52 C82 52 68 60 62 78 Z" fill={hair} />}
        {look.hair === 'curly' && (
          <g fill={hair}>
            {[66, 78, 90, 102, 114, 126, 134].map((x, i) => (
              <circle key={x} cx={x} cy={i % 2 ? 46 : 52} r="12" />
            ))}
          </g>
        )}
        {look.hair === 'long' && <path d="M62 80 C60 38 140 38 138 80 C126 58 74 58 62 80 Z" fill={hair} />}
        {look.hair === 'bald' && <path d="M64 70 C66 64 70 60 74 58 M136 70 C134 64 130 60 126 58" stroke={hair} strokeWidth="5" fill="none" opacity="0.5" />}
        {look.hair === 'hijab' && <path d="M60 80 C60 40 140 40 140 80 C130 60 70 60 60 80 Z" fill={hair} />}
        {/* Sourcils */}
        <path d="M76 70 Q85 65 94 70 M106 70 Q115 65 124 70" stroke={look.hair === 'hijab' || look.hair === 'bald' ? '#3a2a22' : hair} strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Yeux (clignent) */}
        <g ref={eyesRef}>
          <ellipse cx="85" cy="81" rx="4.5" ry="5" fill="#2b1d16" />
          <ellipse cx="115" cy="81" rx="4.5" ry="5" fill="#2b1d16" />
          <circle cx="86.5" cy="79.5" r="1.3" fill="#fff" />
          <circle cx="116.5" cy="79.5" r="1.3" fill="#fff" />
        </g>
        {look.glasses && (
          <g fill="none" stroke="#2b1d16" strokeWidth="2.5">
            <rect x="72" y="72" width="26" height="18" rx="6" />
            <rect x="102" y="72" width="26" height="18" rx="6" />
            <path d="M98 80 L102 80" />
          </g>
        )}
        {/* Nez */}
        <path d="M100 86 Q96 98 101 100" stroke={shade} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Bouche (bouge quand il parle) */}
        <ellipse ref={mouthRef} cx="100" cy="110" rx="7" ry="1.6" fill="#7a2e2a" />
        {female && <ellipse cx="100" cy="108.5" rx="7.5" ry="1.4" fill="#b4504a" opacity="0.6" />}
      </g>
    </svg>
  );
};
