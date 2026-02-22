import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { deletePost } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const [posts, favorites]: [
    Array<{ id: string; title: string; published: boolean }>,
    Array<{ id: string; post: { slug: string; title: string } }>
  ] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, published: true }
    }),
    prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { post: { select: { slug: true, title: true } } }
    })
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">我的控制台</h1>
      <Link className="btn" href="/write">
        + 新建文章
      </Link>

      <section>
        <h2 className="mb-2 text-lg font-semibold">我的文章</h2>
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-zinc-500">{p.published ? '已发布' : '草稿'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link className="text-sm underline" href={`/write?id=${p.id}`}>
                  编辑
                </Link>
                <form action={deletePost}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-sm text-red-600" type="submit">
                    删除
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">我的收藏（MVP）</h2>
        <ul className="list-disc pl-5 text-sm">
          {favorites.map((f) => (
            <li key={f.id}>
              <Link href={`/posts/${f.post.slug}`} className="underline">
                {f.post.title}
              </Link>
            </li>
          ))}
          {favorites.length === 0 && <li>暂无收藏</li>}
        </ul>
      </section>
    </div>
  );
}
