import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useEffect, useMemo, useRef } from 'react';

marked.setOptions({ gfm: true, breaks: true });

const hasArabic = (s: string) => /[؀-ۿ]/.test(s.slice(0, 400));

/** Rendu Markdown sûr (nettoyé par DOMPurify) avec boutons « Copier » sur le code. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text || '', { async: false }) as string;
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'input', 'iframe'] });
  }, [text]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('a[href]').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    el.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-btn')) return;
      const b = document.createElement('button');
      b.className = 'copy-btn';
      b.textContent = 'Copier';
      b.onclick = () => {
        navigator.clipboard?.writeText(pre.querySelector('code')?.textContent || pre.textContent || '');
        b.textContent = 'Copié ✓';
        setTimeout(() => (b.textContent = 'Copier'), 1400);
      };
      pre.appendChild(b);
    });
  }, [html]);
  return <div ref={ref} dir={hasArabic(text) ? 'rtl' : undefined} className={`md ${className || ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
