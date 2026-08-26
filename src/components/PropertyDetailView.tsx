import React, { useState } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Heart, 
  Share2, 
  Phone, 
  MessageCircle, 
  Calendar, 
  Maximize2, 
  BedDouble, 
  Bath, 
  Building, 
  ShieldCheck, 
  Check, 
  Star, 
  Car, 
  Sparkles,
  Send,
  Layers,
  Clock,
  Printer,
  ChevronRight,
  Eye,
  Camera
} from 'lucide-react';
import { Property, Language } from '../types';
import { MapView } from './MapView';

interface PropertyDetailViewProps {
  property: Property;
  onBack: () => void;
  language: Language;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  onStartChat: (property: Property) => void;
  onScheduleVisit: (property: Property) => void;
  similarProperties: Property[];
  onSelectProperty: (property: Property) => void;
}

export const PropertyDetailView: React.FC<PropertyDetailViewProps> = ({
  property,
  onBack,
  language,
  isFavorite,
  onToggleFavorite,
  onStartChat,
  onScheduleVisit,
  similarProperties,
  onSelectProperty
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showAllPhotosModal, setShowAllPhotosModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const getTitle = () => {
    if (isAr) return property.titleAr;
    if (isEn && property.titleEn) return property.titleEn;
    return property.titleFr;
  };

  const getDescription = () => {
    if (isAr) return property.descriptionAr;
    if (isEn && property.descriptionEn) return property.descriptionEn;
    return property.descriptionFr;
  };

  const getPriceFormatted = () => {
    if (isAr) return property.priceFormattedAr;
    if (isEn && property.priceFormattedEn) return property.priceFormattedEn;
    return property.priceFormattedFr;
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsApp = () => {
    const text = isAr 
      ? `السلام عليكم، أنا مهتم بالإعلان: ${property.titleAr} (${property.priceFormattedAr}) الكائن بـ ${property.district}، ${property.city}.`
      : isEn
      ? `Hello, I am interested in the listing: ${property.titleEn || property.titleFr} (${property.priceFormattedEn || property.priceFormattedFr}) in ${property.district}, ${property.city}.`
      : `Bonjour, je suis intéressé par l'annonce : ${property.titleFr} (${property.priceFormattedFr}) à ${property.district}, ${property.city}.`;
    const url = `https://api.whatsapp.com/send?phone=${property.agent.whatsapp.replace(/\+/g, '')}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Breadcrumb & Back Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f2e6e4] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#f0e4e2] text-xs font-bold text-[#281715] hover:bg-[#fff0ed] hover:text-[#ff6f61] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isAr ? 'العودة للنتائج' : isEn ? 'Back to listings' : 'Retour aux annonces'}</span>
        </button>

        {/* Action buttons (Share, Favorite, Print) */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#f0e4e2] text-xs font-bold text-[#5a4340] hover:bg-[#fff0ed] hover:text-[#ff6f61] transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{copiedLink ? (isAr ? 'تم النسخ!' : isEn ? 'Copied!' : 'Copié !') : (isAr ? 'مشاركة' : isEn ? 'Share' : 'Partager')}</span>
          </button>

          <button
            onClick={() => onToggleFavorite(property.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              isFavorite
                ? 'bg-[#fff0ed] text-[#ff6f61] border-[#ffd8d2]'
                : 'bg-white text-[#5a4340] border-[#f0e4e2] hover:bg-[#fff0ed]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            <span>{isFavorite ? (isAr ? 'في المفضلة' : isEn ? 'Saved' : 'Sauvegardé') : (isAr ? 'حفظ' : isEn ? 'Save' : 'Favoris')}</span>
          </button>
        </div>
      </div>

      {/* Main Title & Price Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {property.badge && (
              <span className="px-2.5 py-0.5 rounded-md bg-[#ff6f61] text-white text-[11px] font-black uppercase tracking-wider">
                {property.badge}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-md bg-[#281715] text-white text-[11px] font-bold">
              {property.type}
            </span>
            <span className="text-xs text-[#7a5c58] flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#ff6f61]" />
              {property.district}, {property.city}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#281715] tracking-tight">
            {getTitle()}
          </h1>
          <p className="text-xs text-[#99807d]">
            {property.address}
          </p>
        </div>

        <div className="bg-[#fff0ed] border border-[#ffd8d2] p-4 rounded-2xl flex flex-col items-start lg:items-end justify-center">
          <span className="text-xs font-semibold text-[#7a5c58]">
            {property.listingType === 'location' ? (isAr ? 'السومة الكرائية' : isEn ? 'Monthly Rent' : 'Loyer mensuel') : (isAr ? 'ثمن البيع الإجمالي' : isEn ? 'Selling Price' : 'Prix de vente')}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#ff6f61]">
            {getPriceFormatted()}
          </div>
          {property.pricePerSqm && (
            <span className="text-xs text-[#7a5c58] font-bold">
              {property.pricePerSqm.toLocaleString()} MAD / m²
            </span>
          )}
        </div>
      </div>

      {/* Interactive Photo Gallery */}
      <div className="space-y-3">
        <div className="relative h-[320px] sm:h-[460px] w-full rounded-3xl overflow-hidden bg-[#e8d5d3] shadow-md">
          <img
            src={property.images[activeImageIndex] || property.images[0]}
            alt={property.titleFr}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />

          {/* View all photos trigger */}
          <button
            onClick={() => setShowAllPhotosModal(true)}
            className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/85 text-white backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg"
          >
            <Camera className="w-4 h-4" />
            <span>{isAr ? `عرض الصور (${property.images.length})` : isEn ? `All Photos (${property.images.length})` : `Toutes les photos (${property.images.length})`}</span>
          </button>
        </div>

        {/* Thumbnail Row */}
        {property.images.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {property.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`relative w-24 h-16 sm:w-32 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                  activeImageIndex === idx ? 'border-[#ff6f61] scale-102 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Grid: Left Details & Right Agent Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Key Specs Card Grid */}
          <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm">
            <h2 className="text-lg font-bold text-[#281715] mb-4">
              {isAr ? 'الخصائص والمواصفات الرئيسية' : isEn ? 'Key Specifications' : 'Caractéristiques principales'}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
                <div className="text-xs text-[#7a5c58] flex items-center gap-1 mb-1 font-semibold">
                  <Maximize2 className="w-4 h-4 text-[#ff6f61]" />
                  <span>{isAr ? 'المساحة' : isEn ? 'Surface Area' : 'Surface'}</span>
                </div>
                <div className="text-base font-black text-[#281715]">
                  {property.surface} m²
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
                <div className="text-xs text-[#7a5c58] flex items-center gap-1 mb-1 font-semibold">
                  <BedDouble className="w-4 h-4 text-[#ff6f61]" />
                  <span>{isAr ? 'الغرف' : isEn ? 'Bedrooms' : 'Chambres'}</span>
                </div>
                <div className="text-base font-black text-[#281715]">
                  {property.bedrooms || '-'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
                <div className="text-xs text-[#7a5c58] flex items-center gap-1 mb-1 font-semibold">
                  <Bath className="w-4 h-4 text-[#ff6f61]" />
                  <span>{isAr ? 'الحمامات' : isEn ? 'Bathrooms' : 'Salles de bain'}</span>
                </div>
                <div className="text-base font-black text-[#281715]">
                  {property.bathrooms || '-'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
                <div className="text-xs text-[#7a5c58] flex items-center gap-1 mb-1 font-semibold">
                  <Building className="w-4 h-4 text-[#ff6f61]" />
                  <span>{isAr ? 'الطابق' : isEn ? 'Floor' : 'Étage'}</span>
                </div>
                <div className="text-base font-black text-[#281715]">
                  {property.floor || 'RDC'}
                </div>
              </div>
            </div>

            {/* Additional Spec details row */}
            <div className="mt-6 pt-6 border-t border-[#f2e6e4] grid grid-cols-2 sm:grid-cols-3 gap-y-3 text-xs">
              <div>
                <span className="text-[#7a5c58] block">{isAr ? 'المصعد:' : isEn ? 'Elevator:' : 'Ascenseur :'}</span>
                <span className="font-bold text-[#281715]">{property.hasElevator ? (isAr ? 'متوفر' : isEn ? 'Yes' : 'Oui') : (isAr ? 'غير متوفر' : isEn ? 'No' : 'Non')}</span>
              </div>
              <div>
                <span className="text-[#7a5c58] block">{isAr ? 'موقف سيارات:' : isEn ? 'Parking Space:' : 'Place de parking :'}</span>
                <span className="font-bold text-[#281715]">{property.hasParking ? (isAr ? `نعم (${property.parkingSize || 12} م²)` : isEn ? `Titled (${property.parkingSize || 12} sqm)` : `Titrée (${property.parkingSize || 12} m²)`) : (isAr ? 'غير متوفر' : isEn ? 'No' : 'Non')}</span>
              </div>
              <div>
                <span className="text-[#7a5c58] block">{isAr ? 'واجبات السنديك:' : isEn ? 'HOA / Syndic Fee:' : 'Frais de syndic :'}</span>
                <span className="font-bold text-[#281715]">{property.syndicFee ? `${property.syndicFee} MAD / ${isAr ? 'شهر' : isEn ? 'month' : 'mois'}` : (isAr ? 'بدون' : isEn ? 'None / Included' : 'Inclus / Néant')}</span>
              </div>
              <div>
                <span className="text-[#7a5c58] block">{isAr ? 'تاريخ البناء:' : isEn ? 'Year Built:' : 'Année de construction :'}</span>
                <span className="font-bold text-[#281715]">{property.yearBuilt || '2022'}</span>
              </div>
              <div>
                <span className="text-[#7a5c58] block">{isAr ? 'الفرش:' : isEn ? 'Furnished:' : 'Ameublement :'}</span>
                <span className="font-bold text-[#281715]">{property.isFurnished ? (isAr ? 'مفروش' : isEn ? 'Furnished' : 'Meublé') : (isAr ? 'غير مفروش' : isEn ? 'Unfurnished' : 'Non meublé')}</span>
              </div>
              <div>
                <span className="text-[#7a5c58] block">{isAr ? 'حالة الملكية:' : isEn ? 'Land Registry Status:' : 'Statut foncier :'}</span>
                <span className="font-bold text-[#281715] text-[#16a34a]">{isAr ? 'محفظ ومسجل' : isEn ? 'Titled (ANCFCC)' : 'Titré (ANCFCC)'}</span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#281715]">
              {isAr ? 'وصف العقار' : isEn ? 'Property Description' : 'Description du bien'}
            </h2>
            <p className="text-sm text-[#5a4340] leading-relaxed whitespace-pre-line">
              {getDescription()}
            </p>
          </div>

          {/* Amenities & Equipments */}
          <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#281715]">
              {isAr ? 'التجهيزات والمميزات' : isEn ? 'Features & Amenities' : 'Équipements et prestations'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {property.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-[#281715] p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2]">
                  <div className="w-5 h-5 rounded-full bg-[#ff6f61]/15 text-[#ff6f61] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Map */}
          <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#281715] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#ff6f61]" />
                <span>{isAr ? 'الموقع الجغرافي والحي' : isEn ? 'Location & Neighborhood' : 'Localisation géographique'}</span>
              </h2>
              <span className="text-xs font-semibold text-[#7a5c58]">{property.district}, {property.city}</span>
            </div>
            
            <MapView
              properties={[property]}
              selectedProperty={property}
              onSelectProperty={() => {}}
              language={language}
              center={[property.lat, property.lng]}
              zoom={14}
              height="300px"
            />
          </div>

        </div>

        {/* Right Column: Agent Contact Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-md sticky top-24 space-y-6">
            
            {/* Agent Profile */}
            <div className="flex items-center gap-4 border-b border-[#f2e6e4] pb-5">
              <img
                src={property.agent.avatar}
                alt={property.agent.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-[#ff6f61]"
                referrerPolicy="no-referrer"
              />
              <div>
                <h3 className="text-base font-extrabold text-[#281715]">
                  {property.agent.name}
                </h3>
                <p className="text-xs text-[#7a5c58] font-medium">
                  {property.agent.agency}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs font-bold text-[#ff6f61]">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{property.agent.rating}</span>
                  <span className="text-[#99807d]">({property.agent.reviewCount} {isAr ? 'تقييم' : isEn ? 'reviews' : 'avis'})</span>
                </div>
              </div>
            </div>

            {/* Direct Contact Actions */}
            <div className="space-y-3">
              
              {/* WhatsApp Button */}
              <button
                onClick={handleWhatsApp}
                className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20b858] text-white text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isAr ? 'مراسلة عبر واتساب' : isEn ? 'Chat on WhatsApp' : 'Contacter sur WhatsApp'}</span>
              </button>

              {/* Instant Chat Trigger */}
              <button
                onClick={() => onStartChat(property)}
                className="w-full py-3 px-4 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#ff6f61]/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>{isAr ? 'إرسال رسالة مباشرة' : isEn ? 'Send Direct Message' : 'Envoyer un message'}</span>
              </button>

              {/* Schedule a Visit */}
              <button
                onClick={() => onScheduleVisit(property)}
                className="w-full py-3 px-4 rounded-xl bg-[#fff0ed] hover:bg-[#ffe5e0] text-[#ff6f61] border border-[#ffd8d2] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Calendar className="w-4 h-4" />
                <span>{isAr ? 'حجز موعد زيارة' : isEn ? 'Schedule a Visit' : 'Demander une visite'}</span>
              </button>

              {/* Phone Call */}
              <a
                href={`tel:${property.agent.phone}`}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#fff8f7] text-[#281715] border border-[#f0e4e2] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-4 h-4 text-[#7a5c58]" />
                <span>{property.agent.phone}</span>
              </a>

            </div>

            {/* Platform Security Badge */}
            <div className="p-3 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] flex items-start gap-2.5 text-xs text-[#7a5c58]">
              <ShieldCheck className="w-5 h-5 text-[#16a34a] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#281715] block font-bold">
                  {isAr ? 'معاملة آمنة وموثوقة' : isEn ? 'Verified & Secure Transaction' : 'Transaction sécurisée'}
                </strong>
                <span>
                  {isAr ? 'يتم التحقق من الوثائق والملكيات قبل إتمام أي معاملة.' : isEn ? 'Verified title deeds and official Moroccan contracts available in Legal Center.' : 'Tous les documents légaux peuvent être édités dans notre Espace Juridique.'}
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Similar Properties */}
      {similarProperties.length > 0 && (
        <div className="pt-8 border-t border-[#f2e6e4] space-y-6">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#281715]">
            {isAr ? 'عقارات مشابهة قد تهمك' : isEn ? 'Similar Properties in the Area' : 'Biens similaires dans la même région'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {similarProperties.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectProperty(item)}
                className="bg-white rounded-2xl border border-[#f0e4e2] overflow-hidden hover:shadow-lg transition-all cursor-pointer group flex flex-col"
              >
                <div className="relative h-40 w-full overflow-hidden bg-[#e8d5d3]">
                  <img
                    src={item.images[0]}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-2 left-2 bg-white/90 text-xs font-bold px-2 py-0.5 rounded">
                    {item.surface} m²
                  </div>
                </div>
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <h4 className="text-xs font-bold text-[#281715] line-clamp-1 group-hover:text-[#ff6f61]">
                    {isAr ? item.titleAr : isEn && item.titleEn ? item.titleEn : item.titleFr}
                  </h4>
                  <div className="text-sm font-extrabold text-[#ff6f61] mt-2">
                    {isAr ? item.priceFormattedAr : isEn && item.priceFormattedEn ? item.priceFormattedEn : item.priceFormattedFr}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Screen Photo Modal */}
      {showAllPhotosModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col p-4 sm:p-8 backdrop-blur-md animate-in fade-in">
          <div className="flex items-center justify-between text-white mb-4">
            <span className="font-bold text-sm">
              {getTitle()} ({activeImageIndex + 1} / {property.images.length})
            </span>
            <button
              onClick={() => setShowAllPhotosModal(false)}
              className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold cursor-pointer"
            >
              {isAr ? 'إغلاق' : isEn ? 'Close' : 'Fermer'}
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <img
              src={property.images[activeImageIndex]}
              alt=""
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex items-center justify-center gap-2 pt-4 overflow-x-auto">
            {property.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImageIndex(i)}
                className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  activeImageIndex === i ? 'border-[#ff6f61]' : 'border-transparent opacity-60'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
