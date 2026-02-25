/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { buildPostPath, formatDate } from '@/lib/utils';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const tag = (await prisma.tag.findUnique({ where: { slug } })) as { name?: string } | null;
  if (!tag) return { title: '分类不存在' };
  return {
    title: `${tag.name} · 分类`,
    description: `分类 ${tag.name} 下的文章列表`
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const tag = (await prisma.tag.findUnique({ where: { slug } })) as { id: string; name: string; slug: string } | null;
  if (!tag) return notFound();

  const posts = await prisma.post.findMany({
    where: {
      published: true,
      tags: { some: { tag: { slug } } }
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      createdAt: true,
      tags: { select: { tag: { select: { id: true, name: true, slug: true } } } }
    }
  });

  return (
    <div className="space-y-5">
      <section className="card">
        <p className="text-xs tracking-[0.2em] text-zinc-500">CATEGORY</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-800">#{tag.name}</h1>
        <p className="mt-2 text-sm text-zinc-600">该分类下共 {posts.length} 篇文章，按发布时间倒序展示。</p>
      </section>

      <section className="space-y-3">
        {posts.map((post: any) => (
          <article key={post.id} className="card">
            <p className="text-xs text-zinc-500">{formatDate(post.publishedAt || post.createdAt)}</p>
            <Link href={buildPostPath(post) as Route} className="mt-1 block text-xl font-semibold text-zinc-800 hover:underline">
              {post.title}
            </Link>
            <p className="mt-2 text-sm text-zinc-600">{post.excerpt || '暂无摘要'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {post.tags.map((t: any) => (
                <Link key={t.tag.id} href={`/category/${encodeURIComponent(t.tag.slug)}` as Route} className="rounded-full border border-[var(--line-soft)] px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100">
                  #{t.tag.name}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      {posts.length === 0 && <section className="card text-sm text-zinc-500">这个分类下还没有已发布文章。</section>}
    </div>
  );
}
