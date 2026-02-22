/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import type { Route } from 'next';

import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 8;

type HomeSearchParams = {
  q?: string;
  tag?: string;
  page?: string;
};

export default async function HomePage({ searchParams }: { searchParams: Promise<HomeSearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const tag = (sp.tag || '').trim();
  const page = Math.max(1, Number(sp.page || '1') || 1);

  const where = {
    published: true,
    ...(q
      ? {
          OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { excerpt: { contains: q, mode: 'insensitive' as const } }]
        }
      : {}),
    ...(tag
      ? {
          tags: {
            some: {
              tag: { slug: tag }
            }
          }
        }
      : {})
  };

  let posts: any[] = [];
  let total = 0;
  let tags: any[] = [];
  try {
    [posts, total, tags] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
          tags: { select: { tag: { select: { id: true, name: true, slug: true } } } }
        }
      }),
      prisma.post.count({ where }),
      prisma.tag.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
        take: 30
      })
    ]);
  } catch {
    posts = [];
    total = 0;
    tags = [];
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">最新文章</h1>

      <form className="card grid gap-2 sm:grid-cols-[1fr_auto_auto]" action="/">
        <input className="input" name="q" placeholder="搜索标题/摘要" defaultValue={q} />
        <input type="hidden" name="tag" value={tag} />
        <button className="btn" type="submit">
          搜索
        </button>
        {(q || tag) && (
          <Link className="btn bg-zinc-200 text-zinc-800 hover:bg-zinc-300" href="/">
            清除筛选
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <Link href={q ? `/?q=${encodeURIComponent(q)}` : '/'} className={`rounded px-2 py-1 text-xs ${!tag ? 'bg-zinc-900 text-white' : 'bg-zinc-100'}`}>
          全部
        </Link>
        {tags.map((t) => {
          const href = q ? `/?q=${encodeURIComponent(q)}&tag=${t.slug}` : `/?tag=${t.slug}`;
          return (
            <Link
              key={t.id}
              href={href as Route}
              className={`rounded px-2 py-1 text-xs ${tag === t.slug ? 'bg-zinc-900 text-white' : 'bg-zinc-100'}`}
            >
              #{t.name}
            </Link>
          );
        })}
      </div>

      {posts.map((post) => (
        <article className="card" key={post.id}>
          <Link className="text-lg font-semibold leading-snug hover:underline sm:text-xl" href={`/posts/${post.slug}`}>
            {post.title}
          </Link>
          <p className="mt-1 text-sm text-zinc-600">
            {post.author.name || post.author.email} · {formatDate(post.publishedAt || post.createdAt)}
          </p>
          <p className="mt-2 text-zinc-700">{post.excerpt || '暂无摘要'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((t: any) => (
              <span key={t.tag.id} className="rounded bg-zinc-100 px-2 py-1 text-xs">
                #{t.tag.name}
              </span>
            ))}
          </div>
        </article>
      ))}

      {posts.length === 0 && <p>没有符合筛选条件的文章。</p>}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            className={`btn ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
            href={`/?${new URLSearchParams({ ...(q ? { q } : {}), ...(tag ? { tag } : {}), page: String(page - 1) }).toString()}` as Route}
          >
            上一页
          </Link>
          <span className="text-sm text-zinc-600">
            第 {page} / {totalPages} 页
          </span>
          <Link
            className={`btn ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
            href={`/?${new URLSearchParams({ ...(q ? { q } : {}), ...(tag ? { tag } : {}), page: String(page + 1) }).toString()}` as Route}
          >
            下一页
          </Link>
        </div>
      )}
    </div>
  );
}
