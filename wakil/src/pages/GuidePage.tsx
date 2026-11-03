import { BookOpen } from 'lucide-react';
import { useMemo } from 'react';
import { Markdown } from '../ui/Markdown';
import { cx, PageHeader } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';

// La documentation (dossier wakil/docs) est intégrée à l'application.
const docs = import.meta.glob('../../docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const DOC_LIST = Object.entries(docs)
  .map(([path, text]) => {
    const slug = path.split('/').pop()!.replace(/\.md$/, '');
    const title = (text.match(/^#\s+(.+)$/m)?.[1] || slug).replace(/^\d+\s*[–-]\s*/, '');
    return { slug, title, text };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

export function GuidePage({ slug }: { slug?: string }) {
  const doc = useMemo(() => DOC_LIST.find((d) => d.slug === slug), [slug]);
  return (
    <PageScroll>
      <PageHeader title="Guide Wakil" subtitle="Cahier des charges, architecture, installation, conformité et feuille de route." />
      <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        <nav className="card p-2 h-fit lg:sticky lg:top-4" aria-label="Documents">
          {DOC_LIST.map((d) => (
            <a key={d.slug} href={`#/guide/${d.slug}`} className={cx('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', d.slug === slug ? 'bg-surface-3 font-medium' : 'text-muted hover:bg-surface-2')}>
              <BookOpen size={14} className="shrink-0" /> <span className="truncate">{d.title}</span>
            </a>
          ))}
        </nav>
        <article className="card p-5 sm:p-7 min-w-0">{doc ? <Markdown text={doc.text} /> : <Markdown text={DOC_LIST[0]?.text || 'Documentation indisponible.'} />}</article>
      </div>
    </PageScroll>
  );
}
