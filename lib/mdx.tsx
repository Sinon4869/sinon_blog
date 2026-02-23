import { marked } from 'marked';

function looksLikeHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

export function MdxContent({ source }: { source: string }) {
  const html = looksLikeHtml(source) ? source : (marked.parse(source, { gfm: true, breaks: true, async: false }) as string);

  return (
    <article
      className="prose prose-zinc max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
