import React, { useState } from 'react';
import { 
  User, 
  Eye, 
  MessageSquare, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  BarChart3,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { Property, UserProfile, Language } from '../types';

interface DashboardViewProps {
  userProfile: UserProfile;
  userProperties: Property[];
  onSelectProperty: (property: Property) => void;
  onOpenPostAd: () => void;
  onDeleteProperty: (id: number) => void;
  onRenewProperty: (id: number) => void;
  language: Language;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userProfile,
  userProperties,
  onSelectProperty,
  onOpenPostAd,
  onDeleteProperty,
  onRenewProperty,
  language
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const [activeTab, setActiveTab] = useState<'ads' | 'stats' | 'settings'>('ads');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Accepté':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
            <CheckCircle2 className="w-3 h-3" />
            <span>{isAr ? 'مقبول ونشط' : isEn ? 'Active & Published' : 'Accepté & En ligne'}</span>
          </span>
        );
      case 'En révision':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
            <Clock className="w-3 h-3" />
            <span>{isAr ? 'قيد المراجعة' : isEn ? 'Under Review' : 'En révision'}</span>
          </span>
        );
      case 'Expiré':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
            <AlertTriangle className="w-3 h-3" />
            <span>{isAr ? 'منتهي الصلاحية' : isEn ? 'Expired' : 'Expiré'}</span>
          </span>
        );
    }
  };

  const getMemberSince = () => {
    if (isAr) return userProfile.memberSinceAr;
    if (isEn && userProfile.memberSinceEn) return userProfile.memberSinceEn;
    return userProfile.memberSinceFr;
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Profile Overview Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#f0e4e2] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        
        {/* User Details */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative">
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#ff6f61]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#16a34a] border-2 border-white flex items-center justify-center text-white" title="Compte vérifié">
              <ShieldCheck className="w-3 h-3" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#281715]">
                {userProfile.name}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#fff0ed] text-[#ff6f61] px-2 py-0.5 rounded-md">
                {isAr ? 'حساب معتمد' : isEn ? 'Verified Account' : 'Vérifié'}
              </span>
            </div>
            
            <p className="text-xs text-[#7a5c58] mt-0.5 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-[#ff6f61]" />
              <span>{getMemberSince()}</span>
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#5a4340]">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#99807d]" />
                {userProfile.email}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#99807d]" />
                {userProfile.phone}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onOpenPostAd}
          className="w-full md:w-auto px-5 py-3 rounded-2xl bg-[#ff6f61] hover:bg-[#e8584a] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#ff6f61]/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isAr ? 'نشر إعلان جديد' : isEn ? 'Post New Listing' : 'Déposer une annonce'}</span>
        </button>

      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#7a5c58]">
              {isAr ? 'إجمالي الإعلانات' : isEn ? 'Total Listings' : 'Total des annonces'}
            </span>
            <div className="text-2xl font-black text-[#281715] mt-0.5">
              {userProperties.length}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center">
            <PlusCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#7a5c58]">
              {isAr ? 'المشاهدات الكلية' : isEn ? 'Total Views' : 'Vues cumulées'}
            </span>
            <div className="text-2xl font-black text-[#281715] mt-0.5">
              {userProfile.totalViews}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#f0e4e2] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#7a5c58]">
              {isAr ? 'الرسائل والمحادثات' : isEn ? 'Inquiries Received' : 'Messages reçus'}
            </span>
            <div className="text-2xl font-black text-[#281715] mt-0.5">
              {userProfile.totalMessages}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#f2e6e4] pb-4">
        {[
          { id: 'ads', labelFr: `Mes annonces (${userProperties.length})`, labelAr: `إعلاناتي (${userProperties.length})`, labelEn: `My Listings (${userProperties.length})`, icon: PlusCircle },
          { id: 'stats', labelFr: 'Statistiques & Vues', labelAr: 'الإحصائيات والتفاعل', labelEn: 'Analytics & Views', icon: BarChart3 },
          { id: 'settings', labelFr: 'Paramètres du compte', labelAr: 'إعدادات الحساب', labelEn: 'Account Settings', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
                  : 'text-[#7a5c58] hover:bg-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isAr ? tab.labelAr : isEn ? tab.labelEn : tab.labelFr}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Mes Annonces Actives */}
      {activeTab === 'ads' && (
        <div className="space-y-4">
          {userProperties.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-[#f0e4e2] p-8">
              <p className="text-sm text-[#7a5c58]">
                {isAr ? 'لم تقم بنشر أي إعلان حتى الآن.' : isEn ? 'You do not have any active listings yet.' : 'Vous n’avez aucune annonce active.'}
              </p>
            </div>
          ) : (
            userProperties.map((prop) => (
              <div
                key={prop.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-[#f0e4e2] shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Thumb + Title */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <img
                    src={prop.images[0]}
                    alt=""
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-[#e8d5d3] flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(prop.status)}
                      <span className="text-xs text-[#99807d]">
                        {prop.dateAdded}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-extrabold text-[#281715] line-clamp-1">
                      {isAr ? prop.titleAr : isEn && prop.titleEn ? prop.titleEn : prop.titleFr}
                    </h3>

                    <div className="text-xs font-bold text-[#ff6f61]">
                      {isAr ? prop.priceFormattedAr : isEn && prop.priceFormattedEn ? prop.priceFormattedEn : prop.priceFormattedFr} • {prop.surface} m²
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#7a5c58] pt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-[#99807d]" />
                        {prop.viewsCount || 340} {isAr ? 'مشاهدة' : isEn ? 'views' : 'vues'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-[#99807d]" />
                        {prop.savedCount || 12} {isAr ? 'حفظ' : isEn ? 'saved' : 'favoris'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#f2e6e4]">
                  <button
                    onClick={() => onSelectProperty(prop)}
                    title={isAr ? 'معاينة الإعلان' : isEn ? 'View Listing' : 'Voir l’annonce'}
                    className="p-2.5 rounded-xl bg-[#fff8f7] text-[#281715] hover:bg-[#fff0ed] hover:text-[#ff6f61] border border-[#f0e4e2] cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onRenewProperty(prop.id)}
                    title={isAr ? 'تجديد الإعلان' : isEn ? 'Renew' : 'Renouveler'}
                    className="p-2.5 rounded-xl bg-[#fff8f7] text-[#059669] hover:bg-[#ecfdf5] border border-[#f0e4e2] cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteProperty(prop.id)}
                    title={isAr ? 'حذف الإعلان' : isEn ? 'Delete' : 'Supprimer'}
                    className="p-2.5 rounded-xl bg-[#fff8f7] text-[#dc2626] hover:bg-[#fef2f2] border border-[#f0e4e2] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Stats & Analytics */}
      {activeTab === 'stats' && (
        <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm space-y-6">
          <h2 className="text-lg font-extrabold text-[#281715]">
            {isAr ? 'تحليلات الأداء والمشاهدات' : isEn ? 'Listing Performance & Insights' : 'Performance globale de vos annonces'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
              <div className="text-xs font-bold text-[#7a5c58] mb-1">
                {isAr ? 'نسبة النقر والاهتمام' : isEn ? 'Conversion Rate' : 'Taux de conversion moyen'}
              </div>
              <div className="text-2xl font-black text-[#16a34a]">
                4.8%
              </div>
              <p className="text-[11px] text-[#99807d] mt-1">
                {isAr ? 'أعلى بنسبة 1.2% من متوسط السوق بالمغرب.' : isEn ? '+1.2% higher than Moroccan real estate market average.' : '+1.2% supérieur à la moyenne du marché marocain.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
              <div className="text-xs font-bold text-[#7a5c58] mb-1">
                {isAr ? 'المدينة الأكثر طلباً لإعلاناتك' : isEn ? 'Top Inquiring City' : 'Ville avec le plus d’interactions'}
              </div>
              <div className="text-2xl font-black text-[#ff6f61]">
                Casablanca
              </div>
              <p className="text-[11px] text-[#99807d] mt-1">
                {isAr ? 'حي المعاريف وأنفا يحققان 65% من الرسائل.' : isEn ? 'Maarif and Anfa generate 65% of incoming inquiries.' : 'Maarif et Anfa génèrent 65% des prises de contact.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm space-y-4 max-w-xl">
          <h2 className="text-lg font-extrabold text-[#281715]">
            {isAr ? 'إعدادات الحساب والإشعارات' : isEn ? 'Account & Notification Settings' : 'Paramètres du compte'}
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'الاسم الكامل' : isEn ? 'Full Name' : 'Nom complet'}
              </label>
              <input
                type="text"
                defaultValue={userProfile.name}
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5a4340] mb-1">
                {isAr ? 'رقم الهاتف (واتساب)' : isEn ? 'WhatsApp Phone Number' : 'Téléphone WhatsApp'}
              </label>
              <input
                type="text"
                defaultValue={userProfile.phone}
                className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
