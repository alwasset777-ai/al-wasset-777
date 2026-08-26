import React, { useState } from 'react';
import { 
  Send, 
  MessageSquare, 
  Search, 
  CheckCheck, 
  Phone, 
  ExternalLink, 
  Paperclip, 
  Sparkles, 
  User, 
  Building,
  CheckCircle2,
  Clock,
  MessageCircle
} from 'lucide-react';
import { ChatConversation, ChatMessage, Language } from '../types';

interface MessagesViewProps {
  conversations: ChatConversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onSendMessage: (conversationId: string, text: string) => void;
  language: Language;
  onViewProperty: (propertyId: number) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onSendMessage,
  language,
  onViewProperty
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'archived'>('all');
  const [messageInput, setMessageInput] = useState('');
  const [searchContact, setSearchContact] = useState('');

  const currentConv = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const filteredConversations = conversations.filter((c) => {
    if (filterTab === 'unread' && c.unreadCount === 0) return false;
    if (filterTab === 'archived' && c.status !== 'archived') return false;
    if (filterTab === 'all' && c.status === 'archived') return false;
    if (searchContact.trim()) {
      const q = searchContact.toLowerCase();
      return c.contactName.toLowerCase().includes(q) || c.propertyTitle.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentConv) return;
    onSendMessage(currentConv.id, messageInput.trim());
    setMessageInput('');
  };

  const quickReplies = [
    { fr: 'Bonjour, le bien est toujours disponible.', ar: 'مرحبا، العقار لا يزال متوفراً.', en: 'Hello, is this property still available?' },
    { fr: 'Pouvons-nous fixer un rendez-vous pour visiter ?', ar: 'هل يمكننا تحديد موعد للزيارة؟', en: 'Can we schedule a visit appointment?' },
    { fr: 'Je vous envoie les documents requis.', ar: 'سأرسل لكم الوثائق المطلوبة.', en: 'I am sending you the required documents.' }
  ];

  const getQuickReplyText = (qr: typeof quickReplies[0]) => {
    if (isAr) return qr.ar;
    if (isEn) return qr.en;
    return qr.fr;
  };

  const getContactRole = (conv: ChatConversation) => {
    if (isAr) return conv.contactRoleAr;
    if (isEn && conv.contactRoleEn) return conv.contactRoleEn;
    return conv.contactRoleFr;
  };

  const getTag = (conv: ChatConversation) => {
    if (isAr) return conv.tagAr;
    if (isEn && conv.tagEn) return conv.tagEn;
    return conv.tagFr;
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="border-b border-[#f2e6e4] pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight">
            {isAr ? 'الرسائل والمحادثات' : isEn ? 'Messages & Inquiries' : 'Messagerie & Échanges'}
          </h1>
          <p className="text-xs sm:text-sm text-[#7a5c58] mt-1">
            {isAr ? 'تواصل مباشرة مع الوكلاء والمشترين وأصحاب العقارات' : isEn ? 'Direct communication with real estate agents, owners, and buyers' : 'Discutez en temps réel avec les agences et les acquéreurs'}
          </p>
        </div>
      </div>

      {/* Main Messaging Container */}
      <div className="bg-white rounded-3xl border border-[#f0e4e2] shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* Left Contact List (4 Cols) */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#f2e6e4] flex flex-col bg-[#fff8f7]">
          
          {/* Top Filter & Search */}
          <div className="p-4 border-b border-[#f2e6e4] space-y-3 bg-white">
            <div className="relative">
              <input
                type="text"
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                placeholder={isAr ? 'بحث في المحادثات...' : isEn ? 'Search conversations...' : 'Rechercher un contact...'}
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715]"
              />
              <Search className="w-3.5 h-3.5 text-[#99807d] absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1">
              {[
                { id: 'all', labelFr: 'Tous', labelAr: 'الكل', labelEn: 'All' },
                { id: 'unread', labelFr: 'Non lus', labelAr: 'غير مقروءة', labelEn: 'Unread' },
                { id: 'archived', labelFr: 'Archivés', labelAr: 'الأرشيف', labelEn: 'Archived' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as any)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    filterTab === tab.id
                      ? 'bg-[#ff6f61] text-white shadow-xs'
                      : 'text-[#7a5c58] hover:bg-[#fff0ed]'
                  }`}
                >
                  {isAr ? tab.labelAr : isEn ? tab.labelEn : tab.labelFr}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f2e6e4]">
            {filteredConversations.map((conv) => {
              const isSelected = currentConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full p-4 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-white border-l-4 border-l-[#ff6f61]' : 'hover:bg-white/60'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={conv.contactAvatar}
                      alt=""
                      className="w-11 h-11 rounded-2xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {conv.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#16a34a] border-2 border-white"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-[#281715] truncate">
                        {conv.contactName}
                      </h4>
                      <span className="text-[10px] text-[#99807d]">
                        {conv.lastMessageTime}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#ff6f61] font-semibold truncate mt-0.5">
                      {conv.propertyTitle}
                    </div>

                    <p className="text-[11px] text-[#7a5c58] truncate mt-1">
                      {conv.lastMessage}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fff0ed] text-[#ff6f61] font-bold">
                        {getTag(conv)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#ff6f61] text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* Right Active Chat Box (8 Cols) */}
        {currentConv ? (
          <div className="lg:col-span-8 flex flex-col h-full bg-white">
            
            {/* Chat Contact Header */}
            <div className="p-4 border-b border-[#f2e6e4] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <img
                  src={currentConv.contactAvatar}
                  alt=""
                  className="w-10 h-10 rounded-2xl object-cover"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="text-sm font-extrabold text-[#281715]">
                    {currentConv.contactName}
                  </h3>
                  <p className="text-[11px] text-[#7a5c58]">
                    {getContactRole(currentConv)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${currentConv.contactPhone}`}
                  className="p-2 rounded-xl bg-[#fff8f7] text-[#281715] hover:bg-[#fff0ed] border border-[#f0e4e2]"
                  title="Appeler"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Attached Property Context Bar */}
            <div className="px-4 py-2.5 bg-[#fff0ed] border-b border-[#ffd8d2] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={currentConv.propertyImage}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <span className="text-[10px] font-bold text-[#ff6f61] uppercase tracking-wider block">
                    {isAr ? 'العقار موضوع المحادثة' : isEn ? 'Associated Property' : 'Bien concerné'}
                  </span>
                  <div className="text-xs font-extrabold text-[#281715]">
                    {currentConv.propertyTitle} • {currentConv.propertyPrice}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onViewProperty(currentConv.propertyId)}
                className="text-[11px] font-bold text-[#ff6f61] hover:underline flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                <span>{isAr ? 'عرض الإعلان' : isEn ? 'View Listing' : 'Voir le bien'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#fffdfc]">
              {currentConv.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md rounded-2xl p-3.5 text-xs shadow-xs space-y-1 ${
                      msg.isOutgoing
                        ? 'bg-[#ff6f61] text-white rounded-br-none'
                        : 'bg-white text-[#281715] border border-[#f0e4e2] rounded-bl-none'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <div
                      className={`text-[10px] flex items-center justify-end gap-1 ${
                        msg.isOutgoing ? 'text-white/80' : 'text-[#99807d]'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {msg.isOutgoing && <CheckCheck className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Canned Replies */}
            <div className="px-4 py-2 bg-white border-t border-[#f2e6e4] flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold text-[#7a5c58] flex-shrink-0">
                {isAr ? 'ردود سريعة:' : isEn ? 'Quick replies:' : 'Réponses rapides :'}
              </span>
              {quickReplies.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(currentConv.id, getQuickReplyText(qr))}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-[#fff8f7] text-[#5a4340] hover:bg-[#fff0ed] hover:text-[#ff6f61] border border-[#f0e4e2] flex-shrink-0 cursor-pointer"
                >
                  {getQuickReplyText(qr)}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-[#f2e6e4] flex items-center gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={isAr ? 'اكتب رسالتك هنا...' : isEn ? 'Type your message...' : 'Écrivez votre message...'}
                className="flex-1 px-4 py-2.5 text-xs bg-[#fff8f7] rounded-xl border border-[#f0e4e2] text-[#281715] focus:outline-none focus:ring-2 focus:ring-[#ff6f61]"
              />

              <button
                type="submit"
                className="p-2.5 rounded-xl bg-[#ff6f61] hover:bg-[#e8584a] text-white transition-all shadow-md cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        ) : (
          <div className="lg:col-span-8 flex items-center justify-center p-8 text-center text-[#7a5c58]">
            <p>{isAr ? 'حدد محادثة للبدء في المراسلة' : isEn ? 'Select a conversation to start messaging.' : 'Sélectionnez une conversation pour afficher les messages.'}</p>
          </div>
        )}

      </div>

    </div>
  );
};
