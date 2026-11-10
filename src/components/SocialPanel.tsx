// « 🔗 الربط » : tous les réseaux du bureau au même endroit — comptes, partage d'un texte vers chaque
// application, liens à copier (bio, statut) et état de la publication automatique (Meta, gratuit).
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Share2, X, XCircle } from 'lucide-react';
import { loadAgency, onAgencyChange } from '../services/agencySettings';
import {
  allLinksText, canSystemShare, defaultShareUrl, getAccount, profileUrl, saveAccounts, shareEverywhere, SOCIALS, type SocialId,
} from '../services/social';
import { copyText } from '../services/contacts';

interface Health {
  meta?: { facebook?: boolean; instagram?: boolean };
  metricool?: boolean;
}

const readAll = () => Object.fromEntries(SOCIALS.map((s) => [s.id, getAccount(s.id)])) as Record<SocialId, string>;

export const SocialPanel: React.FC<{ onClose: () => void; initialText?: string }> = ({ onClose, initialText = '' }) => {
  const [values, setValues] = useState<Record<SocialId, string>>(readAll);
  const [dirty, setDirty] = useState(false);
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    loadAgency().then(() => { setValues(readAll()); setUrl(defaultShareUrl()); });
    const off = onAgencyChange(() => { if (!dirty) setValues(readAll()); });
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    await saveAccounts(values);
    setDirty(false);
    setNote('✅ تسجّلو الحسابات (وكيبانو حتى فالإعلانات)');
  };

  const shareTo = async (id: SocialId) => {
    const p = SOCIALS.find((s) => s.id === id)!;
    const direct = text.trim() || url ? p.share?.(text.trim(), url.trim()) : null;
    if (direct) return window.open(direct, '_blank', 'noopener');
    // Pas de lien de partage direct (Instagram, TikTok, Snapchat…) : on copie le texte et on ouvre l'application/le profil.
    const ok = await copyText([text.trim(), url.trim()].filter(Boolean).join('\n'));
    setNote(ok ? `📋 النص تنسخ، لصقو ف${p.name}` : '');
    const home = profileUrl(id, values[id]) || p.base.replace(/[@/]+$/, '').replace(/\/add$/, '');
    if (home && home !== 'https:') window.open(home, '_blank', 'noopener');
  };

  const input = 'flex-1 min-w-0 p-1.5 rounded-lg border border-[#e5e5e5] bg-white text-[11px]';
  const dot = (color: string, letter: string) => (
    <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: color, color: color === '#FFFC00' ? '#111' : '#fff' }}>{letter}</span>
  );
  const connected = SOCIALS.filter((s) => values[s.id]?.trim()).length;
  const links = allLinksText();

  return (
    <div dir="rtl" className="mx-3 mt-3 p-3 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] space-y-3 max-h-[62vh] overflow-y-auto text-[#111111]" data-testid="social-panel">
      <div className="flex items-center gap-2 text-sm font-black">
        🔗 الربط مع مواقع التواصل
        <span className="text-[10px] font-bold text-[#888888]">{connected}/{SOCIALS.length} مربوطين</span>
        <button onClick={onClose} className="ms-auto p-1 rounded-lg hover:bg-black/5 cursor-pointer" aria-label="سدّ"><X className="w-4 h-4" /></button>
      </div>

      {/* 1. Partager partout */}
      <div className="space-y-2 rounded-xl bg-white border border-[#e5e5e5] p-2.5">
        <div className="text-[11px] font-black">📤 شارك منشور فكل التطبيقات</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="auto" placeholder="النص ديال المنشور (ولا خلي monymounir يكتبو ليك)" className="w-full p-2 rounded-lg border border-[#e5e5e5] text-xs" aria-label="نص المنشور" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://…" className="w-full p-2 rounded-lg border border-[#e5e5e5] text-xs" aria-label="الرابط" />
        {canSystemShare() && (
          <button
            onClick={async () => {
              const r = await shareEverywhere(text.trim(), url.trim());
              setNote(r === 'copied' ? '📋 تنسخ النص' : r === 'shared' ? '✅ تشارك' : '');
            }}
            disabled={!text.trim() && !url.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#d71920] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer"
          >
            <Share2 className="w-4 h-4" /> شارك (Instagram، TikTok، Snapchat، Messenger… كاع التطبيقات)
          </button>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {SOCIALS.filter((s) => s.id !== 'website' && s.id !== 'google').map((s) => (
            <button key={s.id} onClick={() => shareTo(s.id)} disabled={!text.trim() && !url.trim()} className="flex items-center gap-1 p-1.5 rounded-lg border border-[#e5e5e5] bg-white text-[10px] font-bold disabled:opacity-40 cursor-pointer" data-testid={`share-${s.id}`}>
              {dot(s.color, s.letter)} <span className="truncate">{s.name.replace(' (Twitter)', '')}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#888888]">Instagram وTikTok وSnapchat ما كيقبلوش النص من برا: كننسخو ليك النص ونحلّو التطبيق، غير لصق.</p>
      </div>

      {/* 2. Comptes */}
      <div className="space-y-1.5 rounded-xl bg-white border border-[#e5e5e5] p-2.5">
        <div className="text-[11px] font-black">👥 الحسابات ديالك</div>
        {SOCIALS.map((s) => {
          const link = profileUrl(s.id, values[s.id]);
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              {dot(s.color, s.letter)}
              <span className="w-16 shrink-0 text-[10px] font-bold truncate">{s.name.replace(' (fiche du bureau)', '').replace(' (Twitter)', '')}</span>
              <input value={values[s.id] || ''} onChange={(e) => { setValues({ ...values, [s.id]: e.target.value }); setDirty(true); setNote(''); }} dir="ltr" placeholder={s.placeholder} className={input} aria-label={s.name} />
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-[#f0f0f0] shrink-0" aria-label={`حل ${s.name}`}><ExternalLink className="w-3.5 h-3.5" /></a>
              ) : <span className="w-[26px] shrink-0" />}
            </div>
          );
        })}
        <button onClick={save} disabled={!dirty} className="w-full py-2 rounded-xl bg-[#111111] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer">{dirty ? 'سجّل الحسابات' : 'محفوظين'}</button>
      </div>

      {note && <div className="text-[11px] font-bold">{note}</div>}

      {/* 3. Tous les liens */}
      {links && (
        <div className="space-y-1.5 rounded-xl bg-white border border-[#e5e5e5] p-2.5">
          <div className="text-[11px] font-black">🔗 كل الروابط فنص واحد (للبيو، الستاتي، التوقيع)</div>
          <pre dir="ltr" className="whitespace-pre-wrap text-[10px] text-[#555555] bg-[#fafafa] rounded-lg p-2">{links}</pre>
          <div className="flex gap-1.5">
            <button onClick={async () => setNote((await copyText(links)) ? '📋 تنسخو الروابط' : '')} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#f0f0f0] text-[11px] font-bold cursor-pointer"><Copy className="w-3 h-3" /> نسخ</button>
            {canSystemShare() && <button onClick={() => shareEverywhere(links)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#f0f0f0] text-[11px] font-bold cursor-pointer"><Share2 className="w-3 h-3" /> شارك</button>}
          </div>
        </div>
      )}

      {/* 4. Publication automatique */}
      <div className="space-y-1 rounded-xl bg-white border border-[#e5e5e5] p-2.5">
        <div className="text-[11px] font-black">🤖 النشر الأوتوماتيكي (بلا ما تحل التطبيق)</div>
        {health === null ? (
          <div className="text-[10px] text-[#888888]">ما قدرتش نعرف الحالة دابا.</div>
        ) : (
          <>
            {[
              { ok: health.meta?.facebook, label: 'Facebook (صفحة المكتب)' },
              { ok: health.meta?.instagram, label: 'Instagram' },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-1.5 text-[11px]">
                {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-[#c0392b]" />} {r.label}
              </div>
            ))}
            {health.metricool && <div className="flex items-center gap-1.5 text-[11px]"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Metricool</div>}
            {!(health.meta?.facebook && health.meta?.instagram) && (
              <p className="text-[10px] text-[#888888]">Facebook وInstagram كيتربطو فابور بمفاتيح Meta (الدليل: الجزء الثاني). الباقي كيتنشر بالأزرار لفوق.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
