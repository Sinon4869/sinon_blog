import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { deletePost } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';

type PostItem = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

type FavoriteItem = {
  id: string;
  post: { slug: string; title: string; publishedAt?: string | null; createdAt?: string | null };
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="card space-y-1 border border-zinc-200 bg-white">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const [posts, favorites]: [PostItem[], FavoriteItem[]] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, slug: true, published: true, createdAt: true, updatedAt: true }
    }),
    prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { post: { select: { slug: true, title: true, publishedAt: true, createdAt: true } } }
    })
  ]);

  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.length - publishedCount;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const publishedIn7Days = posts.filter((p) => p.published && new Date(p.updatedAt).getTime() >= weekAgo).length;
  const recentPosts = posts.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Dashboard Overview</p>
            <h1 className="text-2xl font-bold sm:text-3xl">我的控制台</h1>
            <p className="text-sm text-zinc-600">快速查看写作状态、近期内容与常用操作。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn" href="/write/new">
              + 新建文章
            </Link>
            <Link className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100" href="/search">
              搜索文章
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="总文章" value={posts.length} hint="所有已创建内容" />
        <StatCard label="已发布" value={publishedCount} hint="对外可见内容" />
        <StatCard label="草稿" value={draftCount} hint="待完善内容" />
        <StatCard label="近 7 天发布" value={publishedIn7Days} hint="最近发布节奏" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="card border border-zinc-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">最近内容</h2>
              <Link className="text-sm text-zinc-600 underline" href="/write/new">
                新建
              </Link>
            </div>

            <div className="space-y-2">
              {recentPosts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
                  你还没有文章。点击“新建文章”开始写作。
                </div>
              ) : (
                recentPosts.map((p) => (
                  <div key={p.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900">{p.title}</p>
                        <p className="text-xs text-zinc-500">最近更新：{formatDate(p.updatedAt)}</p>
                      </div>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          p.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.published ? '已发布' : '草稿'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <Link className="underline" href={`/write?id=${p.id}`}>
                        继续编辑
                      </Link>
                      <Link className="underline" href={`/posts/${p.slug}`}>
                        查看文章
                      </Link>
                      <form action={deletePost}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="text-red-600" type="submit">
                          删除
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card border border-zinc-200">
            <h2 className="mb-3 text-lg font-semibold">我的收藏</h2>
            {favorites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
                暂无收藏。去首页或搜索页收藏感兴趣的文章。
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {favorites.slice(0, 6).map((f) => (
                  <li key={f.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                    <Link href={`/posts/${f.post.slug}`} className="font-medium underline">
                      {f.post.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(f.post.publishedAt || f.post.createdAt || new Date().toISOString())}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card border border-zinc-200">
            <h3 className="mb-3 text-base font-semibold">快捷操作</h3>
            <div className="grid gap-2 text-sm">
              <Link className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-100" href="/write/new">
                新建文章
              </Link>
              {recentPosts[0] && (
                <Link className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-100" href={`/write?id=${recentPosts[0].id}`}>
                  继续编辑最近文章
                </Link>
              )}
              <Link className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-100" href="/search">
                全站搜索
              </Link>
            </div>
          </div>

          <div className="card border border-zinc-200">
            <h3 className="mb-2 text-base font-semibold">活动摘要</h3>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>本周发布：{publishedIn7Days} 篇</li>
              <li>待处理草稿：{draftCount} 篇</li>
              <li>收藏条目：{favorites.length} 条</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
