import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Heart, 
  MessageSquare, 
  PlusCircle, 
  User, 
  Globe, 
  Scale, 
  Briefcase, 
  Menu, 
  X,
  Compass,
  Megaphone,
  Rocket,
  ChevronDown
} from 'lucide-react';
import { Language } from '../types';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  language: Language;
  onLanguageToggle: () => void;
  onLanguageChange?: (lang: Language) => void;
  favoriteCount: number;
  unreadMessagesCount: number;
  onOpenPostAd: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  language,
  onLanguageToggle,
  onLanguageChange,
  favoriteCount,
  unreadMessagesCount,
  onOpenPostAd,
  searchQuery,
  onSearchChange,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  // «المزيد»: الأدوات (القانوني، الوكالة، الإعلانات، الاستوديو) فقائمة صغيرة باش ما تتزاحمش القائمة
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showMore) return;
    const close = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMore(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [showMore]);

  const isAr = language === 'ar';
  const isEn = language === 'en';

  const navLinks = [
    { id: 'home', labelFr: 'Accueil', labelAr: 'الرئيسية', labelEn: 'Home' },
    { id: 'vendre', labelFr: 'Acheter', labelAr: 'شراء', labelEn: 'Buy' },
    { id: 'louer', labelFr: 'Louer', labelAr: 'كراء', labelEn: 'Rent' },
    { id: 'neuf', labelFr: 'Neuf', labelAr: 'مشاريع جديدة', labelEn: 'New Projects' },
    { id: 'legal', labelFr: 'Espace Juridique', labelAr: 'الفضاء القانوني', labelEn: 'Legal & Contracts', icon: Scale },
    { id: 'crm', labelFr: 'Agence & CRM', labelAr: 'إدارة الوكالة', labelEn: 'Agency CRM', icon: Briefcase },
    { id: 'ads', labelFr: 'Publicités', labelAr: 'الإعلانات', labelEn: 'Ads Agent', icon: Megaphone },
    { id: 'studio', labelFr: 'Studio', labelAr: 'استوديو النشر', labelEn: 'Studio', icon: Rocket }
  ];

  const MAIN_LINKS = 4; // الروابط الرئيسية؛ الباقي فـ«المزيد»
  const moreLinks = navLinks.slice(MAIN_LINKS);

  const getLinkLabel = (link: typeof navLinks[0]) => {
    if (isAr) return link.labelAr;
    if (isEn) return link.labelEn;
    return link.labelFr;
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#f2e6e4] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onTabChange('home')}
              className="shrink-0 flex items-center gap-3 group text-left cursor-pointer focus:outline-none"
            >
              <img src="/brand/logo-alwasset777.webp" alt={isAr ? 'مجموعة الوسيط' : 'Al Wasset Groupe'} width={44} height={44} className="w-11 h-11 rounded-full object-cover shadow-md shadow-[#ff6f61]/25 group-hover:scale-105 transition-transform duration-200" />
              <div className="sm:hidden">
                <div className="flex items-center gap-1.5">
                  {/* الشعار فيه 777 أصلاً ← ما نكتبوش 777 حداه */}
                  <span className="font-extrabold text-xl tracking-tight text-[#281715] whitespace-nowrap">
                    {isAr ? 'الوسيط' : 'Al Wasset'}
                  </span>
                </div>
                <p className="hidden sm:block md:hidden whitespace-nowrap text-[11px] text-[#7a5c58] font-medium tracking-wide">
                  {isAr ? 'عقارات المغرب الموثوقة' : isEn ? 'Morocco Real Estate Platform' : 'Immobilier de Référence'}
                </p>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link, i) => {
                if (i >= MAIN_LINKS) return null;
                const isActive = currentTab === link.id;
                const IconComponent = link.icon;
                return (
                  <button
                    key={link.id}
                    onClick={() => onTabChange(link.id)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#fff0ed] text-[#ff6f61] shadow-xs'
                        : 'text-[#5a4340] hover:text-[#281715] hover:bg-[#fff8f7]'
                    }`}
                  >
                    {IconComponent && <IconComponent className="w-4 h-4" />}
                    <span className="whitespace-nowrap">{getLinkLabel(link)}</span>
                  </button>
                );
              })}
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setShowMore((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={showMore}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    moreLinks.some((l) => l.id === currentTab) || showMore
                      ? 'bg-[#fff0ed] text-[#ff6f61] shadow-xs'
                      : 'text-[#5a4340] hover:text-[#281715] hover:bg-[#fff8f7]'
                  }`}
                >
                  {isAr ? 'المزيد' : isEn ? 'More' : 'Plus'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                </button>
                {showMore && (
                  <div role="menu" className="absolute top-full mt-2 start-0 w-60 bg-white rounded-2xl shadow-xl border border-[#f2e6e4] p-1.5 z-50">
                    {moreLinks.map((link) => {
                      const IconComponent = link.icon;
                      const isActive = currentTab === link.id;
                      return (
                        <button
                          key={link.id}
                          role="menuitem"
                          onClick={() => { onTabChange(link.id); setShowMore(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-start cursor-pointer ${
                            isActive ? 'bg-[#fff0ed] text-[#ff6f61]' : 'text-[#5a4340] hover:bg-[#fff8f7] hover:text-[#281715]'
                          }`}
                        >
                          {IconComponent && <IconComponent className="w-4 h-4 shrink-0" />}
                          <span>{getLinkLabel(link)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Quick Search on larger screens */}
            <div className="hidden md:flex lg:hidden xl:flex relative items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={isAr ? 'بحث بالمدينة، الحي، السعر...' : isEn ? 'City, district, price...' : 'Ville, quartier, budget...'}
                className="w-48 pl-9 pr-3 py-2 text-xs rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-[#281715] placeholder-[#99807d] focus:outline-none focus:ring-2 focus:ring-[#ff6f61] focus:bg-white transition-all"
              />
              <Search className="w-4 h-4 text-[#99807d] absolute left-3 pointer-events-none" />
            </div>

            {/* Language Switcher Selector (FR / EN / AR) */}
            <div className="relative">
              <div className="flex items-center rounded-xl bg-[#fff8f7] border border-[#f0e4e2] p-0.5">
                {(['fr', 'en', 'ar'] as Language[]).map((langCode) => (
                  <button
                    key={langCode}
                    onClick={() => onLanguageChange ? onLanguageChange(langCode) : onLanguageToggle()}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      language === langCode
                        ? 'bg-[#ff6f61] text-white shadow-xs'
                        : 'text-[#7a5c58] hover:text-[#281715] hover:bg-white'
                    }`}
                  >
                    {langCode === 'fr' ? 'FR' : langCode === 'en' ? 'EN' : 'عربي'}
                  </button>
                ))}
              </div>
            </div>

            {/* Favorites Icon */}
            <button
              onClick={() => onTabChange('favorites')}
              title={isAr ? 'مفضلاتي' : isEn ? 'Favorites' : 'Mes favoris'}
              className={`relative hidden sm:block p-2.5 rounded-xl border transition-colors cursor-pointer ${
                currentTab === 'favorites'
                  ? 'bg-[#fff0ed] text-[#ff6f61] border-[#ffd8d2]'
                  : 'bg-[#fff8f7] text-[#5a4340] border-[#f0e4e2] hover:bg-[#fff0ed] hover:text-[#ff6f61]'
              }`}
            >
              <Heart className="w-4 h-4" />
              {favoriteCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff6f61] text-white text-[10px] font-bold flex items-center justify-center">
                  {favoriteCount}
                </span>
              )}
            </button>

            {/* Messages Icon */}
            <button
              onClick={() => onTabChange('messages')}
              title={isAr ? 'الرسائل والمحادثات' : isEn ? 'Messages' : 'Messagerie'}
              className={`relative hidden sm:block p-2.5 rounded-xl border transition-colors cursor-pointer ${
                currentTab === 'messages'
                  ? 'bg-[#fff0ed] text-[#ff6f61] border-[#ffd8d2]'
                  : 'bg-[#fff8f7] text-[#5a4340] border-[#f0e4e2] hover:bg-[#fff0ed] hover:text-[#ff6f61]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff6f61] text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            {/* Dashboard / User Profile */}
            <button
              onClick={() => onTabChange('dashboard')}
              title={isAr ? 'لوحة الحساب' : isEn ? 'Dashboard' : 'Mon compte'}
              className={`hidden sm:flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl border transition-colors cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-[#fff0ed] text-[#ff6f61] border-[#ffd8d2]'
                  : 'bg-[#fff8f7] text-[#5a4340] border-[#f0e4e2] hover:bg-[#fff0ed]'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-[#e8d5d3] overflow-hidden flex items-center justify-center text-[#ff6f61] font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <span className="hidden text-xs font-bold text-[#281715] whitespace-nowrap">
                {isAr ? 'حسابي' : isEn ? 'Account' : 'Mon Compte'}
              </span>
            </button>

            {/* Primary Action: Déposer une annonce */}
            <button
              onClick={onOpenPostAd}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#ff6f61]/25 hover:shadow-lg transition-all duration-150 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden whitespace-nowrap">
                {isAr ? 'نشر إعلان' : isEn ? 'Post Listing' : 'Déposer une annonce'}
              </span>
              <span className="whitespace-nowrap">
                {isAr ? 'نشر إعلان' : isEn ? 'Post' : 'Publier'}
              </span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-[#fff8f7] text-[#5a4340] hover:bg-[#fff0ed] border border-[#f0e4e2]"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-[#f2e6e4] space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-2 mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={isAr ? 'بحث بالمدينة، الحي...' : isEn ? 'Search properties...' : 'Recherche de biens...'}
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-[#281715]"
              />
            </div>
            {navLinks.map((link) => {
              const isActive = currentTab === link.id;
              const IconComponent = link.icon || Compass;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    onTabChange(link.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#fff0ed] text-[#ff6f61]'
                      : 'text-[#5a4340] hover:bg-[#fff8f7]'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{getLinkLabel(link)}</span>
                </button>
              );
            })}
            <div className="grid grid-cols-2 gap-2 pt-2 sm:hidden">
              {[
                { id: 'favorites', icon: Heart, label: isAr ? `مفضلاتي (${favoriteCount})` : isEn ? `Favorites (${favoriteCount})` : `Favoris (${favoriteCount})` },
                { id: 'messages', icon: MessageSquare, label: isAr ? `الرسائل (${unreadMessagesCount})` : isEn ? `Messages (${unreadMessagesCount})` : `Messages (${unreadMessagesCount})` },
                { id: 'dashboard', icon: User, label: isAr ? 'حسابي' : isEn ? 'Account' : 'Mon compte' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => { onTabChange(id); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-[#5a4340] bg-[#fff8f7] border border-[#f0e4e2] cursor-pointer"
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
              <button
                onClick={() => { onOpenPostAd(); setIsMobileMenuOpen(false); }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ff6f61] cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> {isAr ? 'نشر إعلان' : isEn ? 'Post Listing' : 'Déposer une annonce'}
              </button>
            </div>
          </div>
        )}

      </div>
    </header>
  );
};
