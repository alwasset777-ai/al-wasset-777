import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  LayoutGrid, 
  Map as MapIcon, 
  RotateCcw, 
  SlidersHorizontal, 
  Heart, 
  MapPin, 
  Building, 
  BedDouble, 
  Bath, 
  Maximize2,
  ChevronDown
} from 'lucide-react';
import { Property, Language, ListingType, PropertyType } from '../types';
import { moroccanCities } from '../data/mockData';
import { MapView } from './MapView';

interface ListingsViewProps {
  properties: Property[];
  listingType?: ListingType;
  initialFilters?: { listingType?: string; city?: string; type?: string };
  onSelectProperty: (property: Property) => void;
  language: Language;
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  searchQuery?: string;
}

export const ListingsView: React.FC<ListingsViewProps> = ({
  properties,
  listingType,
  initialFilters,
  onSelectProperty,
  language,
  favorites,
  onToggleFavorite,
  searchQuery = ''
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';

  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Filters State
  const [selectedCity, setSelectedCity] = useState<string>(initialFilters?.city || '');
  const [selectedType, setSelectedType] = useState<string>(initialFilters?.type || '');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minSurface, setMinSurface] = useState<string>('');
  const [bedroomsFilter, setBedroomsFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'surface_desc'>('newest');
  const [selectedMapProperty, setSelectedMapProperty] = useState<Property | null>(null);

  const resetFilters = () => {
    setSelectedCity('');
    setSelectedType('');
    setMinPrice('');
    setMaxPrice('');
    setMinSurface('');
    setBedroomsFilter(null);
    setSortBy('newest');
  };

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties.filter((item) => {
      // Listing type match if specified
      if (listingType && item.listingType !== listingType) {
        return false;
      }
      // City filter
      if (selectedCity && selectedCity !== 'Toutes les villes / جميع المدن' && selectedCity !== 'All cities' && item.city !== selectedCity) {
        return false;
      }
      // Type filter
      if (selectedType && item.type !== selectedType) {
        return false;
      }
      // Min Price
      if (minPrice && item.price < parseFloat(minPrice)) {
        return false;
      }
      // Max Price
      if (maxPrice && item.price > parseFloat(maxPrice)) {
        return false;
      }
      // Min Surface
      if (minSurface && item.surface < parseFloat(minSurface)) {
        return false;
      }
      // Bedrooms
      if (bedroomsFilter !== null && item.bedrooms < bedroomsFilter) {
        return false;
      }
      // Text Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.titleFr.toLowerCase().includes(query) || 
                             item.titleAr.toLowerCase().includes(query) || 
                             (item.titleEn && item.titleEn.toLowerCase().includes(query));
        const matchesCity = item.city.toLowerCase().includes(query) || item.district.toLowerCase().includes(query);
        const matchesType = item.type.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCity && !matchesType) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'surface_desc') return b.surface - a.surface;
      return b.id - a.id;
    });
  }, [properties, listingType, selectedCity, selectedType, minPrice, maxPrice, minSurface, bedroomsFilter, sortBy, searchQuery]);

  const pageTitle = () => {
    if (listingType === 'vente') return isAr ? 'عقارات للبيع في المغرب' : isEn ? 'Properties for Sale in Morocco' : 'Biens Immobiliers à Vendre au Maroc';
    if (listingType === 'location') return isAr ? 'عقارات للكراء في المغرب' : isEn ? 'Properties for Rent in Morocco' : 'Biens Immobiliers à Louer au Maroc';
    if (listingType === 'neuf') return isAr ? 'المشاريع العقارية الجديدة' : isEn ? 'New Development Projects in Morocco' : 'Programmes et Projets Neufs au Maroc';
    return isAr ? 'جميع العقارات المعروضة' : isEn ? 'All Morocco Property Listings' : 'Toutes les annonces immobilières';
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#f2e6e4] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight">
            {pageTitle()}
          </h1>
          <p className="text-xs sm:text-sm text-[#7a5c58] mt-1">
            {filteredProperties.length} {isAr ? 'عقار متوفر ومطابق لمعايير البحث' : isEn ? 'verified listings match your criteria' : 'annonces disponibles et vérifiées'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden px-3 py-2 rounded-xl bg-white border border-[#f0e4e2] text-xs font-bold text-[#281715] flex items-center gap-2 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#ff6f61]" />
            <span>{isAr ? 'تصفية' : isEn ? 'Filters' : 'Filtres'}</span>
          </button>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none bg-white pl-3 pr-8 py-2 text-xs font-bold rounded-xl border border-[#f0e4e2] text-[#281715] focus:outline-none focus:ring-2 focus:ring-[#ff6f61]"
            >
              <option value="newest">{isAr ? 'الأحدث أولاً' : isEn ? 'Newest first' : 'Plus récents'}</option>
              <option value="price_asc">{isAr ? 'السعر: من الأقل للأعلى' : isEn ? 'Price: Low to High' : 'Prix : croissant'}</option>
              <option value="price_desc">{isAr ? 'السعر: من الأعلى للأقل' : isEn ? 'Price: High to Low' : 'Prix : décroissant'}</option>
              <option value="surface_desc">{isAr ? 'المساحة: الأكبر أولاً' : isEn ? 'Surface: Largest first' : 'Surface : plus grande'}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#99807d] absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Grid / Map Switcher */}
          <div className="flex items-center p-1 bg-[#fff0ed] rounded-xl border border-[#ffd8d2]">
            <button
              onClick={() => setViewMode('grid')}
              title={isAr ? 'عرض البطاقات' : isEn ? 'Grid View' : 'Vue Grille'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-[#ff6f61] shadow-xs' : 'text-[#7a5c58] hover:text-[#281715]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              title={isAr ? 'عرض الخريطة' : isEn ? 'Map View' : 'Vue Carte'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'map' ? 'bg-white text-[#ff6f61] shadow-xs' : 'text-[#7a5c58] hover:text-[#281715]'
              }`}
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Filters Sidebar (Desktop + Mobile overlay) */}
        <div className={`lg:block ${showMobileFilters ? 'block' : 'hidden'} lg:col-span-1 space-y-6`}>
          <div className="bg-white rounded-2xl p-5 border border-[#f0e4e2] shadow-sm space-y-5 sticky top-24">
            
            <div className="flex items-center justify-between border-b border-[#f2e6e4] pb-3">
              <div className="flex items-center gap-2 font-extrabold text-sm text-[#281715]">
                <Filter className="w-4 h-4 text-[#ff6f61]" />
                <span>{isAr ? 'معايير البحث' : isEn ? 'Search Filters' : 'Filtres de recherche'}</span>
              </div>
              <button
                onClick={resetFilters}
                className="text-[11px] text-[#ff6f61] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isAr ? 'إعادة ضبط' : isEn ? 'Reset' : 'Réinitialiser'}</span>
              </button>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-[#5a4340] mb-1.5">
                {isAr ? 'المدينة' : isEn ? 'City' : 'Ville'}
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-[#fff8f7] rounded-xl border border-[#f0e4e2] focus:ring-2 focus:ring-[#ff6f61] text-[#281715]"
              >
                {moroccanCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Property Type */}
            <div>
              <label className="block text-xs font-bold text-[#5a4340] mb-1.5">
                {isAr ? 'نوع العقار' : isEn ? 'Property Type' : 'Type de propriété'}
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-[#fff8f7] rounded-xl border border-[#f0e4e2] focus:ring-2 focus:ring-[#ff6f61] text-[#281715]"
              >
                <option value="">{isAr ? 'جميع الأنواع' : isEn ? 'All Types' : 'Tous types'}</option>
                <option value="Appartement">Appartement / Apartment / شقة</option>
                <option value="Villa">Villa / فيلا</option>
                <option value="Riad">Riad / رياض</option>
                <option value="Terrain">Terrain / Land / أرض</option>
                <option value="Bureau">Bureau / Office / مكتب</option>
                <option value="Local Commercial">Commerce / Commercial / محل</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-xs font-bold text-[#5a4340] mb-1.5">
                {isAr ? 'السعر (درهم مغربي)' : isEn ? 'Budget (MAD)' : 'Budget (MAD)'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder={isAr ? 'الحد الأدنى' : isEn ? 'Min' : 'Min'}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
                />
                <input
                  type="number"
                  placeholder={isAr ? 'الحد الأقصى' : isEn ? 'Max' : 'Max'}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
                />
              </div>
            </div>

            {/* Surface Min */}
            <div>
              <label className="block text-xs font-bold text-[#5a4340] mb-1.5">
                {isAr ? 'المساحة الدنيا (م²)' : isEn ? 'Min Surface (m²)' : 'Surface Min (m²)'}
              </label>
              <input
                type="number"
                placeholder="Ex: 80"
                value={minSurface}
                onChange={(e) => setMinSurface(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
              />
            </div>

            {/* Bedrooms Count */}
            <div>
              <label className="block text-xs font-bold text-[#5a4340] mb-1.5">
                {isAr ? 'عدد غرف النوم' : isEn ? 'Bedrooms' : 'Chambres'}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBedroomsFilter(bedroomsFilter === num ? null : num)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      bedroomsFilter === num
                        ? 'bg-[#ff6f61] text-white border-transparent'
                        : 'bg-[#fff8f7] text-[#5a4340] border-[#f0e4e2] hover:bg-[#fff0ed]'
                    }`}
                  >
                    {num}{num === 4 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Listings Display (Grid or Map) */}
        <div className="lg:col-span-3">
          {viewMode === 'map' ? (
            <div className="space-y-6">
              <MapView
                properties={filteredProperties}
                selectedProperty={selectedMapProperty}
                onSelectProperty={(p) => {
                  setSelectedMapProperty(p);
                  onSelectProperty(p);
                }}
                language={language}
                height="600px"
              />
            </div>
          ) : (
            <div>
              {filteredProperties.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-[#f0e4e2] p-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center mx-auto">
                    <Building className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-[#281715]">
                    {isAr ? 'لم نتمكن من العثور على عقارات مطابقة' : isEn ? 'No properties found matching your criteria' : 'Aucun bien trouvé pour ces critères'}
                  </h3>
                  <p className="text-xs text-[#7a5c58] max-w-sm mx-auto">
                    {isAr
                      ? 'يرجى تجربة تعديل السعر أو اختيار مدينة أخرى لإظهار المزيد من الإعلانات.'
                      : isEn
                      ? 'Try adjusting your budget range or selecting another city to see more available listings.'
                      : 'Essayez d’élargir vos filtres de recherche ou de réinitialiser vos critères.'}
                  </p>
                  <button
                    onClick={resetFilters}
                    className="px-5 py-2.5 rounded-xl bg-[#ff6f61] text-white text-xs font-bold shadow-md cursor-pointer"
                  >
                    {isAr ? 'مسح الفلاتر' : isEn ? 'Reset Filters' : 'Réinitialiser les filtres'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredProperties.map((prop) => {
                    const isFav = favorites.includes(prop.id);
                    return (
                      <div
                        key={prop.id}
                        onClick={() => onSelectProperty(prop)}
                        className="group bg-white rounded-2xl border border-[#f0e4e2] overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
                      >
                        {/* Image Header */}
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
                            <div className="absolute top-3 left-3 bg-[#ff6f61] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                              {prop.badge}
                            </div>
                          )}

                          {/* Listing Type Tag */}
                          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-[#281715] text-[11px] font-bold px-2 py-0.5 rounded-md">
                            {prop.type} • {prop.listingType === 'location' ? (isAr ? 'كراء' : isEn ? 'Rent' : 'Location') : (isAr ? 'بيع' : isEn ? 'Sale' : 'Vente')}
                          </div>

                          {/* Favorite button */}
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

                        {/* Card Info */}
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
                            {/* Specs row */}
                            <div className="flex items-center gap-3 text-xs text-[#7a5c58] py-2 border-t border-[#f2e6e4] mb-3">
                              <div className="flex items-center gap-1 font-semibold">
                                <Maximize2 className="w-3.5 h-3.5 text-[#ff6f61]" />
                                <span>{prop.surface} m²</span>
                              </div>
                              {prop.bedrooms > 0 && (
                                <div className="flex items-center gap-1">
                                  <BedDouble className="w-3.5 h-3.5 text-[#99807d]" />
                                  <span>{prop.bedrooms} {isAr ? 'غرف' : isEn ? 'beds' : 'ch.'}</span>
                                </div>
                              )}
                              {prop.bathrooms > 0 && (
                                <div className="flex items-center gap-1">
                                  <Bath className="w-3.5 h-3.5 text-[#99807d]" />
                                  <span>{prop.bathrooms} {isAr ? 'حمامات' : isEn ? 'baths' : 'sdb'}</span>
                                </div>
                              )}
                            </div>

                            {/* Price & Action */}
                            <div className="flex items-center justify-between pt-1">
                              <div>
                                <div className="text-base font-extrabold text-[#281715]">
                                  {isAr ? prop.priceFormattedAr : isEn && prop.priceFormattedEn ? prop.priceFormattedEn : prop.priceFormattedFr}
                                </div>
                                {prop.pricePerSqm && (
                                  <div className="text-[10px] text-[#99807d]">
                                    {prop.pricePerSqm.toLocaleString()} MAD/m²
                                  </div>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-[#ff6f61] group-hover:underline">
                                {isAr ? 'عرض الإعلان' : isEn ? 'View Listing →' : 'Consulter →'}
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
