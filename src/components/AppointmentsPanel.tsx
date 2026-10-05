import React, { useEffect, useState } from 'react';
import { CalendarDays, Phone, Plus, Trash2, Inbox, RefreshCw } from 'lucide-react';
import { Appointment } from '../types';
import { appointmentsStore, newAppointmentId } from '../services/officeStores';
import { InboxItem, listInbox, removeInboxItem } from '../services/inbox';
import { isFirebaseEnabled } from '../services/firebase';

const STATUS_LABEL: Record<Appointment['status'], string> = { demandé: 'طلب جديد', confirmé: 'مؤكد', fait: 'تم', annulé: 'ملغى' };
const STATUS_STYLE: Record<Appointment['status'], string> = {
  demandé: 'bg-amber-50 text-amber-700',
  confirmé: 'bg-sky-50 text-sky-700',
  fait: 'bg-green-50 text-green-700',
  annulé: 'bg-gray-100 text-gray-500',
};

// Agenda du bureau (visites, rappels) + demandes reçues depuis le site.
export const AppointmentsPanel: React.FC = () => {
  const [items, setItems] = appointmentsStore.use();
  const [form, setForm] = useState({ title: '', at: '', clientName: '', clientPhone: '' });
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [inboxError, setInboxError] = useState(false);

  const loadInbox = () => {
    if (!isFirebaseEnabled) return;
    setInboxError(false);
    listInbox().then(setInbox).catch(() => setInboxError(true));
  };
  useEffect(loadInbox, []);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.at) return;
    setItems((prev) => [
      { id: newAppointmentId(), ...form, at: new Date(form.at).toISOString(), notes: '', status: 'confirmé', source: 'manuel', createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setForm({ title: '', at: '', clientName: '', clientPhone: '' });
  };

  const sorted = [...items].sort((a, b) => (a.at < b.at ? -1 : 1));
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const upcoming = sorted.filter((a) => new Date(a.at).getTime() >= startOfToday && a.status !== 'annulé');
  const past = sorted.filter((a) => !upcoming.includes(a)).reverse();
  const input = 'p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm';

  const row = (a: Appointment) => (
    <div key={a.id} className="bg-white rounded-2xl p-4 border border-[#f0e4e2] flex flex-col sm:flex-row sm:items-center gap-3" dir="rtl">
      <div className="sm:w-40 shrink-0 text-xs font-black text-[#281715]">
        {new Date(a.at).toLocaleString('ar-MA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-extrabold truncate">{a.title}</div>
        <div className="text-xs text-[#7a5c58]">
          {a.clientName}
          {a.clientPhone && (
            <a href={`tel:${a.clientPhone}`} className="ms-2 inline-flex items-center gap-1 hover:text-[#ff6f61]" dir="ltr">
              <Phone className="w-3 h-3" /> {a.clientPhone}
            </a>
          )}
        </div>
      </div>
      <select
        value={a.status}
        onChange={(e) => setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: e.target.value as Appointment['status'] } : x)))}
        className={`text-xs font-bold rounded-lg px-2 py-1 border-0 ${STATUS_STYLE[a.status]}`}
      >
        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== a.id))} className="p-2 rounded-xl text-[#99807d] hover:text-red-600 cursor-pointer" title="حذف">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="bg-white rounded-3xl p-4 border border-[#f0e4e2] grid grid-cols-1 sm:grid-cols-5 gap-2" dir="rtl">
        <input required placeholder="الموضوع (مثلاً: زيارة شقة حمرية)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${input} sm:col-span-2`} />
        <input required type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} className={input} />
        <input placeholder="اسم الزبون" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className={input} />
        <div className="flex gap-2">
          <input placeholder="الهاتف" dir="ltr" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} className={`${input} flex-1 min-w-0`} />
          <button type="submit" className="px-3 rounded-xl bg-[#ff6f61] text-white cursor-pointer" title="إضافة"><Plus className="w-4 h-4" /></button>
        </div>
      </form>

      {isFirebaseEnabled && (
        <div className="bg-white rounded-3xl p-4 border border-[#f0e4e2] space-y-2" dir="rtl">
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
                {r.message && <div className="text-[#5a4340] mt-1">{r.message}</div>}
              </div>
              <button onClick={() => removeInboxItem(r.id).then(loadInbox)} className="text-[#99807d] hover:text-red-600 cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-extrabold text-[#7a5c58] flex items-center gap-1" dir="rtl"><CalendarDays className="w-4 h-4" /> المواعيد القادمة ({upcoming.length})</h3>
        {upcoming.length === 0 ? <p className="text-xs text-[#99807d] text-center py-6 bg-white rounded-2xl border border-[#f0e4e2]" dir="rtl">لا توجد مواعيد قادمة. يمكنك أيضاً أن تطلب من الوكيل: «زيد موعد غدا 10 صباحاً مع كريم».</p> : upcoming.map(row)}
      </div>
      {past.length > 0 && (
        <details className="space-y-2">
          <summary className="text-xs font-extrabold text-[#7a5c58] cursor-pointer" dir="rtl">المواعيد السابقة والملغاة ({past.length})</summary>
          <div className="space-y-2 mt-2">{past.slice(0, 30).map(row)}</div>
        </details>
      )}
    </div>
  );
};
