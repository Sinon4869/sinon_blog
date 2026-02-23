/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { toggleFavorite } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { MdxContent } from '@/lib/mdx';
import { prisma } from '@/lib/prisma';
import { isAnonymousCommentEnabled } from '@/lib/site-settings';
import { buildPostPath, formatDate } from '@/lib/utils';

async function findPostById(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: { author: true }
  });
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
  const [authorPostCount, globalTagCount, anonymousCommentEnabled] = await Promise.all([
    prisma.post.count({ where: { authorId: post.authorId, published: true } }),
    prisma.tag.findMany({}).then((rows) => rows.length),
    isAnonymousCommentEnabled()
  ]);

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={(post as any).background_image} alt={post.title} className="absolute inset-0 h-full w-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(247,246,242,0.94))]" />
          </>
        )}

        <div className="relative p-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-end">
            <div className="overflow-hidden rounded-2xl border border-white/70 bg-zinc-200/60 shadow-sm">
              {(post as any).cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(post as any).cover_image} alt={post.title} className="h-64 w-full object-cover sm:h-72 lg:h-[360px]" />
              ) : (
                <div className="flex h-64 items-end p-4 text-xs tracking-[0.2em] text-zinc-500 sm:h-72 lg:h-[360px]">KOMOREBI</div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-xs tracking-[0.26em] text-zinc-500">{formatDate(post.publishedAt || post.createdAt)}</p>
              <h1 className="text-4xl font-semibold leading-tight text-zinc-800 sm:text-5xl">{post.title}</h1>
              <p className="max-w-2xl text-sm leading-7 text-zinc-600">{post.excerpt || '写给沉默时刻的短章。'}</p>
              <p className="text-sm text-zinc-600">
                {post.author.name || post.author.email} · {(post as any).reading_time || 1} min read · {post.comments.length} 条评论
              </p>
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
          <article className="card rounded-2xl border-[var(--line-soft)] bg-white/78 p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line-soft)] pb-4">
              <p className="text-xs tracking-[0.2em] text-zinc-500">正文</p>
              {session?.user && (
                <form action={toggleFavorite}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="rounded-md border border-[var(--line-strong)] bg-[var(--bg-ink)] px-3 py-1.5 text-xs text-white hover:opacity-90" type="submit">
                    {favorited ? '取消收藏' : '收藏文章'}
                  </button>
                </form>
              )}
            </div>
            <MdxContent source={post.content} />
          </article>

          <section className="card rounded-2xl border-[var(--line-soft)] bg-white/75 p-5 sm:p-6">
            <h2 className="text-2xl font-semibold text-zinc-800">评论</h2>
            {session?.user && (
              <form action="/api/comments" method="post" className="mt-4 space-y-3">
                <input type="hidden" name="postId" value={post.id} />
                <textarea name="content" className="input min-h-24" required placeholder="写下你的评论" />
                <button className="btn" type="submit">
                  发表评论
                </button>
              </form>
            )}
            {!session?.user && anonymousCommentEnabled && (
              <form action="/api/comments" method="post" className="mt-4 space-y-3">
                <input type="hidden" name="postId" value={post.id} />
                <textarea name="content" className="input min-h-24" required placeholder="匿名评论（无需登录）" />
                <button className="btn" type="submit">
                  匿名发表评论
                </button>
              </form>
            )}
            {!session?.user && !anonymousCommentEnabled && (
              <p className="mt-3 text-sm text-zinc-500">
                请先
                <a href="/login" className="mx-1 underline">
                  登录
                </a>
                后发表评论。
              </p>
            )}
            <div className="mt-4 space-y-3">
              {post.comments.length === 0 && <p className="text-sm text-zinc-500">还没有评论。</p>}
              {post.comments.map((c: any) => (
                <div className="rounded-xl border border-[var(--line-soft)] bg-[#f7f6f2] p-3.5" key={c.id}>
                  <p className="text-xs tracking-wide text-zinc-500">{c.user.name || c.user.email}</p>
                  <p className="mt-1.5 leading-7 text-zinc-700">{c.content}</p>
                </div>
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
                {post.author.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author.image} alt={post.author.name || post.author.email} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg text-zinc-600">
                    {(post.author.name || post.author.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
                <div className="min-w-0">
                  <h4 className="truncate text-xl font-semibold text-zinc-800">{post.author.name || '匿名作者'}</h4>
                  <p className="text-xs tracking-[0.16em] text-zinc-500">持续写作记录</p>
                </div>
              </div>

              <p className="text-sm leading-7 text-zinc-600">{post.author.bio || '热爱写作，持续输出。'}</p>

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
        </aside>
      </section>
    </div>
  );
}
