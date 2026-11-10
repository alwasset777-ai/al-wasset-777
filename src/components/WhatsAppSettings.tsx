// Réglages WhatsApp du gérant : pays par défaut des numéros + son propre numéro (test en un clic).
import React, { useState } from 'react';
import { COUNTRIES, countryByCode, formatInternational, isValidWhatsApp, toWhatsAppNumber, whatsappSettingsStore } from '../services/phone';

export const WhatsAppSettings: React.FC = () => {
  const [settings, setSettings] = whatsappSettingsStore.use();
  const [country, setCountry] = useState(settings.countryCode);
  const [number, setNumber] = useState(settings.ownerNumber ? `+${settings.ownerNumber}` : '');
  const [msg, setMsg] = useState('');

  const intl = number.trim() ? toWhatsAppNumber(number, country) : '';
  const valid = !number.trim() || isValidWhatsApp(intl);
  const saved = settings.countryCode === country && settings.ownerNumber === (number.trim() ? intl : '');
  const input = 'w-full p-2 rounded-lg border border-[#e5e5e5] bg-white text-xs';

  const save = () => {
    if (!valid) return setMsg('⚠️ الرقم ماشي صحيح');
    setSettings({ countryCode: country, ownerNumber: number.trim() ? intl : '' });
    setMsg('✅ تسجّل');
  };

  return (
    <div className="space-y-2 pt-1 border-t border-[#e5e5e5]" data-testid="whatsapp-settings">
      <div className="text-[11px] font-black pt-2">🟢 واتساب</div>
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold text-[#555555]">الدولة (للأرقام اللي كتبدا بـ 0)</span>
        <select value={country} onChange={(e) => { setCountry(e.target.value); setMsg(''); }} className={input} aria-label="الدولة">
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.nameAr} (+{c.code})</option>
          ))}
        </select>
      </label>
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold text-[#555555]">رقم الواتساب ديالك</span>
        <div className="flex gap-1.5" dir="ltr">
          <span className="px-2 flex items-center rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-xs font-bold">{countryByCode(country)?.flag} +{country}</span>
          <input value={number} onChange={(e) => { setNumber(e.target.value); setMsg(''); }} placeholder="0777777848" inputMode="tel" dir="ltr" className={input} aria-label="رقم الواتساب" />
        </div>
      </label>
      {number.trim() && (
        <div className={`text-[10px] ${valid ? 'text-[#555555]' : 'text-[#d71920] font-bold'}`} dir="auto">
          {valid ? <>الرقم الكامل: <bdi dir="ltr" className="font-bold">{formatInternational(intl)}</bdi></> : 'الرقم ماشي صحيح (خاصو بين 8 و15 رقم)'}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={!valid || saved} className="flex-1 py-2 rounded-xl bg-[#111111] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer">
          {saved ? 'محفوظ' : 'سجّل'}
        </button>
        {settings.ownerNumber && (
          <a href={`https://wa.me/${settings.ownerNumber}?text=${encodeURIComponent('تجربة من i.wasset ✅')}`} target="_blank" rel="noopener noreferrer" className="px-3 flex items-center rounded-xl bg-[#25D366] text-white text-xs font-extrabold">
            جرّب
          </a>
        )}
      </div>
      {msg && <div className="text-[10px] font-bold">{msg}</div>}
      <p className="text-[10px] text-[#888888] leading-relaxed">
        الرقم كيتحفظ غير فهاد الجهاز. ملي كتعطي لـ{' '}<span dir="ltr">monymounir</span> رقم زبون فالخارج، قول ليه الدولة (مثلا «فرنسا») ولا كتب الرقم بـ «+».
      </p>
    </div>
  );
};
