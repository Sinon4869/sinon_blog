import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/security';

function looksLikeHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

export function MdxContent({ source }: { source: string }) {
  const htmlRaw = looksLikeHtml(source) ? source : (marked.parse(source, { gfm: true, breaks: true, async: false }) as string);
  const html = sanitizeHtml(htmlRaw);

  return (
    <article
      className="prose prose-zinc mobile-reading max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
