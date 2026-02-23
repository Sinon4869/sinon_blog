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

function buildPageHref(q: string, tag: string, page: number) {
  const params = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(tag ? { tag } : {}),
    page: String(page)
  });
  return `/?${params.toString()}` as Route;
}

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
        take: 24
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
    <div className="space-y-6 sm:space-y-8">
      <section className="rounded-2xl border border-[var(--line-soft)] bg-white/60 p-5 sm:p-8">
        <p className="text-xs tracking-[0.25em] text-zinc-500">KOMOREBI JOURNAL</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-wide text-zinc-800 sm:text-5xl">静かな場所で、ゆっくり読む。</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
          收录技术、日常与长期主义的笔记。把高噪音世界里剩下的沉默，写成可回看的文字。
        </p>
      </section>

      <form className="card grid gap-2 sm:grid-cols-[1fr_auto_auto]" action="/">
        <input className="input" name="q" placeholder="搜索标题或摘要..." defaultValue={q} />
        <input type="hidden" name="tag" value={tag} />
        <button className="btn" type="submit">
          搜索
        </button>
        {(q || tag) && (
          <Link className="rounded-md border border-[var(--line-strong)] px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/">
            清空
          </Link>
        )}
      </form>

      <section className="flex flex-wrap gap-2">
        <Link
          href={q ? `/?q=${encodeURIComponent(q)}` : '/'}
          className={`rounded-full border px-3 py-1 text-xs tracking-wide ${!tag ? 'border-[var(--bg-ink)] bg-[var(--bg-ink)] text-white' : 'border-[var(--line-strong)] text-zinc-700'}`}
        >
          全部
        </Link>
        {tags.map((t) => {
          const href = q ? `/?q=${encodeURIComponent(q)}&tag=${t.slug}` : `/?tag=${t.slug}`;
          return (
            <Link
              key={t.id}
              href={href as Route}
              className={`rounded-full border px-3 py-1 text-xs tracking-wide ${tag === t.slug ? 'border-[var(--bg-ink)] bg-[var(--bg-ink)] text-white' : 'border-[var(--line-strong)] text-zinc-700'}`}
            >
              #{t.name}
            </Link>
          );
        })}
      </section>

      {featured && (
        <article className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white/65 sm:grid sm:grid-cols-[1.1fr_1.2fr]">
          {featured.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.cover_image} alt={featured.title} className="h-56 w-full object-cover sm:h-full" />
          ) : (
            <div className="h-56 bg-zinc-200 sm:h-full" />
          )}
          <div className="space-y-4 p-5 sm:p-8">
            <p className="text-xs tracking-[0.25em] text-zinc-500">FEATURED NOTE</p>
            <Link href={`/posts/${featured.slug}`} className="block text-3xl font-semibold leading-tight text-zinc-800 hover:opacity-80 sm:text-4xl">
              {featured.title}
            </Link>
            <p className="text-sm leading-7 text-zinc-600">{featured.excerpt || '暂无摘要'}</p>
            <p className="text-xs text-zinc-500">
              {(featured.author?.name || featured.author?.email) ?? '匿名'} · {formatDate(featured.publishedAt || featured.createdAt)} ·{' '}
              {featured.reading_time || 1} min read
            </p>
          </div>
        </article>
      )}

      <section className="space-y-3">
        {rest.map((post) => (
          <article key={post.id} className="rounded-2xl border border-[var(--line-soft)] bg-white/55 p-4 sm:p-5">
            <p className="text-xs tracking-[0.2em] text-zinc-500">{formatDate(post.publishedAt || post.createdAt)}</p>
            <Link href={`/posts/${post.slug}`} className="mt-2 block text-2xl font-semibold leading-snug text-zinc-800 hover:opacity-80 sm:text-3xl">
              {post.title}
            </Link>
            <p className="mt-2 text-sm leading-7 text-zinc-600 sm:text-base">{post.excerpt || '暂无摘要'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {post.tags.map((t: any) => (
                <span key={t.tag.id} className="rounded-full border border-[var(--line-soft)] px-2 py-0.5 text-xs text-zinc-600">
                  #{t.tag.name}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      {posts.length === 0 && <p className="text-sm text-zinc-600">没有符合筛选条件的文章。</p>}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link className={`btn ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`} href={buildPageHref(q, tag, page - 1)}>
            上一页
          </Link>
          <span className="text-sm text-zinc-600">
            第 {page} / {totalPages} 页
          </span>
          <Link className={`btn ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`} href={buildPageHref(q, tag, page + 1)}>
            下一页
          </Link>
        </div>
      )}
    </div>
  );
}
