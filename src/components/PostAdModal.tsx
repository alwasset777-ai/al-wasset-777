import React, { useState } from 'react';
import { 
  X, 
  Building, 
  MapPin, 
  DollarSign, 
  Camera, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { Property, Language, PropertyType, ListingType } from '../types';
import { moroccanCities } from '../data/mockData';
import confetti from 'canvas-confetti';

interface PostAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProperty: (newProp: Property) => void;
  language: Language;
}

export const PostAdModal: React.FC<PostAdModalProps> = ({
  isOpen,
  onClose,
  onAddProperty,
  language
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';

  const [step, setStep] = useState(1);
  const [listingType, setListingType] = useState<ListingType>('vente');
  const [propertyType, setPropertyType] = useState<PropertyType>('Appartement');
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('Casablanca');
  const [district, setDistrict] = useState('');
  const [price, setPrice] = useState('');
  const [surface, setSurface] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('+212 6 61 23 45 67');
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=1200&q=80'
  ]);
  const [customPhotoInput, setCustomPhotoInput] = useState('');

  if (!isOpen) return null;

  const handleAddPhoto = () => {
    if (customPhotoInput.trim()) {
      setPhotos([...photos, customPhotoInput.trim()]);
      setCustomPhotoInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = parseFloat(price) || 1500000;
    const numSurface = parseFloat(surface) || 100;

    const newProperty: Property = {
      id: Date.now(),
      titleFr: title || `Bel ${propertyType} à ${district || city}`,
      titleAr: title || `${propertyType === 'Villa' ? 'فيلا' : 'شقة'} راقية بـ ${district || city}`,
      titleEn: title || `Charming ${propertyType} in ${district || city}`,
      type: propertyType,
      listingType: listingType,
      price: numPrice,
      priceFormattedFr: listingType === 'location' ? `${numPrice.toLocaleString()} MAD / mois` : `${numPrice.toLocaleString()} MAD`,
      priceFormattedAr: listingType === 'location' ? `${numPrice.toLocaleString()} د.م / شهريا` : `${numPrice.toLocaleString()} د.م`,
      priceFormattedEn: listingType === 'location' ? `${numPrice.toLocaleString()} MAD / month` : `${numPrice.toLocaleString()} MAD`,
      pricePerSqm: Math.round(numPrice / numSurface),
      city: city,
      district: district || 'Centre',
      address: `${district || 'Centre'}, ${city}`,
      surface: numSurface,
      rooms: parseInt(bedrooms) + 1,
      bedrooms: parseInt(bedrooms) || 2,
      bathrooms: parseInt(bathrooms) || 1,
      floor: '3ème',
      hasElevator: true,
      hasParking: true,
      badge: 'NOUVEAU',
      status: 'Accepté',
      images: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'],
      descriptionFr: description || 'Superbe bien immobilier idéalement situé, proche de toutes commodités, finitions de qualité supérieure.',
      descriptionAr: description || 'عقار رائع في موقع استراتيجي ممتاز، قريب من جميع المرافق، بتشطيبات عالية الجودة.',
      descriptionEn: description || 'Superb property ideally located close to all amenities, with premium high-quality finishes.',
      features: ['Climatisation', 'Ascenseur', 'Garage sécurisé', 'Cuisine équipée'],
      lat: city === 'Rabat' ? 33.971 : city === 'Marrakech' ? 31.629 : 33.573,
      lng: city === 'Rabat' ? -6.849 : city === 'Marrakech' ? -7.981 : -7.589,
      agent: {
        name: 'Ahmed Mansouri',
        agency: 'Particulier',
        phone: phone,
        whatsapp: phone,
        email: 'ahmed.mansouri@example.ma',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        rating: 5.0,
        reviewCount: 1
      },
      viewsCount: 1,
      savedCount: 0,
      dateAdded: isAr ? 'اليوم' : isEn ? 'Today' : 'Aujourd’hui',
      isUserListing: true
    };

    onAddProperty(newProperty);
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#f0e4e2] shadow-2xl overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-[#f2e6e4] flex items-center justify-between bg-[#fff8f7]">
          <div>
            <span className="text-[10px] font-bold text-[#ff6f61] uppercase tracking-wider block">
              {isAr ? `المرحلة ${step} من 3` : isEn ? `Step ${step} of 3` : `Étape ${step} sur 3`}
            </span>
            <h2 className="text-xl font-extrabold text-[#281715]">
              {isAr ? 'نشر إعلان عقاري جديد' : isEn ? 'Post a New Property Listing' : 'Déposer une annonce immobilière'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white text-[#7a5c58] hover:text-[#281715] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Content */}
        <div className="p-6">
          
          {/* Step 1: Type & Essentials */}
          {step === 1 && (
            <div className="space-y-5 text-xs">
              <div>
                <label className="block font-bold text-[#5a4340] mb-2">
                  {isAr ? 'نوع المعاملة' : isEn ? 'Transaction Type' : 'Type d’opération'}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'vente', labelFr: 'Vente', labelAr: 'بيع', labelEn: 'Sale' },
                    { id: 'location', labelFr: 'Location', labelAr: 'كراء', labelEn: 'Rent' },
                    { id: 'neuf', labelFr: 'Neuf', labelAr: 'مشروع جديد', labelEn: 'New Project' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setListingType(t.id as any)}
                      className={`py-3 rounded-2xl font-bold border transition-all cursor-pointer ${
                        listingType === t.id
                          ? 'bg-[#ff6f61] text-white border-transparent shadow-sm'
                          : 'bg-[#fff8f7] text-[#5a4340] border-[#f0e4e2]'
                      }`}
                    >
                      {isAr ? t.labelAr : isEn ? t.labelEn : t.labelFr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#5a4340] mb-2">
                  {isAr ? 'صنف العقار' : isEn ? 'Property Type' : 'Type de bien'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Appartement', 'Villa', 'Riad', 'Terrain', 'Bureau', 'Local Commercial'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPropertyType(t as any)}
                      className={`py-2.5 px-2 rounded-xl font-bold border transition-all text-[11px] cursor-pointer ${
                        propertyType === t
                          ? 'bg-[#281715] text-white border-transparent'
                          : 'bg-[#fff8f7] text-[#5a4340] border-[#f0e4e2]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#5a4340] mb-1">
                  {isAr ? 'عنوان الإعلان' : isEn ? 'Listing Title' : 'Titre de votre annonce'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Bel appartement moderne avec terrasse ensoleillée"
                  className="w-full px-3.5 py-2.5 bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
                />
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 rounded-xl bg-[#ff6f61] text-white font-bold flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>{isAr ? 'المتابعة' : isEn ? 'Next' : 'Suivant'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Location, Price, Specs */}
          {step === 2 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#5a4340] mb-1">
                    {isAr ? 'المدينة' : isEn ? 'City' : 'Ville'}
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                  >
                    {moroccanCities.filter((c) => !c.includes('Toutes')).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#5a4340] mb-1">
                    {isAr ? 'الحي / العنوان' : isEn ? 'District / Address' : 'Quartier / Secteur'}
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Ex: Maarif, Agdal, Guéliz..."
                    className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#5a4340] mb-1">
                    {isAr ? 'السعر (درهم مغربي)' : isEn ? 'Price (MAD)' : 'Prix (MAD)'}
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 2450000"
                    className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#5a4340] mb-1">
                    {isAr ? 'المساحة (م²)' : isEn ? 'Surface Area (m²)' : 'Surface (m²)'}
                  </label>
                  <input
                    type="number"
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
                    placeholder="Ex: 130"
                    className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#5a4340] mb-1">
                    {isAr ? 'غرف النوم' : isEn ? 'Bedrooms' : 'Chambres'}
                  </label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#5a4340] mb-1">
                    {isAr ? 'الحمامات' : isEn ? 'Bathrooms' : 'Salles de bain'}
                  </label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#5a4340] mb-1">
                  {isAr ? 'وصف تفصيلي للعقار' : isEn ? 'Description' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isAr ? 'صف مميزات العقار، التشطيبات، والخدمات المجاورة...' : isEn ? 'Describe property assets, amenities and finishing...' : 'Décrivez les atouts majeurs, prestations et finitions...'}
                  className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                ></textarea>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl bg-[#fff8f7] text-[#281715] font-bold flex items-center gap-2 cursor-pointer border border-[#f0e4e2]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isAr ? 'السابق' : isEn ? 'Previous' : 'Précédent'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 rounded-xl bg-[#ff6f61] text-white font-bold flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>{isAr ? 'المتابعة' : isEn ? 'Next' : 'Suivant'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Photos & Final Submit */}
          {step === 3 && (
            <div className="space-y-5 text-xs">
              <div>
                <label className="block font-bold text-[#5a4340] mb-2">
                  {isAr ? 'صور العقار' : isEn ? 'Property Photos' : 'Photos du bien'}
                </label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {photos.map((p, idx) => (
                    <div key={idx} className="relative h-20 rounded-xl overflow-hidden border border-[#f0e4e2]">
                      <img src={p} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customPhotoInput}
                    onChange={(e) => setCustomPhotoInput(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    className="px-3 py-2 bg-[#281715] text-white rounded-xl font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAr ? 'إضافة' : isEn ? 'Add' : 'Ajouter'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#5a4340] mb-1">
                  {isAr ? 'رقم الهاتف للتواصل' : isEn ? 'Contact Phone (WhatsApp)' : 'Numéro de contact (WhatsApp)'}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fff8f7] rounded-xl border border-[#f0e4e2]"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] flex items-center gap-2.5 text-[#059669]">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>
                  {isAr
                    ? 'سيتم نشر إعلانك فوراً وتفعيله في قائمة العقارات ولوحة التحكم.'
                    : isEn
                    ? 'Your listing will be published immediately and made available to all prospective buyers and renters.'
                    : 'Votre annonce sera mise en ligne immédiatement et accessible à tous les visiteurs.'}
                </span>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-[#fff8f7] text-[#281715] font-bold flex items-center gap-2 cursor-pointer border border-[#f0e4e2]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isAr ? 'السابق' : isEn ? 'Previous' : 'Précédent'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-[#ff6f61]/25"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? 'تأكيد ونشر الإعلان' : isEn ? 'Confirm & Publish Listing' : 'Publier mon annonce'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
