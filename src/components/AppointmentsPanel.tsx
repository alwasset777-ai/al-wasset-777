import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Phone, MessageCircle, Check, X, Trash2, MapPin, Inbox, RefreshCw } from 'lucide-react';
import type { Appointment } from '../types';
import type { AppointmentKind } from '../agent/types';
import { appointmentsStore, settingsStore, useStore } from '../agent/stores';
import { APPOINTMENT_KINDS, isActiveAppointment, makeAppointment, toWaNumber } from '../agent/normalize';
import { fmtDayTime, fmtTime, localDay, zoned } from '../agent/time';
import { InboxItem, listInbox, removeInboxItem } from '../services/inbox';
import { isFirebaseEnabled } from '../services/firebase';

const STATUS_LABEL: Record<Appointment['status'], string> = { demandé: 'طلب جديد', confirmé: 'مؤكد', fait: 'تم', annulé: 'ملغى' };
const STATUS_STYLE: Record<Appointment['status'], string> = {
  demandé: 'bg-amber-50 text-amber-700',
  confirmé: 'bg-sky-50 text-sky-700',
  fait: 'bg-green-50 text-green-700',
  annulé: 'bg-gray-100 text-gray-500',
};

const input = 'w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6f61]';
const emptyForm = { title: '', at: '', kind: 'زيارة' as AppointmentKind, clientName: '', clientPhone: '', place: '', notes: '' };

const dayLabel = (day: string) => {
  const today = zoned().date;
  const tomorrow = zoned(new Date(Date.now() + 86400000)).date;
  if (day === today) return 'اليوم';
  if (day === tomorrow) return 'غدا';
  return new Intl.DateTimeFormat('ar-MA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00`));
};

// Agenda du bureau : rendez-vous ajoutés à la main, par l'agent (voix / texte / WhatsApp)
// ou demandés par les clients du site, + les demandes reçues depuis le site.
export const AppointmentsPanel: React.FC = () => {
  const items = useStore(appointmentsStore);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [inboxError, setInboxError] = useState(false);

  const loadInbox = () => {
    if (!isFirebaseEnabled) return;
    setInboxError(false);
    listInbox().then(setInbox).catch(() => setInboxError(true));
  };
  useEffect(loadInbox, []);

  const { upcoming, past } = useMemo(() => {
    const limit = Date.now() - 2 * 3600 * 1000;
    return {
      upcoming: items.filter((a) => Date.parse(a.at) >= limit && isActiveAppointment(a)),
      past: items.filter((a) => Date.parse(a.at) < limit || !isActiveAppointment(a)).reverse(),
    };
  }, [items]);

  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    upcoming.forEach((a) => map.set(localDay(a.at), [...(map.get(localDay(a.at)) || []), a]));
    return [...map.entries()];
  }, [upcoming]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.at) return;
    const rdv = makeAppointment(
      { ...form, at: new Date(form.at).toISOString() },
      { source: 'manuel', remindBeforeMin: settingsStore.get().reminders.beforeMin }
    );
    if (!rdv) return;
    await appointmentsStore.put(rdv).catch(() => window.alert('تعذر الحفظ'));
    setForm(emptyForm);
    setShowForm(false);
  };

  const setStatus = (a: Appointment, status: Appointment['status']) => appointmentsStore.patch(a.id, { status }).catch(() => undefined);
  const remove = (a: Appointment) => window.confirm(`حذف الموعد «${a.title}»؟`) && appointmentsStore.remove(a.id).catch(() => undefined);
  const reminderText = (a: Appointment) =>
    `السلام عليكم ${a.clientName || ''}، كنفكروك بالموعد ديالنا ${fmtDayTime(a.at)}${a.place ? ` ف ${a.place}` : ''}. مكتب الوسيط 777 – 0777777848`;

  const card = (a: Appointment, muted = false) => (
    <div key={a.id} className={`p-3 rounded-2xl bg-white border border-[#f0e4e2] flex gap-3 ${muted ? 'opacity-60' : ''}`}>
      <div className="text-center shrink-0 w-16 space-y-1">
        <div className="text-base font-black">{fmtTime(a.at)}</div>
        <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#fff0ed] text-[#ff6f61]">{a.kind || 'موعد'}</div>
        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-sm font-extrabold">{a.title}</div>
        {(a.clientName || a.clientPhone) && <div className="text-xs text-[#5a4340]">👤 {a.clientName} {a.clientPhone && <span dir="ltr">{a.clientPhone}</span>}</div>}
        {(a.place || a.propertyTitle) && (
          <div className="text-xs text-[#7a5c58] flex items-center gap-1"><MapPin className="w-3 h-3" /> {[a.place, a.propertyTitle].filter(Boolean).join(' – ')}</div>
        )}
        {a.notes && <div className="text-[11px] text-[#99807d]">{a.notes}</div>}
        {muted && <div className="text-[11px] font-bold">{fmtDayTime(a.at)}</div>}
        <div className="flex flex-wrap gap-1 pt-1">
          {a.clientPhone && (
            <>
              <a href={`tel:${a.clientPhone}`} className="p-1.5 rounded-lg bg-[#fff8f7] text-[#5a4340]" title="اتصل"><Phone className="w-3.5 h-3.5" /></a>
              <a
                href={`https://wa.me/${toWaNumber(a.clientPhone)}?text=${encodeURIComponent(reminderText(a))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-[#fff8f7] text-green-700"
                title="صيفط تذكير للزبون ف واتساب"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
            </>
          )}
          {a.status === 'demandé' && (
            <button onClick={() => setStatus(a, 'confirmé')} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 text-sky-700 text-[11px] font-bold cursor-pointer"><Check className="w-3 h-3" /> تأكيد</button>
          )}
          {isActiveAppointment(a) && (
            <>
              <button onClick={() => setStatus(a, 'fait')} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-[11px] font-bold cursor-pointer"><Check className="w-3 h-3" /> تم</button>
              <button onClick={() => setStatus(a, 'annulé')} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#fff8f7] text-[11px] font-bold cursor-pointer"><X className="w-3 h-3" /> إلغاء</button>
            </>
          )}
          <button onClick={() => remove(a)} className="p-1.5 rounded-lg bg-[#fff8f7] text-red-600 cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <p className="text-xs text-[#7a5c58] flex-1">تقدر تقول للوكيل: «زيد موعد السبت مع 11 زيارة الفيلا مع السيد كريم». كيفكرك قبل الموعد.</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#ff6f61] text-white text-xs font-bold cursor-pointer">
          <Plus className="w-4 h-4" /> موعد جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-3xl border border-[#f0e4e2] p-4 grid sm:grid-cols-2 gap-2">
          <input required placeholder="العنوان (مثلا: زيارة شقة حمرية)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${input} sm:col-span-2`} />
          <input required type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} className={input} />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AppointmentKind })} className={input}>
            {APPOINTMENT_KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <input placeholder="اسم الزبون" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className={input} />
          <input placeholder="هاتف الزبون" dir="ltr" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} className={input} />
          <input placeholder="المكان" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} className={`${input} sm:col-span-2`} />
          <textarea placeholder="ملاحظات" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} sm:col-span-2`} />
          <button type="submit" className="sm:col-span-2 py-2.5 rounded-xl bg-[#281715] text-white text-sm font-bold cursor-pointer">حفظ الموعد</button>
        </form>
      )}

      {isFirebaseEnabled && (
        <div className="bg-white rounded-3xl p-4 border border-[#f0e4e2] space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Inbox className="w-4 h-4 text-[#ff6f61]" /> طلبات الزبائن من الموقع
            <button onClick={loadInbox} className="ms-auto p-1.5 rounded-lg hover:bg-[#fff0ed] cursor-pointer" title="تحديث"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          {inboxError && <p className="text-xs text-red-600">سجّل الدخول كمدير لقراءة الطلبات.</p>}
          {inbox && inbox.length === 0 && <p className="text-xs text-[#7a5c58]">لا توجد طلبات جديدة.</p>}
          {inbox?.map((r) => (
            <div key={r.id} className="p-3 rounded-2xl bg-[#fff8f7] text-xs flex gap-2">
              <div className="flex-1">
                <b>{r.name}</b> · <a href={`tel:${r.phone}`} dir="ltr">{r.phone}</a> · {r.kind === 'visite' ? 'زيارة' : r.kind === 'rappel' ? 'اتصال' : 'بحث'}
                {r.propertyTitle && <> · {r.propertyTitle}</>}
                {r.preferredAt && <> · {fmtDayTime(r.preferredAt)}</>}
                {r.message && <div className="text-[#5a4340] mt-1">{r.message}</div>}
              </div>
              <button onClick={() => removeInboxItem(r.id).then(loadInbox)} className="text-[#99807d] hover:text-red-600 cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {groups.length === 0 && <div className="py-10 text-center text-sm text-[#99807d]">ما كاين حتى موعد مبرمج.</div>}
      {groups.map(([day, list]) => (
        <div key={day} className="space-y-2">
          <h3 className="text-sm font-black">{dayLabel(day)}</h3>
          {list.map((a) => card(a))}
        </div>
      ))}

      {past.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowPast(!showPast)} className="text-xs font-bold text-[#99807d] underline cursor-pointer">
            {showPast ? 'خبّي' : 'بيّن'} المواعيد الفايتة والملغاة ({past.length})
          </button>
          {showPast && past.slice(0, 50).map((a) => card(a, true))}
        </div>
      )}
    </div>
  );
};
