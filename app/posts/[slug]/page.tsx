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
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {(post as any).background_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={(post as any).background_image} alt={post.title} className="h-56 w-full rounded-xl object-cover" />
      )}

      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="text-sm text-zinc-600">
        {post.author.name || post.author.email} · {formatDate(post.publishedAt || post.createdAt)} · {(post as any).reading_time || 1} min read
      </p>
      <div className="flex gap-2">
        {post.tags.map((t: { tagId: string; tag: { name: string } }) => (
          <span key={t.tagId} className="rounded bg-zinc-100 px-2 py-1 text-xs">
            #{t.tag.name}
          </span>
        ))}
      </div>
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
            <div className="card" key={c.id}>
              <p className="text-sm text-zinc-500">{c.user.name || c.user.email}</p>
              <p>{c.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
