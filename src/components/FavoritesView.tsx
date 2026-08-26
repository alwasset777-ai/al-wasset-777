import React, { useState } from 'react';
import { Heart, Trash2, ArrowRight, Building, MapPin, Maximize2 } from 'lucide-react';
import { Property, Language } from '../types';

interface FavoritesViewProps {
  properties: Property[];
  favoriteIds: number[];
  onToggleFavorite: (id: number) => void;
  onSelectProperty: (property: Property) => void;
  onExplore: () => void;
  language: Language;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  properties,
  favoriteIds,
  onToggleFavorite,
  onSelectProperty,
  onExplore,
  language
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const [activeTab, setActiveTab] = useState<'vente' | 'location'>('vente');

  const favoriteProperties = properties.filter((p) => favoriteIds.includes(p.id));
  
  const venteFavorites = favoriteProperties.filter((p) => p.listingType === 'vente' || p.listingType === 'neuf');
  const locationFavorites = favoriteProperties.filter((p) => p.listingType === 'location');

  const displayedList = activeTab === 'vente' ? venteFavorites : locationFavorites;

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header */}
      <div className="border-b border-[#f2e6e4] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#ff6f61] uppercase tracking-wider mb-1">
            <Heart className="w-4 h-4 fill-current" />
            <span>{isAr ? 'قائمتي الخاصة' : isEn ? 'My Saved Collection' : 'Ma sélection'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight">
            {isAr ? 'مفضلاتي العقارية' : isEn ? 'Saved Properties' : 'Mes Favoris'}
          </h1>
          <p className="text-xs sm:text-sm text-[#7a5c58] mt-1">
            {favoriteProperties.length} {isAr ? 'عقارات تم حفظها للمقارنة والمتابعة' : isEn ? 'properties saved for quick review and comparison' : 'biens enregistrés pour consultation ultérieure'}
          </p>
        </div>

        {/* Tab Switcher: À Vendre / À Louer */}
        <div className="flex items-center p-1 bg-[#fff0ed] rounded-2xl border border-[#ffd8d2]">
          <button
            onClick={() => setActiveTab('vente')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'vente'
                ? 'bg-white text-[#ff6f61] shadow-sm'
                : 'text-[#7a5c58] hover:text-[#281715]'
            }`}
          >
            {isAr ? `للبيع (${venteFavorites.length})` : isEn ? `For Sale (${venteFavorites.length})` : `À Vendre (${venteFavorites.length})`}
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'location'
                ? 'bg-white text-[#ff6f61] shadow-sm'
                : 'text-[#7a5c58] hover:text-[#281715]'
            }`}
          >
            {isAr ? `للكراء (${locationFavorites.length})` : isEn ? `For Rent (${locationFavorites.length})` : `À Louer (${locationFavorites.length})`}
          </button>
        </div>
      </div>

      {/* Content */}
      {displayedList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#f0e4e2] p-8 space-y-4 max-w-xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#281715]">
            {isAr ? 'لا توجد عقارات محفوظة في هذه الفئة' : isEn ? 'No saved properties in this category' : 'Aucun bien dans vos favoris'}
          </h3>
          <p className="text-xs text-[#7a5c58]">
            {isAr
              ? 'تصفح قائمة العقارات المتاحة واضغط على رمز القلب لإضافتها إلى قائمتك المفضلة.'
              : isEn
              ? 'Browse our listings and click the heart icon on any property to save it to your list.'
              : 'Explorez nos annonces et cliquez sur le cœur pour sauvegarder vos biens préférés et les retrouver facilement.'}
          </p>
          <button
            onClick={onExplore}
            className="px-6 py-3 rounded-xl bg-[#ff6f61] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#ff6f61]/25 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>{isAr ? 'استكشف العروض' : isEn ? 'Explore Listings' : 'Explorer les annonces'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedList.map((prop) => (
            <div
              key={prop.id}
              onClick={() => onSelectProperty(prop)}
              className="group bg-white rounded-2xl border border-[#f0e4e2] overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
            >
              <div className="relative h-48 w-full overflow-hidden bg-[#e8d5d3]">
                <img
                  src={prop.images[0]}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>

                <div className="absolute top-3 left-3 bg-[#ff6f61] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  {prop.type}
                </div>

                {/* Remove from favorites button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(prop.id);
                  }}
                  title={isAr ? 'حذف من المفضلة' : isEn ? 'Remove from favorites' : 'Retirer des favoris'}
                  className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-[#ef4444] hover:bg-white transition-all shadow-md cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

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
                  <div className="flex items-center gap-3 text-xs text-[#7a5c58] py-2 border-t border-[#f2e6e4] mb-3">
                    <div className="flex items-center gap-1 font-semibold">
                      <Maximize2 className="w-3.5 h-3.5 text-[#ff6f61]" />
                      <span>{prop.surface} m²</span>
                    </div>
                    {prop.bedrooms > 0 && (
                      <span>• {prop.bedrooms} {isAr ? 'غرف' : isEn ? 'bd.' : 'ch.'}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-base font-extrabold text-[#281715]">
                      {isAr ? prop.priceFormattedAr : isEn && prop.priceFormattedEn ? prop.priceFormattedEn : prop.priceFormattedFr}
                    </div>
                    <span className="text-[11px] font-bold text-[#ff6f61]">
                      {isAr ? 'تفاصيل ←' : isEn ? 'Details →' : 'Détails →'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
