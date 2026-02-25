/* eslint-disable @typescript-eslint/no-explicit-any */
import { PostReadingEnhancements } from '@/components/post-reading-enhancements';
import { SmartImage } from '@/components/smart-image';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { toggleFavorite } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { MdxContent } from '@/lib/mdx';
import { prisma } from '@/lib/prisma';
import { getPersonalIntro, isAnonymousCommentEnabled } from '@/lib/site-settings';
import { buildPostPath, formatDate } from '@/lib/utils';

async function findPostById(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: { author: true }
  });
}


function htmlToPlainText(input: string) {
  return String(input || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateMetadata({ params }: { params: Promise<{ year: string; month: string; day: string; id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await findPostById(id);
  if (!post) return { title: '文章不存在' };

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://sinon.live';
  const postPath = buildPostPath(post as { id: string; publishedAt?: Date | string | null; createdAt?: Date | string | null });
  const url = `${base}${postPath}`;
  const title = (post as any).seo_title || post.title;
  const description = (post as any).seo_description || post.excerpt || '文章详情';
  const image = (post as any).cover_image || (post as any).background_image || undefined;

  return {
    title,
    description,
    alternates: { canonical: (post as any).canonical_url || url },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      images: image ? [{ url: image }] : undefined
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined
    }
  };
}

export default async function PostDetail({ params }: { params: Promise<{ year: string; month: string; day: string; id: string }> }) {
  const { year, month, day, id } = await params;
  const session = await getServerSession(authOptions);

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: true,
      tags: { include: { tag: true } },
      comments: { include: { user: true }, orderBy: { createdAt: 'desc' } }
    }
  });

  if (!post || (!post.published && session?.user?.id !== post.authorId && session?.user?.role !== 'ADMIN')) {
    return notFound();
  }

  const canonicalPath = buildPostPath(post as { id: string; publishedAt?: Date | string | null; createdAt?: Date | string | null });
  const canonicalParts = canonicalPath.split('/').filter(Boolean);
  const canonicalYear = canonicalParts[1] || '';
  const canonicalMonth = canonicalParts[2] || '';
  const canonicalDay = canonicalParts[3] || '';
  const canonicalId = canonicalParts[4] || '';
  const currentId = id;

  const sameDate = year === canonicalYear && month === canonicalMonth && day === canonicalDay;
  const sameId = currentId === canonicalId;
  if (!(sameDate && sameId)) {
    redirect(canonicalPath as Route);
  }

  const favorited = session?.user?.id
    ? await prisma.favorite.findUnique({
        where: { userId_postId: { userId: session.user.id, postId: post.id } }
      })
    : null;

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://sinon.live';
  const postUrl = `${base}${canonicalPath}`;
  const image = (post as any).cover_image || (post as any).background_image || undefined;
  const tagSlugs = post.tags.map((t: { tag: { slug: string } }) => t.tag.slug).filter(Boolean);

  const [authorPostCount, globalTagCount, anonymousCommentEnabled, relatedRaw, personalIntro, postViews] = await Promise.all([
    prisma.post.count({ where: { authorId: post.authorId, published: true } }),
    prisma.tag.findMany({}).then((rows) => rows.length),
    isAnonymousCommentEnabled(),
    tagSlugs.length
      ? prisma.post.findMany({
          where: { published: true, tags: { some: { tag: { slug: tagSlugs[0] } } } },
          orderBy: { publishedAt: 'desc' },
          take: 12,
          select: {
            id: true,
            title: true,
            excerpt: true,
            publishedAt: true,
            createdAt: true,
            tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
            cover_image: true,
            _count: { select: { comments: true } }
          }
        })
      : prisma.post.findMany({
          where: { published: true, authorId: post.authorId },
          orderBy: { publishedAt: 'desc' },
          take: 12,
          select: {
            id: true,
            title: true,
            excerpt: true,
            publishedAt: true,
            createdAt: true,
            tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
            cover_image: true,
            _count: { select: { comments: true } }
          }
        }),
    getPersonalIntro(),
    prisma.transaction(async (tx) => {
      const row = await tx.one<{ c: number }>('SELECT COUNT(*) as c FROM page_view_events WHERE post_id = ?', post.id);
      return Number(row?.c ?? 0);
    }).catch(() => 0)
  ]);

  const relatedPosts = (relatedRaw || []).filter((p: any) => p.id !== post.id).slice(0, 4);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: (post as any).seo_title || post.title,
    description: (post as any).seo_description || post.excerpt || '',
    datePublished: (post.publishedAt || post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: post.author.name || post.author.email
    },
    image: image ? [image] : undefined,
    mainEntityOfPage: postUrl
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: base },
      { '@type': 'ListItem', position: 2, name: post.title, item: postUrl }
    ]
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="relative overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-[linear-gradient(140deg,#f7f6f2_0%,#ece8df_55%,#e4ded3_100%)]">
        {(post as any).background_image && (
          <>
            <SmartImage src={(post as any).background_image} alt={post.title} width={1400} height={600} className="absolute inset-0 h-full w-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(247,246,242,0.94))]" />
          </>
        )}

        <div className="relative p-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-end">
            <div className="overflow-hidden rounded-2xl border border-white/70 bg-zinc-200/60 shadow-sm">
              {(post as any).cover_image ? (
                <SmartImage src={(post as any).cover_image} alt={post.title} width={960} height={640} className="h-64 w-full object-cover sm:h-72 lg:h-[360px]" />
              ) : (
                <div className="flex h-64 items-end p-4 text-xs tracking-[0.2em] text-zinc-500 sm:h-72 lg:h-[360px]">KOMOREBI</div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-xs tracking-[0.26em] text-zinc-500">{formatDate(post.publishedAt || post.createdAt)}</p>
              <h1 className="text-4xl font-semibold leading-tight text-zinc-800 sm:text-5xl">{post.title}</h1>
              <p className="max-w-2xl text-sm leading-7 text-zinc-600">{post.excerpt || '写给沉默时刻的短章。'}</p>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600">
                  <span>👤 {post.author.name || post.author.email}</span>
                  <span>·</span>
                  <span>🗓 {formatDate(post.publishedAt || post.createdAt)}</span>
                  <span>·</span>
                  <span>🏷 {post.tags[0]?.tag?.name ? `#${post.tags[0].tag.name}` : '未分类'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
                  <span>📝 Word Count: {Math.max(1, htmlToPlainText(post.content).split(/\s+/).filter(Boolean).length)}</span>
                  <span>⏱ Reading Time: {(post as any).reading_time || 1} mins</span>
                  <span>👁 Post Views: {postViews}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((t: { tagId: string; tag: { name: string } }) => (
                  <span key={t.tagId} className="rounded-full border border-[var(--line-soft)] bg-white/70 px-2.5 py-1 text-xs text-zinc-700">
                    #{t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <article id="post-content" className="card rounded-2xl border-[var(--line-soft)] bg-white/78 p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line-soft)] pb-4">
              <p className="section-kicker">正文</p>
              {session?.user && (
                <form action={toggleFavorite}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="btn-secondary" type="submit">
                    {favorited ? '取消收藏' : '收藏文章'}
                  </button>
                </form>
              )}
            </div>
            <MdxContent source={post.content} />
          </article>

          <section className="card rounded-2xl border-[var(--line-soft)] bg-white/75 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-zinc-800">相关文章</h2>
              <a href="/archives" className="text-xs text-zinc-500 hover:underline">查看归档</a>
            </div>
            {relatedPosts.length === 0 ? (
              <p className="text-sm text-zinc-500">暂无相关文章。</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {relatedPosts.map((rp: any) => (
                  <article key={rp.id} className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[#f7f6f2] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-sm">
                    <a href={buildPostPath(rp)} className="block">
                      {rp.cover_image ? (
                        <SmartImage src={rp.cover_image} alt={rp.title} width={480} height={260} className="h-28 w-full object-cover" />
                      ) : (
                        <div className="h-28 w-full bg-zinc-200" />
                      )}
                    </a>
                    <div className="space-y-1.5 p-3">
                      <a href={buildPostPath(rp)} className="line-clamp-2 text-base font-semibold leading-snug text-zinc-800 hover:underline">
                        {rp.title}
                      </a>
                      <p className="text-xs text-zinc-500">{formatDate(rp.publishedAt || rp.createdAt)} · {rp._count?.comments ?? 0} 条评论</p>
                      <p className="line-clamp-2 text-sm text-zinc-600">{rp.excerpt || '暂无摘要'}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card rounded-2xl border-[var(--line-soft)] bg-white/75 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line-soft)] pb-3">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-800">
                <span>💬</span>
                <span>Comments</span>
              </h2>
              <p className="text-sm text-zinc-500">{post.comments.length} 条评论</p>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--line-soft)] bg-[#f7f6f2] p-3">
              {session?.user && (
                <form action="/api/comments" method="post" className="space-y-3">
                  <input type="hidden" name="postId" value={post.id} />
                  <textarea name="content" className="input min-h-24" required placeholder="加入讨论..." />
                  <div className="flex items-center justify-end">
                    <button className="btn" type="submit">
                      发表评论
                    </button>
                  </div>
                </form>
              )}
              {!session?.user && anonymousCommentEnabled && (
                <form action="/api/comments" method="post" className="space-y-3">
                  <input type="hidden" name="postId" value={post.id} />
                  <textarea name="content" className="input min-h-24" required placeholder="匿名评论（无需登录）" />
                  <div className="flex items-center justify-end">
                    <button className="btn" type="submit">
                      匿名发表评论
                    </button>
                  </div>
                </form>
              )}
              {!session?.user && !anonymousCommentEnabled && (
                <p className="text-sm text-zinc-500">
                  请先
                  <a href="/login" className="mx-1 underline">
                    登录
                  </a>
                  后发表评论。
                </p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {post.comments.length === 0 && <p className="text-sm text-zinc-500">还没有评论。</p>}
              {post.comments.map((c: any) => (
                <article className="rounded-xl border border-[var(--line-soft)] bg-white p-3.5" key={c.id}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700">
                      {(c.user.name || c.user.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium text-zinc-800">{c.user.name || c.user.email}</p>
                        <span className="text-xs text-zinc-500">{formatDate(c.createdAt || new Date())}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap leading-7 text-zinc-700">{c.content}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[linear-gradient(150deg,#faf9f5,#efece4)] shadow-sm shadow-zinc-900/5">
            <div className="border-b border-[var(--line-soft)] bg-[rgba(255,255,255,0.65)] p-4">
              <p className="text-[11px] tracking-[0.22em] text-zinc-500">AUTHOR PROFILE</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-white bg-zinc-100 shadow-sm">
                {(personalIntro.avatar || post.author.image) ? (
                  <SmartImage src={personalIntro.avatar || post.author.image} alt={personalIntro.name || post.author.name || post.author.email} width={64} height={64} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg text-zinc-600">
                    {(personalIntro.name || post.author.name || post.author.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
                <div className="min-w-0">
                  <h4 className="truncate text-xl font-semibold text-zinc-800">{personalIntro.name || post.author.name || '匿名作者'}</h4>
                  <p className="text-xs tracking-[0.16em] text-zinc-500">持续写作记录</p>
                </div>
              </div>

              <p className="text-sm leading-7 text-zinc-600">{personalIntro.bio || post.author.bio || '热爱写作，持续输出。'}</p>
              {personalIntro.links?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {personalIntro.links.map((l) => (
                    <a key={l.label} href={l.url} className="rounded border border-[var(--line-soft)] bg-white/70 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100" target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))}
                </div>
              )}

              <div className="space-y-2 rounded-xl border border-[var(--line-soft)] bg-white/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">文章</p>
                  <p className="text-sm font-semibold text-zinc-800">{authorPostCount}</p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full rounded-full bg-[var(--accent-moss)]" style={{ width: `${Math.min(100, Math.max(10, authorPostCount * 10))}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-[var(--line-soft)] bg-white/70 px-2 py-2">
                  <p className="text-[11px] tracking-wide text-zinc-500">标签</p>
                  <p className="text-lg font-semibold text-zinc-800">{globalTagCount}</p>
                </div>
                <div className="rounded-lg border border-[var(--line-soft)] bg-white/70 px-2 py-2">
                  <p className="text-[11px] tracking-wide text-zinc-500">评论</p>
                  <p className="text-lg font-semibold text-zinc-800">{post.comments.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line-soft)] bg-white/65 p-4">
            <p className="text-xs tracking-[0.24em] text-zinc-500">文档信息</p>
            <p className="mt-2 text-sm leading-7 text-zinc-600">文档编号：{post.id}</p>
            <p className="text-sm leading-7 text-zinc-600">发布日期：{formatDate(post.publishedAt || post.createdAt)}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line-soft)] bg-white/65 p-4">
            <PostReadingEnhancements containerId="post-content" />
          </div>
        </aside>
      </section>
    </div>
  );
}
