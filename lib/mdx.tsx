import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export function MdxContent({ source }: { source: string }) {
  return (
    <article className="prose prose-zinc max-w-none dark:prose-invert">
      <MDXRemote
        source={source}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeHighlight]
          }
        }}
      />
    </article>
  );
}
