/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { MdxContent } from '@/lib/mdx';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { authOptions } from '@/lib/auth';
import { toggleFavorite } from '@/app/actions';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug }, include: { author: true } });
  if (!post) return { title: '文章不存在' };

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://sinon.live';
  const url = `${base}/posts/${post.slug}`;
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

export default async function PostDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      author: true,
      tags: { include: { tag: true } },
      comments: { include: { user: true }, orderBy: { createdAt: 'desc' } }
    }
  });

  if (!post || (!post.published && session?.user?.id !== post.authorId && session?.user?.role !== 'ADMIN')) {
    return notFound();
  }

  const favorited = session?.user?.id
    ? await prisma.favorite.findUnique({
        where: { userId_postId: { userId: session.user.id, postId: post.id } }
      })
    : null;

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://sinon.live';
  const postUrl = `${base}/posts/${post.slug}`;
  const image = (post as any).cover_image || (post as any).background_image || undefined;
  const [authorPostCount, globalTagCount] = await Promise.all([
    prisma.post.count({ where: { authorId: post.authorId, published: true } }),
    prisma.tag.findMany({}).then((rows) => rows.length)
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
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="relative -mx-4 overflow-hidden rounded-none sm:-mx-6 lg:-mx-8">
        {(post as any).background_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(post as any).background_image} alt={post.title} className="h-[44vh] min-h-[300px] w-full object-cover sm:h-[52vh]" />
        ) : (
          <div className="h-[44vh] min-h-[300px] w-full bg-zinc-800 sm:h-[52vh]" />
        )}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
          <div className="mx-auto max-w-5xl space-y-3">
            <p className="text-sm text-zinc-200">{formatDate(post.publishedAt || post.createdAt)}</p>
            <h1 className="text-3xl font-bold sm:text-5xl">{post.title}</h1>
            <p className="text-sm text-zinc-200">
              {post.author.name || post.author.email} · {(post as any).reading_time || 1} min read · {post.comments.length} 条评论
            </p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((t: { tagId: string; tag: { name: string } }) => (
                <span key={t.tagId} className="rounded bg-white/15 px-2 py-1 text-xs">
                  #{t.tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2.2fr_1fr]">
        <article className="card space-y-4">
          <MdxContent source={post.content} />

          {session?.user && (
            <form action={toggleFavorite}>
              <input type="hidden" name="postId" value={post.id} />
              <button className="btn" type="submit">
                {favorited ? '取消收藏' : '收藏文章'}
              </button>
            </form>
          )}

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">评论</h2>
            {session?.user && (
              <form action="/api/comments" method="post" className="space-y-2">
                <input type="hidden" name="postId" value={post.id} />
                <textarea name="content" className="input min-h-24" required placeholder="写下你的评论" />
                <button className="btn" type="submit">
                  发表评论
                </button>
              </form>
            )}
            <div className="space-y-2">
              {post.comments.map((c: any) => (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3" key={c.id}>
                  <p className="text-sm text-zinc-500">{c.user.name || c.user.email}</p>
                  <p>{c.content}</p>
                </div>
              ))}
            </div>
          </section>
        </article>

        <aside className="space-y-4">
          <div className="card text-center">
            <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border border-zinc-200">
              {post.author.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.author.image} alt={post.author.name || post.author.email} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-2xl text-zinc-600">
                  {(post.author.name || post.author.email || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <h3 className="mt-3 text-2xl font-semibold">{post.author.name || '匿名作者'}</h3>
            <p className="mt-1 text-sm text-zinc-500">{post.author.bio || '热爱写作，持续输出。'}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-zinc-500">Articles</p>
                <p className="text-2xl font-semibold">{authorPostCount}</p>
              </div>
              <div>
                <p className="text-zinc-500">Tags</p>
                <p className="text-2xl font-semibold">{globalTagCount}</p>
              </div>
              <div>
                <p className="text-zinc-500">Comments</p>
                <p className="text-2xl font-semibold">{post.comments.length}</p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
