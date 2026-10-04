import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Phone, MapPin, Search, Plus, Trash2, FileText, Image as ImageIcon, Video, Download, X } from 'lucide-react';
import { Language, RegistryProperty, StoredFileRef } from '../types';
import { agencyProfile as A } from '../data/agencyProfile';
import { registryStore } from '../services/registryStore';
import { downloadBlob } from '../services/visualMaker';
import { LoginCard, SignOutButton, useAuthUser } from './AuthGate';

const PROPERTY_TYPES = ['شقة', 'فيلا', 'منزل', 'أرض', 'محل تجاري', 'مكتب', 'عمارة', 'رياض', 'ضيعة'];

const emptyForm = { propertyType: 'شقة', owner: '', ownerPhone: '', surface: '', location: '', price: '', notes: '' };

interface Props {
  language: Language;
}

// Registre simple des biens et propriétaires de l'agence, avec photos, vidéos et documents.
export const PropertyRegistry: React.FC<Props> = ({ language }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const t = (fr: string, ar: string, en: string) => (isAr ? ar : isEn ? en : fr);

  const user = useAuthUser();
  const [items, setItems] = useState<RegistryProperty[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<{ photos: File[]; videos: File[]; documents: File[] }>({ photos: [], videos: [], documents: [] });
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const canUse = !registryStore.online || !!user;

  useEffect(() => {
    if (!canUse) return;
    return registryStore.subscribe(setItems, () =>
      setLoadError(t('Accès refusé : ce compte n’est pas autorisé.', 'تعذر الوصول: هذا الحساب غير مسموح له.', 'Access denied for this account.'))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (it) =>
        (typeFilter === 'all' || it.propertyType === typeFilter) &&
        (!q || [it.owner, it.ownerPhone, it.location, it.surface, it.propertyType, it.price, it.notes].some((v) => v.toLowerCase().includes(q)))
    );
  }, [items, query, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.owner.trim() || !form.location.trim()) return;
    setSaving(true);
    try {
      await registryStore.add(form, files);
      setForm(emptyForm);
      setFiles({ photos: [], videos: [], documents: [] });
      setShowForm(false);
    } catch {
      window.alert(t('Enregistrement impossible. Vérifiez la connexion.', 'تعذر الحفظ. تحقق من الاتصال.', 'Save failed. Check your connection.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (it: RegistryProperty) => {
    if (!window.confirm(t('Supprimer cette fiche ?', 'حذف هذه البطاقة؟', 'Delete this record?'))) return;
    await registryStore.remove(it);
  };

  const openFile = async (ref: StoredFileRef) => {
    const blob = await registryStore.open(ref).catch(() => undefined);
    if (typeof blob === 'string') {
      if (ref.type.startsWith('image/') || ref.type.startsWith('video/')) setPreview({ url: blob, type: ref.type });
      else window.open(blob, '_blank', 'noopener');
      return;
    }
    if (!blob) return window.alert(t('Fichier introuvable sur cet appareil', 'الملف غير موجود على هذا الجهاز', 'File not found on this device'));
    if (ref.type.startsWith('image/') || ref.type.startsWith('video/')) {
      setPreview({ url: URL.createObjectURL(blob), type: ref.type });
    } else {
      downloadBlob(blob, ref.name);
    }
  };

  const closePreview = () => {
    if (preview?.url.startsWith('blob:')) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const input = 'w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6f61]';

  const fileField = (key: 'photos' | 'videos' | 'documents', label: string, accept: string, Icon: React.ElementType) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-[#7a5c58]">
      <span className="flex items-center gap-1"><Icon className="w-3.5 h-3.5" /> {label}</span>
      <input
        type="file"
        multiple
        accept={accept}
        onChange={(e) => setFiles({ ...files, [key]: Array.from(e.target.files || []) })}
        className="text-xs file:me-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#fff0ed] file:text-[#ff6f61] file:font-bold"
      />
      {files[key].length > 0 && <span className="text-[10px] text-[#99807d]">{files[key].length} {t('fichier(s)', 'ملف', 'file(s)')}</span>}
    </label>
  );

  const fileChips = (list: StoredFileRef[], Icon: React.ElementType) =>
    list.map((f) => (
      <button key={f.id} onClick={() => openFile(f)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#fff8f7] border border-[#f0e4e2] text-[10px] font-bold text-[#5a4340] hover:text-[#ff6f61] max-w-[160px] cursor-pointer">
        <Icon className="w-3 h-3 shrink-0" /> <span className="truncate">{f.name}</span>
      </button>
    ));

  if (registryStore.online && user === undefined) {
    return <div className="py-12 text-center text-xs text-[#7a5c58]">…</div>;
  }
  if (!canUse) return <LoginCard title="سجل العقارات و المالكين" />;

  return (
    <div className="space-y-5">
      {loadError && <div className="p-3 rounded-2xl bg-red-50 text-red-700 text-xs font-bold">{loadError}</div>}
      {/* 1/ معلومات المكتب */}
      <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] flex flex-col sm:flex-row sm:items-center gap-4" dir="rtl">
        <div className="w-12 h-12 rounded-2xl bg-[#ff6f61] text-white flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-sm font-black">{A.nameAr}</div>
          <div className="text-xs text-[#7a5c58] flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> المقر: {A.hqAr} – {A.addressAr}</div>
          <div className="text-xs text-[#7a5c58] flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> الهاتف: {A.phonesLocal.join(' / ')}</div>
        </div>
        <div className="text-xs font-bold text-[#ff6f61]">{A.sloganAr}</div>
      </div>

      {/* Recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#99807d] absolute top-3 start-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Rechercher : propriétaire, téléphone, lieu, surface…', 'بحث: المالك، الهاتف، الموقع، المساحة…', 'Search: owner, phone, location, size…')}
            className={`${input} ps-9`}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${input} sm:w-44`}>
          <option value="all">{t('Tous les types', 'كل الأنواع', 'All types')}</option>
          {PROPERTY_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
        </select>
        <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2.5 rounded-xl bg-[#ff6f61] text-white text-sm font-bold flex items-center justify-center gap-1 cursor-pointer">
          <Plus className="w-4 h-4" /> {t('Nouveau bien', 'عقار جديد', 'New property')}
        </button>
      </div>

      {/* 2/ معلومات العقار */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 border border-[#f0e4e2] grid grid-cols-1 sm:grid-cols-2 gap-4" dir="rtl">
          <label className="text-xs font-bold text-[#7a5c58] space-y-1">
            <span>نوع العقار</span>
            <select value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })} className={input}>
              {PROPERTY_TYPES.map((pt) => <option key={pt}>{pt}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[#7a5c58] space-y-1">
            <span>المالك *</span>
            <input required value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={input} />
          </label>
          <label className="text-xs font-bold text-[#7a5c58] space-y-1">
            <span>هاتف المالك</span>
            <input type="tel" dir="ltr" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} className={input} />
          </label>
          <label className="text-xs font-bold text-[#7a5c58] space-y-1">
            <span>المساحة (م²)</span>
            <input value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })} className={input} />
          </label>
          <label className="text-xs font-bold text-[#7a5c58] space-y-1">
            <span>الموقع *</span>
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={input} />
          </label>
          <label className="text-xs font-bold text-[#7a5c58] space-y-1">
            <span>الثمن</span>
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={input} />
          </label>
          {fileField('photos', 'الصور', 'image/*', ImageIcon)}
          {fileField('videos', 'الفيديو', 'video/*', Video)}
          {fileField('documents', 'الملفات و المستندات', '.pdf,.doc,.docx,.xls,.xlsx,image/*', FileText)}
          <label className="text-xs font-bold text-[#7a5c58] space-y-1 sm:col-span-2">
            <span>ملاحظات</span>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-[#f0e4e2] text-sm font-bold cursor-pointer">إلغاء</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-[#281715] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
              {saving ? '…' : 'حفظ'}
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-[#f0e4e2] text-xs text-[#7a5c58]">
          {items.length === 0
            ? t('Aucun bien enregistré. Cliquez sur « Nouveau bien ».', 'لا توجد عقارات مسجلة بعد. اضغط على «عقار جديد».', 'No property saved yet.')
            : t('Aucun résultat pour cette recherche.', 'لا توجد نتائج لهذا البحث.', 'No results.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((it) => (
            <div key={it.id} className="bg-white rounded-3xl p-5 border border-[#f0e4e2] space-y-3" dir="rtl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-[#fff0ed] text-[#ff6f61] text-[11px] font-bold">{it.propertyType}</span>
                  <div className="text-sm font-black mt-1.5">{it.owner}</div>
                  {it.ownerPhone && (
                    <a href={`tel:${it.ownerPhone}`} dir="ltr" className="text-xs text-[#7a5c58] hover:text-[#ff6f61]">{it.ownerPhone}</a>
                  )}
                </div>
                <button onClick={() => handleDelete(it)} className="p-2 rounded-xl text-[#99807d] hover:text-red-600 hover:bg-red-50 cursor-pointer" title="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-[#99807d]">الموقع</div><div className="font-bold">{it.location}</div></div>
                <div><div className="text-[#99807d]">المساحة</div><div className="font-bold">{it.surface ? `${it.surface} م²` : '—'}</div></div>
                <div><div className="text-[#99807d]">الثمن</div><div className="font-bold">{it.price || '—'}</div></div>
              </div>
              {it.notes && <p className="text-xs text-[#5a4340]">{it.notes}</p>}
              <div className="flex flex-wrap gap-1.5">
                {fileChips(it.photos, ImageIcon)}
                {fileChips(it.videos, Video)}
                {fileChips(it.documents, Download)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#99807d]">
        <p>
          {registryStore.online
            ? t(
                'Données enregistrées en ligne (Firebase) : accessibles depuis tous vos appareils après connexion.',
                'البيانات محفوظة على الإنترنت (Firebase): تجدها في كل أجهزتك بعد تسجيل الدخول.',
                'Data saved online (Firebase): available on all your devices after sign-in.'
              )
            : t(
                'Mode local : les fiches sont enregistrées sur cet appareil seulement. Configurez Firebase pour les retrouver partout.',
                'الوضع المحلي: البطاقات محفوظة على هذا الجهاز فقط. اربط Firebase لتجدها في كل أجهزتك.',
                'Local mode: records are stored on this device only. Configure Firebase to sync them.'
              )}
        </p>
        {user && <SignOutButton user={user} />}
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={closePreview}>
          <button className="absolute top-4 end-4 text-white p-2 cursor-pointer" onClick={closePreview}><X className="w-6 h-6" /></button>
          {preview.type.startsWith('video/') ? (
            <video src={preview.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-2xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={preview.url} alt="" className="max-h-[85vh] max-w-full rounded-2xl" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
};
