export type Language = 'fr' | 'ar' | 'en';

export type PropertyType = 
  | 'Appartement'
  | 'Villa'
  | 'Maison'
  | 'Terrain'
  | 'Local Commercial'
  | 'Bureau'
  | 'Immeuble'
  | 'Riad'
  | 'Ferme';

export type ListingType = 'vente' | 'location' | 'neuf';

export type ListingStatus = 'Accepté' | 'En révision' | 'Expiré' | 'Disponible' | 'Vendu' | 'Loué';

export interface Property {
  id: number;
  titleFr: string;
  titleAr: string;
  titleEn?: string;
  type: PropertyType;
  listingType: ListingType;
  price: number;
  priceFormattedFr: string;
  priceFormattedAr: string;
  priceFormattedEn?: string;
  pricePerSqm?: number;
  city: string;
  district: string;
  address: string;
  surface: number; // m²
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  floor?: number | string;
  totalFloors?: number;
  hasElevator?: boolean;
  hasParking?: boolean;
  parkingSize?: number;
  syndicFee?: number;
  yearBuilt?: number;
  isFurnished?: boolean;
  hasGarden?: boolean;
  hasPool?: boolean;
  hasGarage?: boolean;
  badge?: 'URGENT' | 'NOUVEAU' | 'EXCLUSIVITÉ' | 'COUP DE CŒUR';
  status: ListingStatus;
  images: string[];
  descriptionFr: string;
  descriptionAr: string;
  descriptionEn?: string;
  features: string[];
  lat: number;
  lng: number;
  agent: {
    name: string;
    agency: string;
    phone: string;
    whatsapp: string;
    email: string;
    avatar: string;
    rating: number;
    reviewCount: number;
  };
  viewsCount?: number;
  savedCount?: number;
  dateAdded: string;
  isUserListing?: boolean;
}

export interface LegalDocument {
  id: string;
  titleFr: string;
  titleAr: string;
  titleEn?: string;
  category: string;
  fileSize: string;
  descriptionFr: string;
  descriptionAr: string;
  descriptionEn?: string;
  iconName: string;
  contentTemplateFr: string;
  contentTemplateAr: string;
  contentTemplateEn?: string;
}

export interface RealEstateLaw {
  id: string;
  titleFr: string;
  titleAr: string;
  titleEn?: string;
  lawNumber: string;
  descriptionFr: string;
  descriptionAr: string;
  descriptionEn?: string;
  keyPointsFr: string[];
  keyPointsAr: string[];
  keyPointsEn?: string[];
  officialBulletinLink?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
  isRead: boolean;
}

export interface ChatConversation {
  id: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  contactRoleFr: string;
  contactRoleAr: string;
  contactRoleEn?: string;
  propertyTitle: string;
  propertyPrice: string;
  propertyImage: string;
  propertyId: number;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  status: 'all' | 'unread' | 'archived';
  tagFr: string;
  tagAr: string;
  tagEn?: string;
  messages: ChatMessage[];
}

export interface ClientLead {
  id: number;
  name: string;
  phone: string;
  category: 'فرد' | 'شركة' | 'Particulier' | 'Société' | 'Individual' | 'Company';
  companyName?: string;
  requestType: string;
  propType: string;
  budget: number;
  area: string;
  status: 'نشط' | 'في المتابعة' | 'منجز' | 'ملغى';
  notes: string;
  linkedPropIds: number[];
  dateAdded: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatar: string;
  memberSinceFr: string;
  memberSinceAr: string;
  memberSinceEn?: string;
  totalAds: number;
  totalViews: string;
  totalMessages: number;
}
