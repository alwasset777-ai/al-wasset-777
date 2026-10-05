import React, { useState } from 'react';
import { 
  Briefcase, 
  Users, 
  Building2, 
  Sparkles, 
  Plus, 
  Search, 
  Phone, 
  MessageCircle, 
  Upload, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Filter,
  Trash2,
  CalendarDays
} from 'lucide-react';
import { Property, ClientLead, Language } from '../types';
import { clientsStore } from '../services/officeStores';
import { PropertyRegistry } from './PropertyRegistry';
import { AppointmentsPanel } from './AppointmentsPanel';

interface CrmViewProps {
  properties: Property[];
  language: Language;
  onSelectProperty: (property: Property) => void;
}

export const CrmView: React.FC<CrmViewProps> = ({
  properties,
  language,
  onSelectProperty
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  
  const [clients, setClients] = clientsStore.use();
  const [activeTab, setActiveTab] = useState<'matching' | 'clients' | 'addClient' | 'registry' | 'appointments'>('matching');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // L'agent peut ouvrir directement un onglet (ex. « Rendez-vous » après avoir ajouté un rendez-vous).
  React.useEffect(() => {
    const onTab = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (['matching', 'clients', 'addClient', 'registry', 'appointments'].includes(tab)) setActiveTab(tab);
    };
    window.addEventListener('alwassit:crm-tab', onTab);
    return () => window.removeEventListener('alwassit:crm-tab', onTab);
  }, []);
  const [clientSearch, setClientSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCategory, setNewClientCategory] = useState<'فرد' | 'شركة'>('فرد');
  const [newClientRequestType, setNewClientRequestType] = useState('شراء');
  const [newClientPropType, setNewClientPropType] = useState('شقة');
  const [newClientBudget, setNewClientBudget] = useState('');
  const [newClientArea, setNewClientArea] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  const playNotificationChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio context might require user gesture
    }
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) return;

    const newLead: ClientLead = {
      id: Date.now(),
      name: newClientName,
      phone: newClientPhone,
      category: newClientCategory,
      requestType: newClientRequestType,
      propType: newClientPropType,
      budget: parseFloat(newClientBudget) || 0,
      area: newClientArea || 'Casablanca',
      status: 'نشط',
      notes: newClientNotes,
      linkedPropIds: [],
      dateAdded: new Date().toISOString().split('T')[0]
    };

    setClients([newLead, ...clients]);
    playNotificationChime();
    setActiveTab('clients');

    // Reset Form
    setNewClientName('');
    setNewClientPhone('');
    setNewClientBudget('');
    setNewClientArea('');
    setNewClientNotes('');
  };

  const handleDeleteClient = (id: number) => {
    setClients(clients.filter((c) => c.id !== id));
  };

  // Smart Matching Computation
  const matches = React.useMemo(() => {
    const result: Array<{
      client: ClientLead;
      property: Property;
      matchScore: number;
      reason: string;
    }> = [];

    clients.forEach((client) => {
      properties.forEach((prop) => {
        let score = 0;
        let reasons: string[] = [];

        // Check Type
        if (
          (client.propType === 'شقة' && prop.type === 'Appartement') ||
          (client.propType === 'فيلا' && prop.type === 'Villa') ||
          (client.propType === 'أرض' && prop.type === 'Terrain') ||
          (client.propType === 'محل تجاري' && prop.type === 'Local Commercial')
        ) {
          score += 40;
          reasons.push(isAr ? 'تطابق نوع العقار' : isEn ? 'Matching Property Type' : 'Type correspondant');
        }

        // Check Budget
        if (client.budget > 0) {
          const diff = Math.abs(prop.price - client.budget) / client.budget;
          if (diff <= 0.15) {
            score += 40;
            reasons.push(isAr ? 'ميزانية مناسبة تماماً' : isEn ? 'Budget Perfectly Aligned' : 'Budget aligné');
          } else if (diff <= 0.3) {
            score += 20;
            reasons.push(isAr ? 'ميزانية قريبة' : isEn ? 'Budget Close' : 'Budget proche');
          }
        }

        if (score >= 40) {
          result.push({
            client,
            property: prop,
            matchScore: score,
            reason: reasons.join(' • ')
          });
        }
      });
    });

    return result.sort((a, b) => b.matchScore - a.matchScore);
  }, [clients, properties, isAr, isEn]);

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header */}
      <div className="border-b border-[#f2e6e4] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff0ed] text-[#ff6f61] text-xs font-bold mb-2">
            <Briefcase className="w-3.5 h-3.5" />
            <span>{isAr ? 'لوحة إدارة الوكالة العقارية' : isEn ? 'Agency CRM & Backoffice' : 'Backoffice & CRM Agence'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight">
            {isAr ? 'نظام إدارة الزبائن والمطابقة الذكية' : isEn ? 'Client Leads & Smart Property Matching' : 'Gestion des Prospects & Matching Immo'}
          </h1>
          <p className="text-xs sm:text-sm text-[#7a5c58] mt-1">
            {isAr
              ? 'محرك ذكي يربط طلبات المشترين والمكترين بالعقارات المتوفرة تلقائياً.'
              : isEn
              ? 'Automated intelligent matching engine connecting buyer/renter requests with listings.'
              : 'Système automatisé de rapprochement entre vos mandats et la base acquéreurs.'}
          </p>
        </div>

        {/* Audio notification toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                : 'bg-[#fff8f7] text-[#7a5c58] border-[#f0e4e2]'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>
              {isAr
                ? (soundEnabled ? 'التنبيه الصوتي مفعّل' : 'التنبيه الصوتي معطل')
                : isEn
                ? (soundEnabled ? 'Sound alert ON' : 'Sound alert OFF')
                : (soundEnabled ? 'Alerte sonore ON' : 'Alerte sonore OFF')}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs">
          <span className="text-xs font-bold text-[#7a5c58]">{isAr ? 'عقارات متاحة' : isEn ? 'Portfolio Listings' : 'Biens en portefeuille'}</span>
          <div className="text-2xl font-black text-[#281715] mt-1">{properties.length}</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs">
          <span className="text-xs font-bold text-[#7a5c58]">{isAr ? 'زبائن نشطاء' : isEn ? 'Active Leads' : 'Clients & Leads'}</span>
          <div className="text-2xl font-black text-[#ff6f61] mt-1">{clients.length}</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs">
          <span className="text-xs font-bold text-[#7a5c58]">{isAr ? 'مطابقات ذكية جاهزة' : isEn ? 'Smart Matches Found' : 'Opportunités détectées'}</span>
          <div className="text-2xl font-black text-[#16a34a] mt-1">{matches.length}</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs">
          <span className="text-xs font-bold text-[#7a5c58]">{isAr ? 'نسبة التحويل' : isEn ? 'Success Rate' : 'Taux de succès'}</span>
          <div className="text-2xl font-black text-[#281715] mt-1">78%</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#f2e6e4] pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('matching')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'matching'
              ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
              : 'text-[#7a5c58] hover:bg-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isAr ? `نظام المطابقة الذكي (${matches.length})` : isEn ? `Smart Match (${matches.length})` : `Matching Intelligent (${matches.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'clients'
              ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
              : 'text-[#7a5c58] hover:bg-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isAr ? `قائمة الزبائن (${clients.length})` : isEn ? `Leads Directory (${clients.length})` : `Répertoire Clients (${clients.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab('addClient')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'addClient'
              ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
              : 'text-[#7a5c58] hover:bg-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'إضافة زبون جديد' : isEn ? 'Add Lead' : 'Ajouter un prospect'}</span>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'registry'
              ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
              : 'text-[#7a5c58] hover:bg-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>{isAr ? 'سجل العقارات و المالكين' : isEn ? 'Property Registry' : 'Registre des biens'}</span>
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'appointments'
              ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
              : 'text-[#7a5c58] hover:bg-white'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>{isAr ? 'المواعيد' : isEn ? 'Appointments' : 'Rendez-vous'}</span>
        </button>
      </div>

      {activeTab === 'registry' && <PropertyRegistry language={language} />}
      {activeTab === 'appointments' && <AppointmentsPanel />}

      {/* Tab 1: Smart Matching */}
      {activeTab === 'matching' && (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-[#f0e4e2] p-8">
              <p className="text-xs text-[#7a5c58]">
                {isAr ? 'لا توجد مطابقات حالية. قم بإضافة زبائن جدد أو عقارات.' : isEn ? 'No match found yet. Add new leads or properties.' : 'Aucune correspondance trouvée pour le moment.'}
              </p>
            </div>
          ) : (
            matches.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
              >
                {/* Client info */}
                <div className="space-y-1 lg:w-1/3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#fff0ed] text-[#ff6f61] text-[10px] font-bold">
                      {item.client.requestType} • {item.client.propType}
                    </span>
                    <span className="text-xs font-bold text-[#16a34a]">
                      {item.matchScore}% Match
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#281715]">
                    {item.client.name}
                  </h3>
                  <div className="text-xs text-[#7a5c58]">
                    {isAr ? 'الميزانية:' : isEn ? 'Budget:' : 'Budget :'} <strong className="text-[#281715]">{item.client.budget.toLocaleString()} MAD</strong>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden lg:flex items-center justify-center text-[#ff6f61]">
                  <ArrowRight className="w-5 h-5" />
                </div>

                {/* Property Match */}
                <div className="flex items-center gap-3 lg:w-1/3">
                  <img
                    src={item.property.images[0]}
                    alt=""
                    className="w-14 h-14 rounded-2xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-xs font-extrabold text-[#281715] line-clamp-1">
                      {isAr ? item.property.titleAr : isEn && item.property.titleEn ? item.property.titleEn : item.property.titleFr}
                    </h4>
                    <div className="text-xs font-black text-[#ff6f61]">
                      {isAr ? item.property.priceFormattedAr : isEn && item.property.priceFormattedEn ? item.property.priceFormattedEn : item.property.priceFormattedFr}
                    </div>
                    <span className="text-[10px] text-[#99807d]">
                      {item.property.district}, {item.property.city}
                    </span>
                  </div>
                </div>

                {/* Action CTA */}
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-[#f2e6e4]">
                  <button
                    onClick={() => onSelectProperty(item.property)}
                    className="px-3 py-2 rounded-xl bg-[#fff8f7] text-[#281715] hover:bg-[#fff0ed] text-xs font-bold border border-[#f0e4e2] cursor-pointer"
                  >
                    {isAr ? 'معاينة العقار' : isEn ? 'View Property' : 'Détails bien'}
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?phone=212${item.client.phone.replace(/^0/, '')}&text=${encodeURIComponent(
                      `Bonjour ${item.client.name}, nous avons trouvé un bien correspondant à votre recherche : ${item.property.titleFr} à ${item.property.priceFormattedFr}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20b858] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Clients Directory */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم أو الهاتف...' : isEn ? 'Search by name or phone...' : 'Recherche prospect...'}
                className="w-64 px-3 py-2 text-xs bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#fff8f7] text-[#7a5c58] font-bold border-b border-[#f2e6e4]">
                  <tr>
                    <th className="p-3">{isAr ? 'الزبون' : isEn ? 'Client' : 'Client'}</th>
                    <th className="p-3">{isAr ? 'الهاتف' : isEn ? 'Phone' : 'Téléphone'}</th>
                    <th className="p-3">{isAr ? 'الطلب' : isEn ? 'Request' : 'Demande'}</th>
                    <th className="p-3">{isAr ? 'الميزانية' : isEn ? 'Budget' : 'Budget'}</th>
                    <th className="p-3">{isAr ? 'المنطقة' : isEn ? 'Area' : 'Secteur'}</th>
                    <th className="p-3">{isAr ? 'الإجراءات' : isEn ? 'Actions' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2e6e4]">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-[#fffdfc]">
                      <td className="p-3 font-extrabold text-[#281715]">
                        {c.name}
                        <span className="block text-[10px] text-[#99807d] font-normal">{c.category}</span>
                      </td>
                      <td className="p-3 text-[#5a4340] font-mono">{c.phone}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#fff0ed] text-[#ff6f61] font-bold">
                          {c.requestType} • {c.propType}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#281715]">{c.budget.toLocaleString()} MAD</td>
                      <td className="p-3 text-[#7a5c58]">{c.area}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${c.phone}`}
                            className="p-1.5 rounded-lg bg-[#fff8f7] text-[#281715] hover:bg-[#fff0ed]"
                            title="Appeler"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleDeleteClient(c.id)}
                            className="p-1.5 rounded-lg bg-[#fff8f7] text-[#dc2626] hover:bg-[#fef2f2] cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Add Client Form */}
      {activeTab === 'addClient' && (
        <form onSubmit={handleAddClient} className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm max-w-2xl space-y-4">
          <h2 className="text-base font-extrabold text-[#281715]">
            {isAr ? 'تسجيل زبون أو طلب عقاري جديد' : isEn ? 'Register New Client Lead' : 'Enregistrer un nouveau prospect'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'اسم الزبون / الشركة' : isEn ? 'Client / Company Name' : 'Nom du prospect'}
              </label>
              <input
                type="text"
                required
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Ex: Karim Benjelloun"
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'رقم الهاتف' : isEn ? 'Phone Number' : 'Numéro de téléphone'}
              </label>
              <input
                type="tel"
                required
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="0661000000"
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'نوع الطلب' : isEn ? 'Operation Type' : 'Type d’opération'}
              </label>
              <select
                value={newClientRequestType}
                onChange={(e) => setNewClientRequestType(e.target.value)}
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              >
                <option value="شراء">{isAr ? 'شراء' : isEn ? 'Purchase' : 'Achat'}</option>
                <option value="كراء">{isAr ? 'كراء' : isEn ? 'Rent' : 'Location'}</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'صنف العقار المطلوب' : isEn ? 'Desired Property Type' : 'Type de bien souhaité'}
              </label>
              <select
                value={newClientPropType}
                onChange={(e) => setNewClientPropType(e.target.value)}
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              >
                <option value="شقة">{isAr ? 'شقة' : isEn ? 'Apartment' : 'Appartement'}</option>
                <option value="فيلا">{isAr ? 'فيلا' : isEn ? 'Villa' : 'Villa'}</option>
                <option value="أرض">{isAr ? 'أرض' : isEn ? 'Land' : 'Terrain'}</option>
                <option value="محل تجاري">{isAr ? 'محل تجاري' : isEn ? 'Commercial' : 'Commerce'}</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'الميزانية المتاحة (MAD)' : isEn ? 'Budget (MAD)' : 'Budget (MAD)'}
              </label>
              <input
                type="number"
                value={newClientBudget}
                onChange={(e) => setNewClientBudget(e.target.value)}
                placeholder="Ex: 3000000"
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'الحي / المدينة' : isEn ? 'City / Target District' : 'Ville / Quartier cible'}
              </label>
              <input
                type="text"
                value={newClientArea}
                onChange={(e) => setNewClientArea(e.target.value)}
                placeholder="Ex: Casablanca - Maarif"
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#5a4340] mb-1 text-xs">
              {isAr ? 'ملاحظات وتفضيلات إضافية' : isEn ? 'Notes & Specific Criteria' : 'Notes & critères spécifiques'}
            </label>
            <textarea
              rows={3}
              value={newClientNotes}
              onChange={(e) => setNewClientNotes(e.target.value)}
              placeholder="Ex: High floor, elevator required..."
              className="w-full px-3 py-2 text-xs bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
            ></textarea>
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-[#ff6f61] hover:bg-[#e8584a] text-white text-xs font-bold shadow-md cursor-pointer transition-all"
          >
            {isAr ? 'حفظ الزبون وتشغيل المطابقة' : isEn ? 'Save Lead & Run Matching' : 'Enregistrer le prospect'}
          </button>
        </form>
      )}

    </div>
  );
};
