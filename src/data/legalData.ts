import { LegalDocument, RealEstateLaw } from '../types';

export const mockLegalDocuments: LegalDocument[] = [
  {
    id: 'compromis-vente',
    titleFr: 'Compromis de Vente Immobilière',
    titleAr: 'عقد وعد بالبيع العقاري (عقد ابتدائي)',
    titleEn: 'Preliminary Real Estate Sales Agreement',
    category: 'Vente & Achat / بيع وشراء',
    fileSize: '1.2 MB',
    iconName: 'FileText',
    descriptionFr: 'Modèle officiel d’avant-contrat conforme au Code des Droits Réels (Loi 39-08). Comprend les clauses suspensives de prêt bancaire, le séquestre d’acompte chez notaire et les délais de purge.',
    descriptionAr: 'نموذج رسمي لعقد الوعد بالبيع مطابق لمقتضيات مدونة الحقوق العينية (القانون 39-08)، يتضمن الشروط الفاسخة للحصول على القرض البنكي، والوديعة لدى الموثق، وتحديد الآجال القانونية.',
    descriptionEn: 'Official pre-contract template under the Moroccan Code of Real Rights (Law 39-08). Includes mortgage loan contingency clauses, escrow deposit with notary, and formal fulfillment deadlines.',
    contentTemplateFr: `ROYAUME DU MAROC
CONTRAT DE COMPROMIS DE VENTE D'IMMEUBLE
(Conforme aux dispositions de la Loi n° 39-08 portant Code des Droits Réels)

ENTRE LES SOUSSIGNÉS :
1. LE VENDEUR : [Nom du Vendeur, CNIE, Adresse]
2. L'ACQUÉREUR : [Nom de l'Acquéreur, CNIE, Adresse]

ARTICLE 1 : OBJET DE LA VENTE
Désignation du bien titré sous le N° [Titre Foncier], superficie de [XX] m².

ARTICLE 2 : PRIX ET MODALITÉS DE PAIEMENT
Prix global et forfaitaire de : [Montant en chiffres] MAD.

ARTICLE 3 : SÉQUESTRE ET CONDITIONS SUSPENSIVES
Versement de l'acompte consigné en l'étude de Maître [Notaire]. Condition suspensive d'obtention de prêt sous 45 jours.

Fait à [Ville], le [Date]`,
    contentTemplateAr: `المملكة المغربية
عقد وعد بالبيع العقاري (ابتدائي)
(مطابق لأحكام القانون رقم 39-08 المتعلق بمدونة الحقوق العينية)

بين الطرفين:
1. البائع: [الاسم، رقم ب.ت.و، العنوان]
2. المشتري: [الاسم، رقم ب.ت.و، العنوان]

المادة 1: موضوع البيع
العقار موضوع الرسم العقاري رقم [رقم الرسم] بمساحة [المساحة] م².

المادة 2: ثمن البيع
المبلغ الإجمالي: [المبلغ] درهم مغربي.

المادة 3: التسبيق والشرط الواقف
إيداع الوديعة لدى الموثق والشرط الواقف للحصول على قرض بنكي في أجل 45 يوماً.

حرر بـ [المدينة] في [التاريخ]`,
    contentTemplateEn: `KINGDOM OF MOROCCO
PRELIMINARY REAL ESTATE SALES AGREEMENT
(Pursuant to Law No. 39-08 enacting the Code of Real Rights)

BETWEEN THE UNDERSIGNED:
1. THE SELLER: [Seller Name, National ID / Passport, Address]
2. THE BUYER: [Buyer Name, National ID / Passport, Address]

ARTICLE 1: PURPOSE OF SALE
Titled real property registered under Land Title No. [Title Number], total area of [XX] sqm.

ARTICLE 2: PURCHASE PRICE AND PAYMENT TERMS
Agreed total fixed lump-sum price of: [Amount] MAD.

ARTICLE 3: ESCROW DEPOSIT AND CONTINGENCY CLAUSES
Deposit held in escrow with Notary Public [Notary Name]. Subject to mortgage financing condition within 45 days.

Executed in [City], on [Date]`
  },
  {
    id: 'contrat-bail-habitation',
    titleFr: 'Contrat de Bail d’Habitation (Loi 67-12)',
    titleAr: 'عقد كراء سكني (وفق القانون 67-12)',
    titleEn: 'Residential Lease Agreement (Law 67-12)',
    category: 'Location / كراء',
    fileSize: '850 KB',
    iconName: 'FileCheck',
    descriptionFr: 'Contrat de location résidentielle à usage d’habitation principale conforme aux dispositions de la Loi 67-12 régissant les rapports locatifs au Maroc. Inclus état des lieux et clause résolutoire.',
    descriptionAr: 'عقد كراء سكن رئيسي مطابق لأحكام القانون رقم 67-12 المنظم للعلاقات الكرائية بالمغرب، يتضمن نموذج محضر معاينة الأماكن والشرط الفاسخ ومبلغ الضمانة.',
    descriptionEn: 'Standard residential lease agreement for primary residences in accordance with Law 67-12 governing tenancy relations in Morocco. Includes walk-through inspection and penalty terms.',
    contentTemplateFr: `CONTRAT DE BAIL À USAGE D'HABITATION (Loi 67-12)
Bailleur : [Nom, CNIE]
Preneur : [Nom, CNIE]
Loyer mensuel : [Montant] MAD payable le 1er du mois.
Dépôt de garantie : [2 mois de loyer] MAD.`,
    contentTemplateAr: `عقد كراء محل معد للسكنى (القانون 67-12)
المكري: [الاسم، ب.ت.و]
المكتري: [الاسم، ب.ت.و]
السومة الكرائية: [المبلغ] درهم شهرياً.
الضمانة: [واجب شهرين] درهم.`,
    contentTemplateEn: `RESIDENTIAL LEASE AGREEMENT (Law 67-12)
Landlord: [Name, ID Number, Address]
Tenant: [Name, ID Number, Address]
Designation: [Apartment / Villa Address, Rooms, Amenities]
Monthly Rent: [Amount] MAD payable on the 1st of each month.
Security Deposit: [2 Months Rent] MAD held against damages.`
  },
  {
    id: 'acte-cession',
    titleFr: 'Acte de Cession de Droit au Bail',
    titleAr: 'عقد تفويت الحق في الكراء التجاري (الساروت)',
    titleEn: 'Commercial Leasehold Assignment Deed',
    category: 'Commercial / تجاري',
    fileSize: '920 KB',
    iconName: 'FileSpreadsheet',
    descriptionFr: 'Acte de cession de fonds de commerce ou de droit au bail commercial conforme à la Loi 49-16. Clauses de transfert, signification au propriétaire et purge des créances.',
    descriptionAr: 'عقد تفويت أصل تجاري أو حق في الكراء التجاري (الساروت) وفق القانون 49-16، يتضمن شروط الإشعار، إبراء الذمة الضريبية ونقل الحيازة القانونية.',
    descriptionEn: 'Commercial lease transfer and business goodwill assignment deed under Moroccan Law 49-16. Formal notice to landlord and tax clearance provisions.',
    contentTemplateFr: `ACTE DE CESSION DE DROIT AU BAIL COMMERCIAL (Loi 49-16)
Cédant : [Raison sociale ou Nom]
Cessionnaire : [Raison sociale ou Nom]
Prix de cession du droit au bail : [Montant] MAD`,
    contentTemplateAr: `عقد تفويت الحق في الكراء التجاري (القانون 49-16)
المفوت: [الاسم أو الشركة]
المفوت إليه: [الاسم أو الشركة]
مبلغ التفويت: [المبلغ] درهم`,
    contentTemplateEn: `COMMERCIAL LEASE ASSIGNMENT DEED (Law 49-16)
Assignor: [Company / Individual Name]
Assignee: [Company / Individual Name]
Assignment Consideration: [Amount] MAD
Official bailiff notification to property owner within 30 days.`
  },
  {
    id: 'mandat-vente',
    titleFr: 'Mandat de Vente Exclusif / Simple',
    titleAr: 'عقد وكالة وساطة عقارية (تفويض بيع)',
    titleEn: 'Exclusive / Non-Exclusive Brokerage Mandate',
    category: 'Agence & Mandat / وكالة وساطة',
    fileSize: '1.5 MB',
    iconName: 'ShieldCheck',
    descriptionFr: 'Convention de mandat d’intermédiation immobilière fixant la commission d’agence (2.5% HT à 3%), les devoirs d’information, les canaux de diffusion et la durée de validité.',
    descriptionAr: 'عقد تفويض وساطة عقارية يحدد نسبة العمولة القانونية (2.5% إلى 3%)، والتزامات الوكيل العقاري، ووسائل الإشهار، ومدة سريان التوكيل.',
    descriptionEn: 'Real estate agency mandate agreement establishing standard brokerage commissions (2.5% to 3% excl. VAT), marketing channels, and validity duration.',
    contentTemplateFr: `CONVENTION DE MANDAT DE VENTE IMMOBILIÈRE
Entre le Propriétaire [Nom] et l'Agent Immobilier [Nom Agence]
Commission convenue : 2.5% HT du prix de vente effectif
Durée : 6 mois renouvelable.`,
    contentTemplateAr: `عقد وكالة بالبيع ووساطة عقارية
بين المالك [الاسم] والوسيط العقاري [الوكالة]
العمولة: 2.5% من ثمن البيع. المدة: 6 أشهر.`,
    contentTemplateEn: `REAL ESTATE SALES MANDATE AGREEMENT
Between Property Owner [Name] and Licensed Real Estate Agent [Agency Name]
Agreed Commission: 2.5% excl. VAT of gross sale price.
Term: 6 months renewable.`
  }
];

export const mockRealEstateLaws: RealEstateLaw[] = [
  {
    id: 'loi-18-00',
    titleFr: 'Loi n° 18-00 relative au statut de la copropriété',
    titleAr: 'القانون رقم 18-00 المتعلق بنظام الملكية المشتركة للعقارات المبنية',
    titleEn: 'Law No. 18-00 on Co-Ownership of Built Properties',
    lawNumber: 'Loi 18-00 / Law 18-00',
    descriptionFr: 'Ce texte fondamental régit les droits et devoirs des copropriétaires au Maroc, le fonctionnement de l’assemblée générale, les attributions du syndic et la répartition des charges communes.',
    descriptionAr: 'ينظم هذا القانون حقوق وواجبات الملاك المشتركين في الإقامات والعمارات السكنية، وكيفية تسيير الجمع العام، وصلاحيات السنديك، وتوزيع مصاريف التسيير والصيانة المشتركة.',
    descriptionEn: 'This statutory framework governs co-owners rights and obligations in residential buildings in Morocco, general assembly governance, HOA manager (Syndic) duties, and common fee allocation.',
    keyPointsFr: [
      'Création obligatoire du Syndicat des copropriétaires doté de la personnalité morale.',
      'Désignation du Syndic et fixation de son mandat (généralement 1 à 2 ans renouvelables).',
      'Règles de majorité pour l’assemblée générale ordinaire et extraordinaire.',
      'Obligation de tenue d’un compte bancaire au nom du syndicat.',
      'Recouvrement forcé des charges impayées via injonction de payer avec exécution provisoire.'
    ],
    keyPointsAr: [
      'التأسيس الإلزامي لاتحاد الملاك المشتركين المتمتع بالشخصية الاعتبارية والاستقلال المالي.',
      'انتخاب وكيل الاتحاد (السنديك) ونائبه وتحديد مدة انتدابهم (سنة إلى سنتين).',
      'قواعد النصاب القانوني والتصويت في الجموع العامة العادية والاستثنائية.',
      'إلزامية فتح حساب بنكي باسم اتحاد الملاك.',
      'إمكانية اللجوء إلى مسطرة الأمر بالأداء ضد المتخلفين عن سداد واجبات السنديك مع النفاذ المعجل.'
    ],
    keyPointsEn: [
      'Mandatory formation of a legally recognized Co-Owners Association (Syndicat).',
      'Appointment of a property manager (Syndic) for 1 to 2 renewable year terms.',
      'Specific quorum and voting majority rules for ordinary and extraordinary general meetings.',
      'Requirement to maintain a dedicated bank account in the association’s name.',
      'Enforceable fast-track payment orders for unpaid HOA maintenance dues.'
    ],
    officialBulletinLink: 'https://adala.justice.gov.ma'
  },
  {
    id: 'loi-67-12',
    titleFr: 'Loi n° 67-12 organisant les rapports contractuels entre bailleurs et locataires',
    titleAr: 'القانون رقم 67-12 المنظم للعلاقات التعاقدية بين المكري والمكتري للمحلات السكنية',
    titleEn: 'Law No. 67-12 on Residential Tenancy and Lease Agreements',
    lawNumber: 'Loi 67-12 / Law 67-12',
    descriptionFr: 'Cadre légal régissant les baux d’habitation au Maroc, les modalités de révision du loyer, la résiliation judiciaire du bail et les conditions d’expulsion en cas de non-paiement.',
    descriptionAr: 'يحدد القواعد القانونية المنظمة لكراء المحلات السكنية والمهنية، بما في ذلك مراجعة السومة الكرائية (8% كل 3 سنوات)، وحالات إنهاء العقد ومسطرة الإفراغ لعدم أداء الوجيبة.',
    descriptionEn: 'Legal statutes governing residential leases in Morocco, statutory rent increase caps (8% every 3 years), court termination procedures, and eviction protocols.',
    keyPointsFr: [
      'Obligation d’un contrat écrit avec date certaine et état des lieux d’entrée.',
      'Plafonnement du dépôt de garantie à un maximum de 2 mois de loyer.',
      'Révision légale du loyer : augmentation maximale de 8% pour l’habitation tous les 3 ans.',
      'Procédure simplifiée de mise en demeure et résiliation pour loyers impayés.',
      'Motifs légaux de reprise : reprise pour occupation personnelle ou démolition/reconstruction.'
    ],
    keyPointsAr: [
      'إلزامية إبرام عقد كراء كتابي محرر بتاريخ ثابت ومحضر معاينة المحل.',
      'تسقيف واجب الضمانة في حدود شهرين من السومة الكرائية كحد أقصى.',
      'مراجعة وجيبة الكراء بنسبة لا تتجاوز 8% للسكن كل 3 سنوات.',
      'مسطرة الإنذار المسبق والأمر بالأداء في حالة التماطل في أداء الكراء.',
      'شروط استرجاع المحل للاستعمال الشخصي أو للهدم وإعادة البناء.'
    ],
    keyPointsEn: [
      'Requirement for written contract with certified date and walk-through inventory.',
      'Statutory cap on security deposit strictly limited to maximum 2 months rent.',
      'Statutory rent review: maximum 8% increase every 3 consecutive years for housing.',
      'Expedited formal notice and termination proceedings for delinquent rent payments.',
      'Grounds for owner repossession: personal occupation or licensed demolition/rebuilding.'
    ],
    officialBulletinLink: 'https://adala.justice.gov.ma'
  },
  {
    id: 'loi-39-08',
    titleFr: 'Loi n° 39-08 portant Code des Droits Réels',
    titleAr: 'القانون رقم 39-08 المتعلق بمدونة الحقوق العينية',
    titleEn: 'Law No. 39-08 enacting the Code of Real Rights',
    lawNumber: 'Loi 39-08 / Law 39-08',
    descriptionFr: 'La pierre angulaire du droit de propriété foncière au Maroc, définissant la pleine propriété, les servitudes, l’usufruit, les hypothèques et l’obligation d’actes authentiques ou à date certaine.',
    descriptionAr: 'العمود الفقري لحقوق الملكية العقارية بالمغرب، يحدد نطاق الملكية التامة، الرهون الرسمية، وحق الانتفاع، وإلزامية تحرير العقود من طرف موثق أو محامٍ مقبول لدى محكمة النقض.',
    descriptionEn: 'Cornerstone of property ownership and real estate law in Morocco, establishing freehold ownership, easements, mortgages, and mandatory authentic notarized contracts.',
    keyPointsFr: [
      'Formalisme obligatoire : les actes de vente doivent être rédigés par un notaire ou un avocat agréé près la Cour de Cassation.',
      'Force probante de l’inscription sur les livres fonciers à l’Agence Nationale de la Conservation Foncière (ANCFCC).',
      'Régime de la préemption (Chof’a) et du droit de retrait entre indivisaires.',
      'Règles relatives aux hypothèques conventionnelles et judiciaires.'
    ],
    keyPointsAr: [
      'إلزامية تحرير عقود نقل الملكية تحت طائلة البطلان من طرف موثق عصري أو عدول أو محامٍ مقبول للترافع أمام محكمة النقض.',
      'القوة الثبوتية للتسجيل والتقييد بالرسم العقاري لدى الوكالة الوطنية للمحافظة العقارية والمسح العقاري والخرائطية.',
      'أحكام حق الشفعة بين الشركاء في الملكية الشائعة.',
      'تنظيم الرهون الرسمية والحيازية والامتيازات العقارية.'
    ],
    keyPointsEn: [
      'Mandatory notarization: Deeds of sale must be drafted by a Notary or Supreme Court accredited lawyer.',
      'Indisputable legal evidentiary power of title registration with the ANCFCC Land Registry.',
      'Legal preemption rights (Chof’a) and co-owners retraction regulations in joint ownership.',
      'Comprehensive rules governing conventional and judicial real estate mortgages.'
    ]
  },
  {
    id: 'fiscalite-immo',
    titleFr: 'Fiscalité et Taxes Immobilières au Maroc',
    titleAr: 'النظام الضريبي والرسوم العقارية بالمغرب',
    titleEn: 'Real Estate Taxation & Registration Fees in Morocco',
    lawNumber: 'Code Général des Impôts (CGI)',
    descriptionFr: 'Synthèse des droits d’enregistrement, taxes de conservation foncière, taxe de profit immobilier (TPI) et taxes locales (TH/TSC).',
    descriptionAr: 'دليل الضرائب العقارية ورسوم التسجيل والتحفيظ، والضريبة على الأرباح العقارية والضرائب المحلية (رسم السكن والخدمات الجماعية).',
    descriptionEn: 'Summary guide to Moroccan registration duties, land conservation fees, real estate capital gains tax (TPI), and municipal taxes (TH/TSC).',
    keyPointsFr: [
      'Droits d’enregistrement à l’achat : 4% (3% pour logement social conventionné).',
      'Droits de Conservation Foncière : 1.5% + 200 DH (frais fixes) + 100 DH certificat.',
      'Honoraires de Notaire : environ 1% HT (soumis à TVA 10%).',
      'Taxe sur les Profits Immobiliers (TPI) : 20% sur la plus-value nette (exonération après 5 ans d’occupation pour résidence principale jusqu’à 4MDH).',
      'Taxe d’Habitation (TH) et Taxe de Services Communaux (TSC).'
    ],
    keyPointsAr: [
      'رسوم التسجيل عند الشراء: 4% من ثمن البيع الإجمالي (أو 3% للسكن الاجتماعي المعتمد).',
      'رسوم المحافظة العقارية: 1.5% + 200 درهم رسم ثابت + 100 درهم لشهادة الملكية.',
      'أتعاب الموثق: حوالي 1% دون احتساب الضريبة على القيمة المضافة (10%).',
      'الضريبة على الأرباح العقارية (TPI): 20% من فائض القيمة الصافي (مع إعفاء السكن الرئيسي بعد 5 سنوات في حدود 4 مليون درهم).',
      'رسم السكن ورسم الخدمات الجماعية (النظافة).'
    ],
    keyPointsEn: [
      'Registration duties on acquisition: 4% (3% for certified social housing).',
      'Land Registry (Conservation Foncière) fees: 1.5% + 200 MAD fixed fee + 100 MAD certificate.',
      'Notary fees: approx. 1% excl. VAT (subject to standard 10% VAT).',
      'Capital Gains Tax (TPI): 20% on net capital gains (primary residence exempt after 5 years up to 4M MAD).',
      'Housing Tax (TH) and Municipal Services Tax (TSC).'
    ]
  }
];
