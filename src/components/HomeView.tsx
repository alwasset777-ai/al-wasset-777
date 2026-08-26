import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  Home, 
  Building, 
  KeyRound, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  FileText, 
  Scale, 
  Award, 
  Heart,
  TrendingUp,
  Landmark
} from 'lucide-react';
import { Property, Language } from '../types';
import { moroccanCities } from '../data/mockData';

interface HomeViewProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onNavigate: (tab: string, filters?: { listingType?: string; city?: string; type?: string }) => void;
  language: Language;
  favorites: number[];
  onToggleFavorite: (id: number) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  properties,
  onSelectProperty,
  onNavigate,
  language,
  favorites,
  onToggleFavorite
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';

  const [activeSearchTab, setActiveSearchTab] = useState<'vente' | 'location' | 'neuf'>('vente');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [maxBudget, setMaxBudget] = useState('');

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate(activeSearchTab, {
      listingType: activeSearchTab,
      city: selectedCity && selectedCity !== 'Toutes les villes / جميع المدن' && selectedCity !== 'All cities' ? selectedCity : undefined,
      type: selectedType || undefined
    });
  };

  const propertyCategories = [
    {
      id: 'Appartement',
      labelFr: 'Appartements',
      labelAr: 'شقق سكنية',
      labelEn: 'Apartments',
      count: '1,840',
      icon: Building,
      img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'Villa',
      labelFr: 'Villas & Maisons',
      labelAr: 'فيلات ومنازل',
      labelEn: 'Villas & Houses',
      count: '620',
      icon: Home,
      img: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'Riad',
      labelFr: 'Riads de Charme',
      labelAr: 'رياضات تقليدية',
      labelEn: 'Authentic Riads',
      count: '145',
      icon: Landmark,
      img: 'https://images.unsplash.com/photo-1590073242678-70ee3fc28e8e?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'Terrain',
      labelFr: 'Terrains Titrés',
      labelAr: 'أراضي محفظة',
      labelEn: 'Titled Lands',
      count: '430',
      icon: MapPin,
      img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'Bureau',
      labelFr: 'Bureaux & Plateaux',
      labelAr: 'مكاتب ومقرات',
      labelEn: 'Offices & Commercial',
      count: '290',
      icon: KeyRound,
      img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'Local Commercial',
      labelFr: 'Commerces & Fonds',
      labelAr: 'محلات تجارية',
      labelEn: 'Retail & Shops',
      count: '310',
      icon: TrendingUp,
      img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80'
    }
  ];

  const featuredProperties = properties.slice(0, 4);

  return (
    <div className="space-y-16 pb-16">
      
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-[#281715] text-white shadow-2xl">
        {/* Background Image with Deep Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1800&q=80"
            alt="Moroccan Luxury Real Estate"
            className="w-full h-full object-cover opacity-35 filter saturate-120"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1c0e0d] via-[#281715]/80 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 sm:py-24 text-center sm:text-left">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[#ff8f82] text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'منصة العقارات رقم 1 بالمغرب' : isEn ? 'Leading Real Estate Portal in Morocco' : 'Portail Immobilier N°1 au Maroc'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-4">
            {isAr ? (
              <>
                ابحث عن عقار أحلامك في <span className="text-[#ff8f82]">أفضل مدن المغرب</span>
              </>
            ) : isEn ? (
              <>
                Find your dream property among <span className="text-[#ff8f82]">verified Moroccan listings</span>
              </>
            ) : (
              <>
                Trouvez le bien idéal parmi nos <span className="text-[#ff8f82]">annonces vérifiées</span>
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-[#e0cfcc] max-w-2xl mb-10 font-normal">
            {isAr
              ? 'شقق فاخرة، فيلات، أراضي محفظة، ومشاريع جديدة مع استشارات قانونية ونماذج عقود معتمدة.'
              : isEn
              ? 'Exceptional apartments, luxury villas with pool, titled lands and new development programs with legal and contractual assistance.'
              : 'Appartements d’exception, villas avec piscine, terrains titrés et programmes neufs avec assistance juridique intégrée.'}
          </p>

          {/* Search Box Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl text-[#281715] max-w-4xl border border-[#f0e4e2]">
            
            {/* Search Tabs: Acheter, Louer, Neuf */}
            <div className="flex items-center gap-2 border-b border-[#f2e6e4] pb-4 mb-5">
              {[
                { id: 'vente', labelFr: 'Acheter', labelAr: 'شراء', labelEn: 'Buy' },
                { id: 'location', labelFr: 'Louer', labelAr: 'كراء', labelEn: 'Rent' },
                { id: 'neuf', labelFr: 'Projets Neufs', labelAr: 'مشاريع جديدة', labelEn: 'New Projects' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSearchTab(tab.id as 'vente' | 'location' | 'neuf')}
                  className={`px-5 py-2 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                    activeSearchTab === tab.id
                      ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
                      : 'text-[#664d4a] hover:bg-[#fff8f7]'
                  }`}
                >
                  {isAr ? tab.labelAr : isEn ? tab.labelEn : tab.labelFr}
                </button>
              ))}
            </div>

            {/* Filter Fields */}
            <form onSubmit={handleHeroSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              
              {/* City Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#7a5c58] mb-1">
                  {isAr ? 'المدينة' : isEn ? 'City' : 'Ville'}
                </label>
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-xs font-semibold bg-[#fff8f7] rounded-xl border border-[#f0e4e2] focus:ring-2 focus:ring-[#ff6f61] focus:outline-none text-[#281715]"
                  >
                    {moroccanCities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <MapPin className="w-4 h-4 text-[#ff6f61] absolute left-2.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#7a5c58] mb-1">
                  {isAr ? 'نوع العقار' : isEn ? 'Property Type' : 'Type de bien'}
                </label>
                <div className="relative">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-xs font-semibold bg-[#fff8f7] rounded-xl border border-[#f0e4e2] focus:ring-2 focus:ring-[#ff6f61] focus:outline-none text-[#281715]"
                  >
                    <option value="">{isAr ? 'جميع الأنواع' : isEn ? 'All Types' : 'Tous types'}</option>
                    <option value="Appartement">Appartement / Apartment / شقة</option>
                    <option value="Villa">Villa / فيلا</option>
                    <option value="Riad">Riad / رياض</option>
                    <option value="Terrain">Terrain / Land / أرض</option>
                    <option value="Bureau">Bureau / Office / مكتب</option>
                    <option value="Local Commercial">Commerce / Commercial / محل</option>
                  </select>
                  <Building className="w-4 h-4 text-[#ff6f61] absolute left-2.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-[11px] font-bold text-[#7a5c58] mb-1">
                  {isAr ? 'الميزانية القصوى (MAD)' : isEn ? 'Max Budget (MAD)' : 'Budget Max (MAD)'}
                </label>
                <input
                  type="number"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="Ex: 2 500 000"
                  className="w-full px-3 py-2.5 text-xs font-semibold bg-[#fff8f7] rounded-xl border border-[#f0e4e2] focus:ring-2 focus:ring-[#ff6f61] focus:outline-none text-[#281715]"
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#281715] hover:bg-[#ff6f61] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer h-[38px]"
                >
                  <Search className="w-4 h-4" />
                  <span>{isAr ? 'بحث مخصص' : isEn ? 'Search Now' : 'Rechercher'}</span>
                </button>
              </div>

            </form>

          </div>

          {/* Key Moroccan Platform Guarantees */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-[#e8d5d3]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#ff8f82]" />
              <span>{isAr ? 'عقارات محفظة ومحققة' : isEn ? 'Verified Title Deeds' : 'Titres fonciers vérifiés'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#ff8f82]" />
              <span>{isAr ? 'مواكبة قانونية ونماذج عقود' : isEn ? 'Legal & Contract Support' : 'Accompagnement juridique'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#ff8f82]" />
              <span>{isAr ? 'أفضل الوكالات المعتمدة' : isEn ? 'Certified Partner Agencies' : 'Agences partenaires agréées'}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#ff8f82]" />
              <span>{isAr ? 'عقود بيع وكراء مطابقة للقانون' : isEn ? 'Compliant 39-08 & 67-12 Contracts' : 'Contrats conformes 39-08 & 67-12'}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Categories Grid */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight">
              {isAr ? 'استكشف حسب نوع العقار' : isEn ? 'Explore by Property Category' : 'Explorer par catégorie de bien'}
            </h2>
            <p className="text-sm text-[#7a5c58] mt-1">
              {isAr
                ? 'اختر الصنف المناسب لمتطلباتك وتصفح أفضل العروض المتاحة'
                : isEn
                ? 'Quickly find the property type tailored to your investment or living goals'
                : 'Trouvez rapidement le bien qui correspond à votre projet'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {propertyCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => onNavigate('vendre', { type: cat.id })}
                className="group p-4 bg-white rounded-2xl border border-[#f0e4e2] hover:border-[#ff6f61] hover:shadow-lg transition-all duration-200 text-left flex flex-col items-center sm:items-start cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-[#fff0ed] group-hover:bg-[#ff6f61] group-hover:text-white text-[#ff6f61] flex items-center justify-center mb-3 transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#281715] group-hover:text-[#ff6f61] transition-colors line-clamp-1">
                  {isAr ? cat.labelAr : isEn ? cat.labelEn : cat.labelFr}
                </h3>
                <span className="text-xs text-[#99807d] mt-0.5">
                  {cat.count} {isAr ? 'عرض' : isEn ? 'listings' : 'offres'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Featured Properties Section */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#ff6f61] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAr ? 'مختارات مميزة' : isEn ? 'Featured Listings' : 'Sélection Premium'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight">
              {isAr ? 'أحدث العروض الحصرية' : isEn ? 'Handpicked Exclusive Properties' : 'Les coups de cœur du moment'}
            </h2>
          </div>
          <button
            onClick={() => onNavigate('vendre')}
            className="flex items-center gap-1 text-xs sm:text-sm font-bold text-[#ff6f61] hover:text-[#e8584a] cursor-pointer"
          >
            <span>{isAr ? 'عرض جميع الإعلانات' : isEn ? 'View all listings' : 'Voir tout le catalogue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProperties.map((prop) => {
            const isFav = favorites.includes(prop.id);
            return (
              <div
                key={prop.id}
                onClick={() => onSelectProperty(prop)}
                className="group bg-white rounded-2xl border border-[#f0e4e2] overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Image Container */}
                <div className="relative h-48 w-full overflow-hidden bg-[#e8d5d3]">
                  <img
                    src={prop.images[0]}
                    alt={prop.titleFr}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>

                  {/* Badge */}
                  {prop.badge && (
                    <div className="absolute top-3 left-3 bg-[#ff6f61] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                      {prop.badge}
                    </div>
                  )}

                  {/* Type tag */}
                  <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-[#281715] text-xs font-bold px-2.5 py-0.5 rounded-md">
                    {prop.type}
                  </div>

                  {/* Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(prop.id);
                    }}
                    className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                      isFav 
                        ? 'bg-[#ff6f61] text-white border-transparent' 
                        : 'bg-white/80 text-[#281715] border-white/40 hover:bg-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#ff6f61] mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{prop.district}, {prop.city}</span>
                    </div>

                    <h3 className="text-sm font-bold text-[#281715] line-clamp-2 group-hover:text-[#ff6f61] transition-colors mb-2">
                      {isAr ? prop.titleAr : isEn && prop.titleEn ? prop.titleEn : prop.titleFr}
                    </h3>
                  </div>

                  <div>
                    {/* Specs */}
                    <div className="flex items-center gap-3 text-xs text-[#7a5c58] py-2 border-t border-[#f2e6e4] mb-3">
                      <span className="font-semibold">{prop.surface} m²</span>
                      {prop.bedrooms > 0 && (
                        <span>• {prop.bedrooms} {isAr ? 'غرف' : isEn ? 'beds' : 'ch.'}</span>
                      )}
                      {prop.bathrooms > 0 && (
                        <span>• {prop.bathrooms} {isAr ? 'حمامات' : isEn ? 'baths' : 'sdb'}</span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-base font-extrabold text-[#281715]">
                        {isAr ? prop.priceFormattedAr : isEn && prop.priceFormattedEn ? prop.priceFormattedEn : prop.priceFormattedFr}
                      </div>
                      <span className="text-[11px] font-bold text-[#ff6f61] group-hover:underline">
                        {isAr ? 'التفاصيل' : isEn ? 'Details →' : 'Détails →'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legal Hub Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-[#fff0ed] to-[#ffe5e0] border border-[#ffd8d2] p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-sm">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#ff6f61] text-xs font-bold mb-3 shadow-xs">
            <Scale className="w-3.5 h-3.5" />
            <span>{isAr ? 'الفضاء القانوني ونماذج العقود' : isEn ? 'Legal Center & Contract Templates' : 'Espace Juridique & Modèles d’Actes'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight mb-2">
            {isAr
              ? 'عقود بيع وكراء وتوكيلات معتمدة ومطابقة للقانون المغربي'
              : isEn
              ? 'Official Contract Templates & Certified Tax Guides'
              : 'Modèles d’actes officiels & Guides fiscaux certifiés'}
          </h2>
          <p className="text-sm text-[#7a5c58] leading-relaxed">
            {isAr
              ? 'حمّل نماذج عقود الوعد بالبيع (39-08)، عقود الكراء السكني والتجاري (67-12)، واطلع على تفاصيل الضرائب العقارية ورسوم التحفيظ والتسجيل.'
              : isEn
              ? 'Download ready-to-use promise of sale contracts (Law 39-08), residential/commercial leases (Law 67-12), and discover Moroccan property tax & conservation guides.'
              : 'Téléchargez gratuitement vos modèles de compromis de vente, contrats de bail conformes à la loi 67-12, actes de cession et guides de fiscalité immobilière marocaine.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button
            onClick={() => onNavigate('legal')}
            className="px-6 py-3.5 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white text-sm font-bold shadow-md shadow-[#ff6f61]/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{isAr ? 'تصفح النماذج والقوانين' : isEn ? 'Explore Legal Hub' : 'Consulter l’Espace Juridique'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
