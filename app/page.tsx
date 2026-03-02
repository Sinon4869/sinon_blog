import { QuickShare } from '@/components/quick-share';
import { SmartImage } from '@/components/smart-image';
import Link from 'next/link';
import type { Route } from 'next';

import { getSiteUrl } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { buildPostPath, formatDate } from '@/lib/utils';

const PAGE_SIZE = 8;

type HomeSearchParams = {
  q?: string;
  tag?: string;
  page?: string;
};

type HomeTag = { id: string; name: string; slug: string };
type HomePostTag = { tag: HomeTag };
type HomePost = {
  id: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  cover_image: string | null;
  reading_time: number | null;
  tags: HomePostTag[];
};
type RecentPost = {
  id: string;
  title: string;
  publishedAt: Date | null;
  createdAt: Date;
  cover_image: string | null;
};
type CategoryStat = { id: string; name: string; slug: string; post_count: number };
type AnalyticsSummary = { today: { pv: number; uv: number }; sevenDays: { pv: number; uv: number } };

function buildPageHref(q: string, tag: string, page: number) {
  const params = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(tag ? { tag } : {}),
    page: String(page)
  });
  return `/?${params.toString()}` as Route;
}

function truncateSummary(text: string, max = 130) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const idx = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('，'), cut.lastIndexOf(' '));
  return `${(idx > 24 ? cut.slice(0, idx) : cut).trim()}...`;
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

  let posts: HomePost[] = [];
  let total = 0;
  let tags: HomeTag[] = [];
  let recentPosts: RecentPost[] = [];
  let categoryStats: CategoryStat[] = [];
  let analytics: AnalyticsSummary = { today: { pv: 0, uv: 0 }, sevenDays: { pv: 0, uv: 0 } };

  try {
    let tagsRaw: Array<Record<string, unknown>> = [];
    [posts, total, tagsRaw, recentPosts, categoryStats, analytics] = await Promise.all([
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
          author: { select: { id: true, name: true, email: true } },
          tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
          cover_image: true,
          reading_time: true
        }
      }),
      prisma.post.count({ where }),
      prisma.tag.findMany({
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, slug: true },
        take: 30
      }) as Promise<Array<Record<string, unknown>>>,
      prisma.post.findMany({
        where: { published: true },
        orderBy: { publishedAt: 'desc' },
        take: 6,
        select: { id: true, title: true, publishedAt: true, createdAt: true, cover_image: true }
      }),
      prisma.tag.adminList() as Promise<CategoryStat[]>,
      prisma.analytics.summary().catch((): AnalyticsSummary => ({ today: { pv: 0, uv: 0 }, sevenDays: { pv: 0, uv: 0 } })),
    ]);

    tags = tagsRaw.map((t) => ({
      id: String(t.id || ''),
      name: String(t.name || ''),
      slug: String(t.slug || '')
    }));
  } catch {
    posts = [];
    total = 0;
    tags = [];
    recentPosts = [];
    categoryStats = [];
    analytics = { today: { pv: 0, uv: 0 }, sevenDays: { pv: 0, uv: 0 } };
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shareBase = getSiteUrl('https://sinon.live');
  const featured = posts[0];
  const rest = posts.slice(1);
  const updatedAt = posts[0]?.publishedAt || posts[0]?.createdAt;

  return (
    <div className="space-y-7 sm:space-y-8">
      <section className="hero-panel p-5 sm:p-7">
        <div>
          <p className="section-kicker">KOMOREBI JOURNAL</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-wide text-zinc-800 sm:text-5xl">静かな場所で、ゆっくり読む。</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">收录技术、日常与长期主义的笔记。把高噪音世界里剩下的沉默，写成可回看的文字。</p>
        </div>
      </section>

      <form className="card grid gap-2 sm:grid-cols-[1fr_auto_auto]" action="/">
        <input className="input" name="q" placeholder="搜索标题或摘要..." defaultValue={q} />
        <input type="hidden" name="tag" value={tag} />
        <button className="btn" type="submit">
          搜索
        </button>
        {(q || tag) && (
          <Link className="btn-secondary" href="/">
            清空
          </Link>
        )}
      </form>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <p className="section-kicker">CATEGORIES</p>
          <p className="text-xs text-zinc-500">轻量筛选</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={q ? (`/?q=${encodeURIComponent(q)}` as Route) : '/'} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs tracking-wide ${!tag ? 'border-[var(--bg-ink)] bg-[var(--bg-ink)] text-white' : 'border-[var(--line-strong)] text-zinc-700'}`}>
            全部
          </Link>
          {tags.map((t: HomeTag) => (
            <Link
              key={t.id}
              href={`/category/${encodeURIComponent(t.slug)}` as Route}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs tracking-wide ${tag === t.slug ? 'border-[var(--bg-ink)] bg-[var(--bg-ink)] text-white' : 'border-[var(--line-strong)] text-zinc-700'}`}
            >
              #{t.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {featured && (
            <article className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white/72 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md hover:shadow-zinc-900/10 sm:grid sm:min-h-[320px] sm:grid-cols-[1.05fr_1.15fr]">
              {featured.cover_image ? (
                <SmartImage src={featured.cover_image} alt={featured.title} width={1200} height={700} className="h-56 w-full object-cover sm:h-[320px]" />
              ) : (
                <div className="h-56 bg-zinc-200 sm:h-[320px]" />
              )}
              <div className="space-y-3 p-5 sm:p-7">
                <p className="section-kicker">FEATURED NOTE</p>
                <Link href={buildPostPath(featured) as Route} className="line-clamp-2 block text-2xl font-semibold leading-tight text-zinc-800 hover:opacity-80 sm:text-[2rem]">
                  {featured.title}
                </Link>
                <p className="line-clamp-3 text-sm leading-7 text-zinc-600">{truncateSummary(featured.excerpt || '暂无摘要', 160)}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span>🗓 {formatDate(featured.publishedAt || featured.createdAt)}</span>
                  <span>·</span>
                  <span>⏱ {featured.reading_time || 1} min</span>
                  {(featured.tags || []).slice(0, 2).map((t: HomePostTag) => (
                    <span key={t.tag.id} className="rounded-full border border-[var(--line-soft)] px-2 py-0.5 text-zinc-600">
                      #{t.tag.name}
                    </span>
                  ))}
                  {(featured.tags || []).length > 2 && <span>+{featured.tags.length - 2}</span>}
                </div>
                <QuickShare url={`${shareBase}${buildPostPath(featured)}`} title={featured.title} className="flex flex-wrap items-center gap-2" />
              </div>
            </article>
          )}

          <div className="space-y-3">
            {rest.map((post: HomePost) => {
              const cardHref = buildPostPath(post) as Route;
              const tagsShown = (post.tags || []).slice(0, 3);
              const extraCount = Math.max(0, (post.tags || []).length - tagsShown.length);
              return (
                <article key={post.id} className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white/70 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md hover:shadow-zinc-900/10 sm:grid sm:min-h-[236px] sm:grid-cols-[1.05fr_0.95fr]">
                  <Link href={cardHref} className="block">
                    {post.cover_image ? (
                      <SmartImage src={post.cover_image} alt={post.title} width={900} height={560} className="h-48 w-full object-cover sm:h-[236px]" />
                    ) : (
                      <div className="h-48 bg-zinc-200 sm:h-[236px]" />
                    )}
                  </Link>

                  <div className="flex h-full flex-col justify-center space-y-2 p-4 sm:p-5">
                    <Link href={cardHref} className="block line-clamp-2 text-xl font-semibold leading-snug text-zinc-800 hover:opacity-80">
                      {post.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                      <span>🗓 {formatDate(post.publishedAt || post.createdAt)}</span>
                      <span>·</span>
                      <span>⏱ {post.reading_time || 1} min</span>
                      {tagsShown.map((t: HomePostTag) => (
                        <span key={t.tag.id}>#{t.tag.name}</span>
                      ))}
                      {extraCount > 0 && <span>+{extraCount}</span>}
                    </div>
                    <p className="line-clamp-2 text-sm leading-7 text-zinc-600 sm:line-clamp-3">{truncateSummary(post.excerpt || '暂无摘要', 130)}</p>
                    <QuickShare url={`${shareBase}${buildPostPath(post)}`} title={post.title} className="flex flex-wrap items-center gap-2" />
                  </div>
                </article>
              );
            })}
          </div>

          {posts.length === 0 && (
            <section className="rounded-2xl border border-[var(--line-soft)] bg-white/60 p-6 text-center">
              <p className="section-kicker">EMPTY RESULT</p>
              <p className="mt-2 text-base text-zinc-700">没有符合筛选条件的文章。</p>
            </section>
          )}

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

        <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
          <section className="card space-y-2">
            <h3 className="text-sm font-semibold text-zinc-700">最近文章</h3>
            {recentPosts.length === 0 ? (
              <p className="text-sm text-zinc-500">暂无数据</p>
            ) : (
              recentPosts.map((p: RecentPost) => (
                <Link key={p.id} href={buildPostPath(p) as Route} className="flex h-16 items-center gap-2 rounded-lg border border-[var(--line-soft)] bg-white/70 p-2 hover:bg-white">
                  {p.cover_image ? (
                    <SmartImage src={p.cover_image} alt={p.title} width={96} height={72} className="h-12 w-16 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-16 rounded bg-zinc-200" />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm text-zinc-800">{p.title}</p>
                    <p className="text-xs text-zinc-500">{formatDate(p.publishedAt || p.createdAt)}</p>
                  </div>
                </Link>
              ))
            )}
          </section>

          <section className="card space-y-2">
            <h3 className="text-sm font-semibold text-zinc-700">分类</h3>
            {(categoryStats || []).slice(0, 8).map((c: CategoryStat) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <Link href={`/category/${encodeURIComponent(c.slug)}` as Route} className="text-zinc-700 hover:underline">
                  {c.name}
                </Link>
                <span className="text-zinc-500">{c.post_count}</span>
              </div>
            ))}
          </section>

          <section className="card space-y-2">
            <h3 className="text-sm font-semibold text-zinc-700">标签</h3>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 20).map((t: HomeTag) => (
                <Link key={t.id} href={`/category/${encodeURIComponent(t.slug)}` as Route} className="rounded-full border border-[var(--line-soft)] px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100">
                  #{t.name}
                </Link>
              ))}
            </div>
          </section>

          <section className="card space-y-2">
            <h3 className="text-sm font-semibold text-zinc-700">站点概览</h3>
            <div className="space-y-1 text-xs text-zinc-600">
              <p>文章数：{total}</p>
              <p>分类数：{tags.length}</p>
              <p>7d PV：{analytics.sevenDays?.pv ?? 0}</p>
              <p>7d UV：{analytics.sevenDays?.uv ?? 0}</p>
              <p>最近更新：{updatedAt ? formatDate(updatedAt) : '-'}</p>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
