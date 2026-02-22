/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { MdxContent } from '@/lib/mdx';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { authOptions } from '@/lib/auth';
import { toggleFavorite } from '@/app/actions';

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

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="text-sm text-zinc-600">
        {post.author.name || post.author.email} · {formatDate(post.publishedAt || post.createdAt)}
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
