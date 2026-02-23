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
          author: { select: { id: true, name: true, email: true } },
          tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
          cover_image: true,
          reading_time: true
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
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-5 sm:p-6">
        <h1 className="text-2xl font-bold sm:text-3xl">文章广场</h1>
        <p className="mt-1 text-sm text-zinc-600">最新内容、技术随笔与系统化实践。</p>
      </section>

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

      {featured && (
        <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {featured.cover_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.cover_image} alt={featured.title} className="h-56 w-full object-cover sm:h-72" />
          )}
          <div className="space-y-2 p-4 sm:p-5">
            <p className="text-xs text-zinc-500">置顶展示</p>
            <Link className="text-2xl font-bold leading-snug hover:underline" href={`/posts/${featured.slug}`}>
              {featured.title}
            </Link>
            <p className="text-sm text-zinc-600">
              {(featured.author?.name || featured.author?.email) ?? '匿名'} · {formatDate(featured.publishedAt || featured.createdAt)} ·{' '}
              {featured.reading_time || 1} min read
            </p>
            <p className="text-zinc-700">{featured.excerpt || '暂无摘要'}</p>
          </div>
        </article>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">文章列表</h2>
        {rest.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white sm:grid sm:grid-cols-[1.4fr_2fr]">
            {post.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image} alt={post.title} className="h-44 w-full object-cover sm:h-full" />
            ) : (
              <div className="h-44 bg-zinc-100 sm:h-full" />
            )}
            <div className="space-y-2 p-4">
              <Link className="text-xl font-semibold leading-snug hover:underline" href={`/posts/${post.slug}`}>
                {post.title}
              </Link>
              <p className="text-xs text-zinc-500">
                {(post.author?.name || post.author?.email) ?? '匿名'} · {formatDate(post.publishedAt || post.createdAt)} · {post.reading_time || 1} min read
              </p>
              <p className="text-zinc-700">{post.excerpt || '暂无摘要'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {post.tags.map((t: any) => (
                  <span key={t.tag.id} className="rounded bg-zinc-100 px-2 py-1 text-xs">
                    #{t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

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
