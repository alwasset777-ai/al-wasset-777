import React, { useEffect, useState } from 'react';
import { Copy, Printer, X, Check } from 'lucide-react';
import { agencyProfile as A } from '../../data/agencyProfile';

interface Props {
  doc: { title: string; text: string } | null;
  onClose: () => void;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Contrat / document rédigé par l'agent : modifiable, à copier ou imprimer (« Enregistrer en PDF »).
export const DraftDocumentModal: React.FC<Props> = ({ doc, onClose }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTitle(doc?.title || '');
    setText(doc?.text || '');
  }, [doc]);

  if (!doc) return null;
  const rtl = /[؀-ۿ]/.test(text);

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="${rtl ? 'ar' : 'fr'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Tajawal,Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 24px;line-height:1.9;color:#111}
header{border-bottom:2px solid #281715;padding-bottom:8px;margin-bottom:20px;font-size:13px}h1{text-align:center;font-size:20px}
pre{white-space:pre-wrap;font-family:inherit;font-size:15px}</style></head><body>
<header><strong>${escapeHtml(A.fullNameAr)}</strong><br>${escapeHtml(A.addressAr)} — ${A.phonesLocal.join(' / ')}</header>
<h1>${escapeHtml(title)}</h1><pre>${escapeHtml(text)}</pre></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(`${title}\n\n${text}`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center gap-2 p-4 border-b border-[#f0e4e2]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 text-sm font-black bg-transparent focus:outline-none" />
          <button onClick={copy} className="p-2 rounded-xl hover:bg-[#fff0ed] text-[#7a5c58] cursor-pointer" title="نسخ">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={print} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#281715] text-white text-xs font-bold cursor-pointer">
            <Printer className="w-4 h-4" /> طباعة / PDF
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#fff0ed] cursor-pointer" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="auto"
          className="flex-1 min-h-[50vh] p-5 text-sm leading-7 focus:outline-none resize-none"
        />
        <p className="px-5 py-2 text-[11px] text-[#99807d] border-t border-[#f0e4e2]">
          مسودة من إعداد الوكيل: راجعها وكمّل الخانات [....] قبل التوقيع، ويُستحسن عرضها على موثق أو عدل.
        </p>
      </div>
    </div>
  );
};
