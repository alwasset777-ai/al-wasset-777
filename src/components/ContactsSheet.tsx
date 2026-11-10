// « 👤 أرقام » : ramener des numéros (contacts du téléphone, vCard, copier-coller, partage) et s'en servir
// librement : les donner à monymounir, appeler, WhatsApp, partager la fiche, l'enregistrer comme client.
import React, { useRef, useState } from 'react';
import { ClipboardPaste, FileUp, MessageCircle, Phone, Send, Share2, Smartphone, UserPlus, X } from 'lucide-react';
import { createStore } from '../services/createStore';
import {
  contactPickerSupported, contactsFromText, contactText, parseVCard, pickFromPhone, prettyPhone, shareContact, waNumber, type PickedContact,
} from '../services/contacts';

// Derniers contacts ramenés, gardés sur l'appareil pour les réutiliser.
export const recentContactsStore = createStore<PickedContact[]>('alwassit777.contacts.recent.v1', []);

export function addRecentContacts(list: PickedContact[]) {
  if (!list.length) return;
  recentContactsStore.set((prev) => {
    const key = (c: PickedContact) => c.phones.map((p) => waNumber(p) || p).join(',');
    const keys = new Set(list.map(key));
    return [...list, ...prev.filter((c) => !keys.has(key(c)))].slice(0, 25);
  });
}

interface Props {
  onUse: (text: string, sendNow?: boolean) => void;
  onClose: () => void;
}

export const ContactsSheet: React.FC<Props> = ({ onUse, onClose }) => {
  const [contacts, setContacts] = recentContactsStore.use();
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');
  const vcfRef = useRef<HTMLInputElement>(null);
  const picker = contactPickerSupported();

  const got = (list: PickedContact[], from: string) => {
    if (!list.length) return setNote(`ما لقيت حتى رقم ف${from}.`);
    addRecentContacts(list);
    setNote(`✅ ${list.length} ${list.length > 1 ? 'أرقام' : 'رقم'} من ${from}`);
  };

  const fromPhone = async () => {
    try {
      got(await pickFromPhone(), 'الكونطاكت');
    } catch {
      setNote('ما تقدرش نفتح الكونطاكت هنا.');
    }
  };

  const fromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) return got(contactsFromText(t), 'اللي نسختي');
    } catch {
      /* lecture refusée : on laisse la case */
    }
    setNote('لصق الرقم فالخانة لتحت 👇');
  };

  const btn = 'flex-1 min-w-[30%] flex flex-col items-center gap-1 py-2 rounded-xl bg-white border border-[#e5e5e5] text-[11px] font-bold cursor-pointer hover:border-[#d71920]';
  const act = 'flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer';

  return (
    <div dir="rtl" className="mx-3 mt-3 p-3 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] space-y-2.5 max-h-[60vh] overflow-y-auto text-[#111111]" data-testid="contacts-sheet">
      <div className="flex items-center gap-2 text-sm font-black">
        👤 الأرقام ديال الزبناء
        <button onClick={onClose} className="ms-auto p-1 rounded-lg hover:bg-black/5 cursor-pointer" aria-label="سدّ"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex flex-wrap gap-2">
        {picker && (
          <button onClick={fromPhone} className={btn}><Smartphone className="w-4 h-4 text-[#d71920]" /> من الكونطاكت</button>
        )}
        <button onClick={() => vcfRef.current?.click()} className={btn}><FileUp className="w-4 h-4 text-[#d71920]" /> ملف vCard</button>
        <button onClick={fromClipboard} className={btn}><ClipboardPaste className="w-4 h-4 text-[#d71920]" /> لصق رقم</button>
      </div>
      <input
        ref={vcfRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files: File[] = Array.from(e.target.files || []);
          const all = (await Promise.all(files.map((f) => f.text()))).flatMap((t) => parseVCard(t));
          got(all, 'الملف');
          e.target.value = '';
        }}
      />

      <div className="flex gap-2">
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={1}
          dir="auto"
          placeholder="سمية الزبون + الرقم (مثلا: Karim 0612345678)"
          className="flex-1 resize-none p-2 rounded-lg border border-[#e5e5e5] bg-white text-xs"
          aria-label="رقم جديد"
        />
        <button
          onClick={() => { got(contactsFromText(paste), 'الخانة'); setPaste(''); }}
          disabled={!paste.trim()}
          className="px-3 rounded-lg bg-[#111111] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer"
        >
          زيد
        </button>
      </div>
      {note && <div className="text-[11px] font-bold">{note}</div>}
      {!picker && (
        <p className="text-[10px] text-[#888888] leading-relaxed">
          📱 فالآيفون: حل الكونطاكت ← «مشاركة جهة الاتصال» ← <bdi>i.wasset</bdi> (من بعد ما تثبت التطبيق)، ولا صيفط الملف .vcf لراسك وحلّو هنا. فالأندرويد (Chrome) كيبان زر «من الكونطاكت».
        </p>
      )}

      {contacts.length > 0 && (
        <div className="space-y-2">
          {contacts.map((c, i) => {
            const first = c.phones[0];
            const wa = waNumber(first);
            return (
              <div key={i} className="rounded-xl bg-white border border-[#e5e5e5] p-2 space-y-1.5" data-testid="contact-card">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black truncate">{c.name || 'بلا سمية'}</div>
                    <div className="text-[11px] text-[#555555]">
                      {c.phones.map((p) => <bdi key={p} dir="ltr" className="me-2 inline-block">{prettyPhone(p)}</bdi>)}
                    </div>
                  </div>
                  <button onClick={() => setContacts((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-[#888888] cursor-pointer" aria-label="حيد"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => onUse(`👤 ${contactText(c)}\n`)} className={`${act} bg-[#111111] text-white`} title="عطيه لـ monymounir"><Send className="w-3 h-3 rtl:rotate-180" /> لـ <bdi>monymounir</bdi></button>
                  <button onClick={() => onUse(`سجّل هاد الزبون فالزبناء: ${contactText(c)}`, true)} className={`${act} bg-[#fdecec] text-[#d71920]`}><UserPlus className="w-3 h-3" /> زبون</button>
                  <a href={`tel:${wa ? `+${wa}` : first}`} className={`${act} bg-[#f0f0f0]`}><Phone className="w-3 h-3" /> عيّط</a>
                  {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`${act} bg-[#25D366] text-white`}><MessageCircle className="w-3 h-3" /> واتساب</a>}
                  <button
                    onClick={async () => {
                      const r = await shareContact(c);
                      setNote(r === 'copied' ? '📋 تنسخ الرقم، لصقو فين بغيتي' : r === 'shared' ? '✅ تشارك' : '');
                    }}
                    className={`${act} bg-[#f0f0f0]`}
                  >
                    <Share2 className="w-3 h-3" /> شارك
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-[#888888]">🔒 الأرقام كتبقى غير فهاد الجهاز. ملي كتعطي رقم لـ <bdi>monymounir</bdi> كيمشي مع الرسالة ديالك للذكاء الاصطناعي باش يخدم بيه.</p>
    </div>
  );
};
