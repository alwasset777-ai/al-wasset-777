import React from 'react';
import { Building2, ShieldCheck, Scale, Phone, Mail, MapPin, Globe } from 'lucide-react';
import { Language } from '../types';

interface FooterProps {
  language: Language;
  onNavigate: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ language, onNavigate }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';

  return (
    <footer className="bg-[#281715] text-[#fff8f7] border-t border-[#3f2724] pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff6f61] to-[#ff9a8d] flex items-center justify-center text-white shadow-md">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-white">
                  {isAr ? 'الوسيط' : 'Al Wassit'}
                </span>
                <span className="bg-[#ff6f61] text-white text-xs font-black px-1.5 py-0.5 rounded-md">
                  777
                </span>
              </div>
            </div>

            <p className="text-xs text-[#d1b8b4] leading-relaxed max-w-sm">
              {isAr
                ? 'البوابة العقارية المرجعية بالمملكة المغربية. نوفر تجربة بحث ومواكبة قانونية متكاملة لبيع، شراء، وكراء العقارات بكل أمان وثقة.'
                : isEn
                ? 'The benchmark real estate portal in the Kingdom of Morocco. Connecting buyers, renters, and agencies with verified listings and full legal assistance.'
                : 'La plateforme de référence pour l’immobilier au Maroc. Vente, location, programmes neufs et espace juridique certifié.'}
            </p>

            <div className="flex items-center gap-3 text-xs text-[#ff8f82] font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>{isAr ? 'عقود ومعاملات آمنة ومحققة' : isEn ? 'Verified deeds & secure transactions' : 'Titres et contrats conformes'}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 text-xs">
            <h4 className="font-extrabold text-white text-sm">
              {isAr ? 'روابط سريعة' : isEn ? 'Navigation' : 'Navigation'}
            </h4>
            <ul className="space-y-2 text-[#d1b8b4]">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-[#ff8f82] transition-colors cursor-pointer">
                  {isAr ? 'الرئيسية' : isEn ? 'Home' : 'Accueil'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('vendre')} className="hover:text-[#ff8f82] transition-colors cursor-pointer">
                  {isAr ? 'عقارات للبيع' : isEn ? 'Buy a Property' : 'Acheter un bien'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('louer')} className="hover:text-[#ff8f82] transition-colors cursor-pointer">
                  {isAr ? 'عقارات للكراء' : isEn ? 'Rent a Property' : 'Louer un bien'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('neuf')} className="hover:text-[#ff8f82] transition-colors cursor-pointer">
                  {isAr ? 'مشاريع جديدة' : isEn ? 'New Developments' : 'Programmes neufs'}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('legal')} className="hover:text-[#ff8f82] transition-colors cursor-pointer">
                  {isAr ? 'الفضاء القانوني' : isEn ? 'Legal & Contracts' : 'Espace Juridique'}
                </button>
              </li>
            </ul>
          </div>

          {/* Major Moroccan Cities */}
          <div className="space-y-3 text-xs">
            <h4 className="font-extrabold text-white text-sm">
              {isAr ? 'أهم المدن' : isEn ? 'Major Cities' : 'Villes principales'}
            </h4>
            <ul className="space-y-2 text-[#d1b8b4]">
              <li>Casablanca (الدار البيضاء)</li>
              <li>Rabat (الرباط)</li>
              <li>Marrakech (مراكش)</li>
              <li>Tangier (طنجة)</li>
              <li>Meknes & Fez (مكناس وفاس)</li>
              <li>Agadir (أكادير)</li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3 text-xs">
            <h4 className="font-extrabold text-white text-sm">
              {isAr ? 'اتصل بنا' : isEn ? 'Support & Contact' : 'Support & Contact'}
            </h4>
            <div className="space-y-2 text-[#d1b8b4]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#ff8f82]" />
                <span>Angle Bd Zerktouni, Casablanca</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#ff8f82]" />
                <span>+212 5 22 00 77 70</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#ff8f82]" />
                <span>contact@alwassit777.ma</span>
              </div>
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-[#3f2724] flex flex-col sm:flex-row items-center justify-between text-xs text-[#a88d89] gap-4">
          <p>© {new Date().getFullYear()} Al Wassit 777. {isAr ? 'جميع الحقوق محفوظة. المملكة المغربية.' : isEn ? 'All rights reserved. Kingdom of Morocco.' : 'Tous droits réservés. المملكة المغربية.'}</p>
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('legal')} className="hover:underline">{isAr ? 'بيانات قانونية' : isEn ? 'Legal Notice' : 'Mentions légales'}</button>
            <button onClick={() => onNavigate('legal')} className="hover:underline">{isAr ? 'شروط الاستخدام' : isEn ? 'Terms of Service' : 'Conditions d’utilisation'}</button>
            <button onClick={() => onNavigate('legal')} className="hover:underline">{isAr ? 'حماية المعطيات الشخصية (09-08)' : isEn ? 'Privacy Policy (CNDP 09-08)' : 'Loi 09-08 (CNDP)'}</button>
          </div>
        </div>

      </div>
    </footer>
  );
};
