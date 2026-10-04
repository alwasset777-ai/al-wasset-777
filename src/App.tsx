import React, { useState, useEffect } from 'react';
import { 
  Language, 
  Property, 
  LegalDocument, 
  ChatConversation, 
  UserProfile 
} from './types';
import { 
  mockProperties, 
  mockConversations, 
  currentUserProfile 
} from './data/mockData';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { ListingsView } from './components/ListingsView';
import { PropertyDetailView } from './components/PropertyDetailView';
import { FavoritesView } from './components/FavoritesView';
import { LegalView } from './components/LegalView';
import { DashboardView } from './components/DashboardView';
import { MessagesView } from './components/MessagesView';
import { CrmView } from './components/CrmView';
import { AdsAgentView } from './components/AdsAgentView';
import { AgentChat } from './components/AgentChat';
import { PostAdModal } from './components/PostAdModal';
import { DocumentModal } from './components/DocumentModal';
import { ScheduleVisitModal } from './components/ScheduleVisitModal';

export const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('fr');
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [favorites, setFavorites] = useState<number[]>([1, 2, 4]);
  const [conversations, setConversations] = useState<ChatConversation[]>(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [navFilters, setNavFilters] = useState<{ listingType?: string; city?: string; type?: string }>({});

  // Modals state
  const [isPostAdOpen, setIsPostAdOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<LegalDocument | null>(null);
  const [visitScheduleProp, setVisitScheduleProp] = useState<Property | null>(null);

  // Sync RTL / LTR document direction with language
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'fr' ? 'ar' : prev === 'ar' ? 'en' : 'fr'));
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const handleTabChange = (tab: string, filters?: { listingType?: string; city?: string; type?: string }) => {
    setSelectedProperty(null);
    setCurrentTab(tab);
    if (filters) {
      setNavFilters(filters);
    } else {
      setNavFilters({});
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavorite = (id: number) => {
    setFavorites((prev) => 
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
  };

  const handleAddProperty = (newProp: Property) => {
    setProperties([newProp, ...properties]);
    setSelectedProperty(newProp);
  };

  const handleDeleteProperty = (id: number) => {
    setProperties(properties.filter((p) => p.id !== id));
  };

  const handleRenewProperty = (id: number) => {
    setProperties(
      properties.map((p) => 
        p.id === id ? { ...p, status: 'Accepté', dateAdded: 'Renouvelé aujourd’hui' } : p
      )
    );
  };

  const handleSendMessage = (conversationId: string, text: string) => {
    const newMsg = {
      id: `msg-${Date.now()}`,
      senderId: 'user',
      senderName: currentUserProfile.name,
      text,
      timestamp: 'À l’instant',
      isOutgoing: true,
      isRead: true
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: text,
              lastMessageTime: 'Maintenant',
              messages: [...c.messages, newMsg]
            }
          : c
      )
    );
  };

  const handleStartChatWithProperty = (property: Property) => {
    // Check if conversation already exists for this property
    const existing = conversations.find((c) => c.propertyId === property.id);
    if (existing) {
      setActiveConversationId(existing.id);
    } else {
      const newConv: ChatConversation = {
        id: `conv-${Date.now()}`,
        contactName: property.agent.name,
        contactPhone: property.agent.phone,
        contactAvatar: property.agent.avatar,
        contactRoleFr: property.agent.agency,
        contactRoleAr: property.agent.agency,
        propertyTitle: language === 'ar' ? property.titleAr : property.titleFr,
        propertyPrice: language === 'ar' ? property.priceFormattedAr : property.priceFormattedFr,
        propertyImage: property.images[0],
        propertyId: property.id,
        lastMessage: 'Discussion initiée',
        lastMessageTime: 'Maintenant',
        unreadCount: 0,
        isOnline: true,
        status: 'all',
        tagFr: 'Nouveau contact',
        tagAr: 'طلب جديد',
        tagEn: 'New Inquiry',
        messages: [
          {
            id: `m-init-${Date.now()}`,
            senderId: 'user',
            senderName: currentUserProfile.name,
            text: language === 'ar' 
              ? `السلام عليكم، أنا مهتم بالإعلان: ${property.titleAr}. هل يمكن تقديم معلومات أكثر؟` 
              : language === 'en'
              ? `Hello, I am interested in your property listing: ${property.titleEn || property.titleFr}. Could you please provide more details?`
              : `Bonjour, je suis intéressé par votre bien : ${property.titleFr}. Pourriez-vous me renseigner ?`,
            timestamp: language === 'ar' ? 'الآن' : language === 'en' ? 'Just now' : 'À l’instant',
            isOutgoing: true,
            isRead: true
          }
        ]
      };
      setConversations([newConv, ...conversations]);
      setActiveConversationId(newConv.id);
    }
    setSelectedProperty(null);
    setCurrentTab('messages');
  };

  // Count unread messages
  const totalUnreadMessages = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <div className={`min-h-screen flex flex-col bg-[#fff8f7] text-[#281715] ${language === 'ar' ? 'font-tajawal' : 'font-sans'}`}>
      
      {/* Top Header Navbar */}
      <Navbar
        currentTab={selectedProperty ? 'details' : currentTab}
        onTabChange={(tab) => handleTabChange(tab)}
        language={language}
        onLanguageToggle={toggleLanguage}
        onLanguageChange={handleLanguageChange}
        favoriteCount={favorites.length}
        unreadMessagesCount={totalUnreadMessages}
        onOpenPostAd={() => setIsPostAdOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* If a property is selected, show detail view */}
        {selectedProperty ? (
          <PropertyDetailView
            property={selectedProperty}
            onBack={() => setSelectedProperty(null)}
            language={language}
            isFavorite={favorites.includes(selectedProperty.id)}
            onToggleFavorite={handleToggleFavorite}
            onStartChat={handleStartChatWithProperty}
            onScheduleVisit={(p) => setVisitScheduleProp(p)}
            similarProperties={properties.filter((p) => p.id !== selectedProperty.id && p.city === selectedProperty.city)}
            onSelectProperty={(p) => setSelectedProperty(p)}
          />
        ) : (
          <>
            {currentTab === 'home' && (
              <HomeView
                properties={properties}
                onSelectProperty={(p) => setSelectedProperty(p)}
                onNavigate={(tab, filters) => handleTabChange(tab, filters)}
                language={language}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            {(currentTab === 'vendre' || currentTab === 'louer' || currentTab === 'neuf') && (
              <ListingsView
                properties={properties}
                listingType={currentTab as any}
                initialFilters={navFilters}
                onSelectProperty={(p) => setSelectedProperty(p)}
                language={language}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                searchQuery={searchQuery}
              />
            )}

            {currentTab === 'favorites' && (
              <FavoritesView
                properties={properties}
                favoriteIds={favorites}
                onToggleFavorite={handleToggleFavorite}
                onSelectProperty={(p) => setSelectedProperty(p)}
                onExplore={() => handleTabChange('vendre')}
                language={language}
              />
            )}

            {currentTab === 'legal' && (
              <LegalView
                language={language}
                onPreviewDocument={(doc) => setPreviewDocument(doc)}
              />
            )}

            {currentTab === 'dashboard' && (
              <DashboardView
                userProfile={currentUserProfile}
                userProperties={properties.filter((p) => p.isUserListing)}
                onSelectProperty={(p) => setSelectedProperty(p)}
                onOpenPostAd={() => setIsPostAdOpen(true)}
                onDeleteProperty={handleDeleteProperty}
                onRenewProperty={handleRenewProperty}
                language={language}
              />
            )}

            {currentTab === 'messages' && (
              <MessagesView
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={setActiveConversationId}
                onSendMessage={handleSendMessage}
                language={language}
                onViewProperty={(propId) => {
                  const prop = properties.find((p) => p.id === propId);
                  if (prop) setSelectedProperty(prop);
                }}
              />
            )}

            {currentTab === 'ads' && (
              <AdsAgentView properties={properties} language={language} />
            )}

            {currentTab === 'crm' && (
              <CrmView
                properties={properties}
                language={language}
                onSelectProperty={(p) => setSelectedProperty(p)}
              />
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <Footer language={language} onNavigate={(tab) => handleTabChange(tab)} />

      {/* Modals */}
      <PostAdModal
        isOpen={isPostAdOpen}
        onClose={() => setIsPostAdOpen(false)}
        onAddProperty={handleAddProperty}
        language={language}
      />

      <DocumentModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
        language={language}
      />

      <AgentChat properties={properties} language={language} onNavigate={(tab) => handleTabChange(tab)} />

      <ScheduleVisitModal
        property={visitScheduleProp}
        isOpen={!!visitScheduleProp}
        onClose={() => setVisitScheduleProp(null)}
        language={language}
      />

    </div>
  );
};

export default App;
