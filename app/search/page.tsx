/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import type { Route } from 'next';

import { prisma } from '@/lib/prisma';
import { buildPostPath, formatDate } from '@/lib/utils';

const PAGE_SIZE = 10;

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlighted(text: string, keyword: string) {
  if (!keyword) return text;
  const reg = new RegExp(`(${escapeRegExp(keyword)})`, 'ig');
  const parts = text.split(reg);
  const lower = keyword.toLowerCase();
  return parts.map((p, i) =>
    p.toLowerCase() === lower ? (
      <mark key={`${p}-${i}`} className="rounded bg-yellow-200 px-0.5">
        {p}
      </mark>
    ) : (
      <span key={`${p}-${i}`}>{p}</span>
    )
  );
}

type SearchParams = {
  q?: string;
  page?: string;
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const page = Math.max(1, Number(sp.page || '1') || 1);

  if (!q) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">站内搜索</h1>
        <form className="card grid gap-2 sm:grid-cols-[1fr_auto]" action="/search">
          <input className="input" name="q" placeholder="输入关键词搜索标题/摘要" />
          <button className="btn" type="submit">
            搜索
          </button>
        </form>
      </div>
    );
  }

  const where = {
    published: true,
    OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { excerpt: { contains: q, mode: 'insensitive' as const } }]
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        createdAt: true,
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } }
      }
    }),
    prisma.post.count({ where })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold">搜索结果</h1>

      <form className="card grid gap-2 sm:grid-cols-[1fr_auto_auto]" action="/search">
        <input className="input" name="q" defaultValue={q} placeholder="输入关键词搜索标题/摘要" />
        <button className="btn" type="submit">
          搜索
        </button>
        <Link className="btn bg-zinc-200 text-zinc-800 hover:bg-zinc-300" href="/search">
          清空
        </Link>
      </form>

      <p className="text-sm text-zinc-600">
        关键词 <span className="font-semibold">“{q}”</span> 共找到 {total} 条
      </p>

      {posts.map((post: any) => (
        <article className="card" key={post.id}>
          <Link className="text-lg font-semibold leading-snug hover:underline sm:text-xl" href={buildPostPath(post) as Route}>
            {renderHighlighted(post.title || '', q)}
          </Link>
          <p className="mt-1 text-sm text-zinc-600">{formatDate(post.publishedAt || post.createdAt)}</p>
          <p className="mt-2 text-zinc-700">{renderHighlighted(post.excerpt || '暂无摘要', q)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((t: any) => (
              <span key={t.tag.id} className="rounded bg-zinc-100 px-2 py-1 text-xs">
                #{t.tag.name}
              </span>
            ))}
          </div>
        </article>
      ))}

      {posts.length === 0 && <p>没有匹配结果。</p>}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            className={`btn ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
            href={`/search?${new URLSearchParams({ q, page: String(page - 1) }).toString()}` as Route}
          >
            上一页
          </Link>
          <span className="text-sm text-zinc-600">
            第 {page} / {totalPages} 页
          </span>
          <Link
            className={`btn ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
            href={`/search?${new URLSearchParams({ q, page: String(page + 1) }).toString()}` as Route}
          >
            下一页
          </Link>
        </div>
      )}
    </div>
  );
}
