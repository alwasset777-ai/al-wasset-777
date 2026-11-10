import React from 'react';
import { agencyProfile } from '../data/agencyProfile';

// Avatar de « منير » : photo choisie par le gérant (ou logo PUB du bureau), qui « parle »
// (halo animé + petites barres sonores) pendant la lecture vocale des réponses.
export const MuneerAvatar: React.FC<{ photo?: string | null; speaking?: boolean; listening?: boolean; size?: number }> = ({
  photo,
  speaking = false,
  listening = false,
  size = 40,
}) => (
  <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
    {(speaking || listening) && (
      <span className={`absolute -inset-1 rounded-full animate-ping opacity-60 ${listening ? 'bg-red-400' : 'bg-[#d71920]'}`} />
    )}
    <span
      className={`relative w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center ring-2 ${
        speaking ? 'ring-[#d71920]' : listening ? 'ring-red-400' : 'ring-white/60'
      }`}
    >
      <img
        src={photo || '/brand/logo-pub-alwasset777.webp'}
        alt={agencyProfile.agentNameAr}
        className={photo ? 'w-full h-full object-cover' : 'w-[85%] h-[85%] object-contain'}
        draggable={false}
      />
    </span>
    {speaking && (
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-[2px] px-1 py-0.5 rounded-full bg-[#111111]" aria-hidden>
        {[0, 150, 300].map((d) => (
          <span key={d} className="w-[3px] h-2 rounded-full bg-[#d71920] animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
    )}
  </span>
);
