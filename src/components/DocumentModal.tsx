import React, { useState } from 'react';
import { X, Download, Copy, Check, Printer, FileText, Scale } from 'lucide-react';
import { LegalDocument, Language } from '../types';

interface DocumentModalProps {
  document: LegalDocument | null;
  onClose: () => void;
  language: Language;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({
  document,
  onClose,
  language
}) => {
  const isAr = language === 'ar';
  const isEn = language === 'en';
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const content = isAr 
    ? document.contentTemplateAr 
    : isEn && document.contentTemplateEn 
    ? document.contentTemplateEn 
    : document.contentTemplateFr;

  const docTitle = isAr 
    ? document.titleAr 
    : isEn && document.titleEn 
    ? document.titleEn 
    : document.titleFr;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-[#f0e4e2] shadow-2xl overflow-hidden my-8 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#f2e6e4] flex items-center justify-between bg-[#fff8f7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#fff0ed] text-[#ff6f61] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#ff6f61] uppercase tracking-wider block">
                {document.category}
              </span>
              <h2 className="text-lg font-extrabold text-[#281715]">
                {docTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-white border border-[#f0e4e2] text-xs font-bold text-[#281715] hover:bg-[#fff0ed] hover:text-[#ff6f61] flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-[#16a34a]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? (isAr ? 'تم النسخ!' : isEn ? 'Copied!' : 'Copié !') : (isAr ? 'نسخ النص' : isEn ? 'Copy' : 'Copier')}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white text-[#7a5c58] hover:text-[#281715] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Text Preview Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#fffdfc]">
          <pre className="text-xs sm:text-sm font-mono text-[#281715] whitespace-pre-wrap leading-relaxed p-4 rounded-2xl bg-[#fff8f7] border border-[#f0e4e2]">
            {content}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#f2e6e4] flex items-center justify-between bg-[#fff8f7] text-xs">
          <div className="flex items-center gap-1.5 text-[#7a5c58]">
            <Scale className="w-4 h-4 text-[#ff6f61]" />
            <span>{isAr ? 'نموذج مطابق للقوانين المغربية' : isEn ? 'Compliant with Moroccan real estate regulations' : 'Conforme aux réglementations marocaines'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#281715] text-white font-bold cursor-pointer hover:bg-[#ff6f61] transition-colors"
          >
            {isAr ? 'إغلاق' : isEn ? 'Close' : 'Fermer'}
          </button>
        </div>

      </div>
    </div>
  );
};
