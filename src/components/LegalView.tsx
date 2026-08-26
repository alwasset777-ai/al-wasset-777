import React, { useState } from 'react';
import { 
  Scale, 
  FileText, 
  Download, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  AlertCircle, 
  BookOpen, 
  Percent, 
  FileCheck, 
  HelpCircle, 
  CheckCircle2,
  Printer
} from 'lucide-react';
import { LegalDocument, RealEstateLaw, Language } from '../types';
import { mockLegalDocuments, mockRealEstateLaws } from '../data/legalData';

interface LegalViewProps {
  language: Language;
  onPreviewDocument: (doc: LegalDocument) => void;
}

export const LegalView: React.FC<LegalViewProps> = ({ language, onPreviewDocument }) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  
  const [activeSection, setActiveSection] = useState<'modeles' | 'lois' | 'fiscalite'>('modeles');
  const [expandedLawId, setExpandedLawId] = useState<string | null>('loi-18-00');

  const toggleLaw = (id: string) => {
    setExpandedLawId(expandedLawId === id ? null : id);
  };

  const handleDownload = (doc: LegalDocument) => {
    // Generate text blob for download
    const content = isAr 
      ? doc.contentTemplateAr 
      : isEn && doc.contentTemplateEn 
      ? doc.contentTemplateEn 
      : doc.contentTemplateFr;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.id}_maroc.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getDocTitle = (doc: LegalDocument) => {
    if (isAr) return doc.titleAr;
    if (isEn && doc.titleEn) return doc.titleEn;
    return doc.titleFr;
  };

  const getDocDesc = (doc: LegalDocument) => {
    if (isAr) return doc.descriptionAr;
    if (isEn && doc.descriptionEn) return doc.descriptionEn;
    return doc.descriptionFr;
  };

  const getLawTitle = (law: RealEstateLaw) => {
    if (isAr) return law.titleAr;
    if (isEn && law.titleEn) return law.titleEn;
    return law.titleFr;
  };

  const getLawDesc = (law: RealEstateLaw) => {
    if (isAr) return law.descriptionAr;
    if (isEn && law.descriptionEn) return law.descriptionEn;
    return law.descriptionFr;
  };

  const getLawKeyPoints = (law: RealEstateLaw) => {
    if (isAr) return law.keyPointsAr;
    if (isEn && law.keyPointsEn) return law.keyPointsEn;
    return law.keyPointsFr;
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header */}
      <div className="border-b border-[#f2e6e4] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff0ed] text-[#ff6f61] text-xs font-bold mb-2">
            <Scale className="w-3.5 h-3.5" />
            <span>{isAr ? 'المرجع القانوني العقاري بالمغرب' : isEn ? 'Moroccan Real Estate Legal Framework' : 'Cadre Juridique Officiel'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#281715] tracking-tight">
            {isAr ? 'الفضاء القانوني ونماذج العقود' : isEn ? 'Legal Center & Contract Templates' : 'Espace Juridique & Modèles d’Actes'}
          </h1>
          <p className="text-xs sm:text-sm text-[#7a5c58] mt-1">
            {isAr
              ? 'نماذج عقود مطابقة للقانون المغربي، شرح نصوص القوانين (18-00، 67-12، 39-08)، ودليل الضرائب والرسوم.'
              : isEn
              ? 'Official contract templates conforming to Moroccan law, legal code summaries (18-00, 67-12, 39-08), and tax guide.'
              : 'Modèles d’actes certifiés, décryptage des lois marocaines et guide fiscal pour sécuriser vos transactions.'}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-[#f0e4e2] text-xs font-bold text-[#16a34a] shadow-xs">
          <ShieldCheck className="w-4 h-4" />
          <span>{isAr ? 'مطابق للتشريع المغربي' : isEn ? 'Moroccan Law Compliant' : 'Conforme Droit Marocain'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white rounded-3xl p-4 border border-[#f0e4e2] shadow-sm space-y-2 sticky top-24">
            <button
              onClick={() => setActiveSection('modeles')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-left transition-all cursor-pointer ${
                activeSection === 'modeles'
                  ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
                  : 'text-[#5a4340] hover:bg-[#fff8f7]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{isAr ? 'نماذج العقود الرسمية' : isEn ? 'Official Templates' : 'Modèles d’Actes'}</span>
            </button>

            <button
              onClick={() => setActiveSection('lois')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-left transition-all cursor-pointer ${
                activeSection === 'lois'
                  ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
                  : 'text-[#5a4340] hover:bg-[#fff8f7]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{isAr ? 'القوانين العقارية' : isEn ? 'Real Estate Laws' : 'Lois Immobilières'}</span>
            </button>

            <button
              onClick={() => setActiveSection('fiscalite')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-left transition-all cursor-pointer ${
                activeSection === 'fiscalite'
                  ? 'bg-[#ff6f61] text-white shadow-md shadow-[#ff6f61]/25'
                  : 'text-[#5a4340] hover:bg-[#fff8f7]'
              }`}
            >
              <Percent className="w-4 h-4" />
              <span>{isAr ? 'الضرائب والرسوم' : isEn ? 'Taxes & Fees' : 'Fiscalité & Taxes'}</span>
            </button>

            {/* Quick Consultation helper card */}
            <div className="pt-4 border-t border-[#f2e6e4] mt-4">
              <div className="p-3.5 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] text-xs space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-[#281715]">
                  <HelpCircle className="w-4 h-4 text-[#ff6f61]" />
                  <span>{isAr ? 'هل تحتاج لمساعدة؟' : isEn ? 'Notary Assistance' : 'Conseil notarial'}</span>
                </div>
                <p className="text-[#7a5c58] text-[11px] leading-relaxed">
                  {isAr
                    ? 'نوفر لك استشارات توجيهية حول صياغة العقود والتسجيل بالمحافظة العقارية.'
                    : isEn
                    ? 'Our experts assist you with contract drafting, notarization, and ANCFCC land registry filing.'
                    : 'Nos experts vous orientent dans le choix des actes et l’enregistrement à la Conservation Foncière.'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Main Content Area (3 Cols) */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* 1. Modèles d'Actes Section */}
          {activeSection === 'modeles' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-[#281715]">
                  {isAr ? 'نماذج العقود والمحررات الجاهزة للتحميل' : isEn ? 'Ready-to-Use Contracts & Deed Templates' : 'Modèles d’actes et contrats téléchargeables'}
                </h2>
                <p className="text-xs text-[#7a5c58] mt-1">
                  {isAr
                    ? 'نماذج محررة بعناية لتغطية مختلف المعاملات العقارية بالمغرب.'
                    : isEn
                    ? 'Download, preview, and customize standardized legal documents for property sales, rentals, and management in Morocco.'
                    : 'Téléchargez, personnalisez et prévisualisez vos modèles d’actes juridiques en PDF/Texte.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {mockLegalDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-2xl bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center">
                          <FileText className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-bold text-[#7a5c58] bg-[#fff8f7] px-2.5 py-1 rounded-full border border-[#f0e4e2]">
                          PDF • {doc.fileSize}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-[#ff6f61]">
                          {doc.category}
                        </span>
                        <h3 className="text-base font-extrabold text-[#281715] mt-0.5">
                          {getDocTitle(doc)}
                        </h3>
                      </div>

                      <p className="text-xs text-[#7a5c58] leading-relaxed">
                        {getDocDesc(doc)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-[#f2e6e4]">
                      <button
                        onClick={() => onPreviewDocument(doc)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#fff0ed] hover:bg-[#ffe5e0] text-[#ff6f61] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isAr ? 'معاينة النموذج' : isEn ? 'Preview' : 'Aperçu'}</span>
                      </button>

                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#281715] hover:bg-[#ff6f61] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>{isAr ? 'تحميل' : isEn ? 'Download' : 'Télécharger'}</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Lois Immobilières Section */}
          {activeSection === 'lois' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-[#281715]">
                  {isAr ? 'دليل القوانين العقارية بالمملكة المغربية' : isEn ? 'Moroccan Real Estate Laws & Legal Guides' : 'Textes de lois et réglementations immobilières'}
                </h2>
                <p className="text-xs text-[#7a5c58] mt-1">
                  {isAr
                    ? 'شرح مبسط لأهم القوانين المنظمة للملكية المشتركة، الكراء السكني، ومدونة الحقوق العينية.'
                    : isEn
                    ? 'Key legal provisions governing co-ownership, residential leasing, and property title laws in Morocco.'
                    : 'Synthèse des textes juridiques majeurs régissant la propriété, le bail et la copropriété au Maroc.'}
                </p>
              </div>

              <div className="space-y-4">
                {mockRealEstateLaws.slice(0, 3).map((law) => {
                  const isExpanded = expandedLawId === law.id;
                  return (
                    <div
                      key={law.id}
                      className="bg-white rounded-3xl border border-[#f0e4e2] overflow-hidden shadow-sm transition-all"
                    >
                      <button
                        onClick={() => toggleLaw(law.id)}
                        className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#fff8f7] transition-colors"
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-[#ff6f61]">
                            {law.lawNumber}
                          </span>
                          <h3 className="text-base font-extrabold text-[#281715]">
                            {getLawTitle(law)}
                          </h3>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center flex-shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-6 pt-0 border-t border-[#f2e6e4] space-y-4 text-xs text-[#5a4340] leading-relaxed animate-in fade-in duration-200">
                          <p className="text-sm text-[#281715] font-medium">
                            {getLawDesc(law)}
                          </p>

                          <div className="space-y-2 pt-2">
                            <h4 className="font-bold text-[#281715] text-xs">
                              {isAr ? 'أهم النقاط والمقتضيات القانونية:' : isEn ? 'Key Provisions & Obligations:' : 'Points clés à retenir :'}
                            </h4>
                            <div className="space-y-2">
                              {getLawKeyPoints(law).map((point, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] flex-shrink-0 mt-0.5" />
                                  <span>{point}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Fiscalité & Taxes Section */}
          {activeSection === 'fiscalite' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-[#281715]">
                  {isAr ? 'دليل الضرائب والرسوم العقارية بالمغرب' : isEn ? 'Real Estate Tax Guide & Notary Fees' : 'Guide de la fiscalité immobilière'}
                </h2>
                <p className="text-xs text-[#7a5c58] mt-1">
                  {isAr
                    ? 'جدول الرسوم المطبقة عند الشراء، البيع، والتحفيظ بالمحافظة العقارية.'
                    : isEn
                    ? 'Summary of registration duties, ANCFCC land conservation fees, and capital gains tax (TPI).'
                    : 'Détail des droits d’enregistrement, frais de conservation foncière et calcul de la TPI.'}
                </p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-[#f0e4e2] shadow-sm space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  <div className="p-4 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] space-y-2">
                    <div className="text-xs font-bold text-[#ff6f61]">
                      {isAr ? 'رسوم التسجيل' : isEn ? 'Registration Duties' : 'Droits d’Enregistrement'}
                    </div>
                    <div className="text-2xl font-black text-[#281715]">
                      4%
                    </div>
                    <p className="text-[11px] text-[#7a5c58]">
                      {isAr ? 'من ثمن البيع الإجمالي (أو 3% للسكن الاجتماعي).' : isEn ? 'Of the declared sales price in deed (3% for certified social housing).' : 'Du prix de vente stipulé dans l’acte (3% logement social conventionné).'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] space-y-2">
                    <div className="text-xs font-bold text-[#ff6f61]">
                      {isAr ? 'المحافظة العقارية' : isEn ? 'Land Registry (ANCFCC)' : 'Conservation Foncière'}
                    </div>
                    <div className="text-2xl font-black text-[#281715]">
                      1.5% + 200 DH
                    </div>
                    <p className="text-[11px] text-[#7a5c58]">
                      {isAr ? 'واجبات التقييد بالرسم العقاري مع 100 درهم لشهادة الملكية.' : isEn ? 'Title deed registration fee plus certificate.' : 'Droits d’inscription sur le titre foncier + certificat.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2] space-y-2">
                    <div className="text-xs font-bold text-[#ff6f61]">
                      {isAr ? 'الضريبة على الأرباح (TPI)' : isEn ? 'Capital Gains Tax (TPI)' : 'Taxe sur Profit Immo (TPI)'}
                    </div>
                    <div className="text-2xl font-black text-[#281715]">
                      20%
                    </div>
                    <p className="text-[11px] text-[#7a5c58]">
                      {isAr ? 'على فائض القيمة الصافي (مع إعفاء بعد 5 سنوات للسكن الرئيسي).' : isEn ? 'On net capital gains (exemption for primary residence after 5 years).' : 'Sur la plus-value nette. Exonération résidence principale > 5 ans.'}
                    </p>
                  </div>

                </div>

                {/* Additional Summary breakdown */}
                <div className="p-5 rounded-2xl bg-[#fff0ed] border border-[#ffd8d2] space-y-3">
                  <h4 className="font-extrabold text-sm text-[#281715]">
                    {isAr ? 'تقدير إجمالي مصاريف الشراء لدى الموثق' : isEn ? 'Overall Notary & Acquisition Cost Estimation' : 'Estimation globale des frais d’acquisition notariés'}
                  </h4>
                  <p className="text-xs text-[#5a4340] leading-relaxed">
                    {isAr
                      ? 'بشكل عام، تبلغ مصاريف الشراء الإجمالية (تسجيل + محافظة عقارية + أتعاب الموثق + طوابع) ما بين 6.5% و 7% من القيمة الإجمالية للعقار موضوع الشراء.'
                      : isEn
                      ? 'On average, total acquisition fees (registration duties, land conservation, notary fees + VAT, and disbursements) total between 6.5% and 7% of the total property purchase price in Morocco.'
                      : 'En moyenne, les frais totaux d’acquisition (enregistrement, conservation foncière, honoraires notaire HT + TVA et débours) représentent entre 6,5% et 7% du prix d’achat du bien immobilier.'}
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* Legal Disclaimer Box */}
          <div className="p-5 rounded-3xl bg-[#fff8f7] border border-[#f0e4e2] flex items-start gap-3 text-xs text-[#7a5c58]">
            <AlertCircle className="w-5 h-5 text-[#ff6f61] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-[#281715] block font-bold">
                {isAr ? 'تنبيه قانوني هام' : isEn ? 'Important Legal Notice' : 'Avertissement juridique important'}
              </strong>
              <p className="leading-relaxed text-[11px]">
                {isAr
                  ? 'نماذج العقود والمعلومات الواردة بهذا الفضاء مقدمة للاسترشاد والتوجيه. وفقاً لمقتضيات المادة 4 من القانون 39-08، يجب أن تحرر جميع التصرفات العقارية الناقلة للملكية بمحرر رسمي من طرف موثق أو عدول أو محامٍ مقبول لدى محكمة النقض لضمان حجيتها القانونية والتسجيل بالمحافظة العقارية.'
                  : isEn
                  ? 'The contract templates and information provided here are for guidance purposes. Pursuant to Article 4 of Moroccan Law No. 39-08 (Code of Real Property Rights), all property conveyance agreements must be drafted in authentic form by a notary or certified attorney to be enforceable and registered with ANCFCC.'
                  : 'Les modèles d’actes et informations fournis sont donnés à titre informatif. Conformément à l’article 4 de la Loi n° 39-08 portant Code des Droits Réels, les actes transférant la propriété doivent impérativement être rédigés par un notaire ou un avocat agréé près la Cour de Cassation pour être inscrits à la Conservation Foncière.'}
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
