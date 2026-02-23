import Link from 'next/link';
import type { Route } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { deletePost, setPostPublished } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 10;

type DashboardSearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

type PostItem = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  published: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  publishedAt?: string | Date | null;
};

function clampPage(value: string | undefined) {
  return Math.max(1, Number(value || '1') || 1);
}

function buildHref(q: string, status: string, page: number) {
  const sp = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status && status !== 'all' ? { status } : {}),
    page: String(page)
  });
  return `/dashboard?${sp.toString()}` as Route;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const status = (sp.status || 'all').trim();
  const page = clampPage(sp.page);

  const where = {
    authorId: session.user.id,
    ...(status === 'published' ? { published: true } : {}),
    ...(status === 'draft' ? { published: false } : {}),
    ...(q
      ? {
          OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { excerpt: { contains: q, mode: 'insensitive' as const } }]
        }
      : {})
  };

  const [allMineRaw, allMatchedRaw, pagePostsRaw, favorites] = await Promise.all([
    prisma.post.findMany({ where: { authorId: session.user.id }, orderBy: { updatedAt: 'desc' } }),
    prisma.post.findMany({ where, orderBy: { updatedAt: 'desc' } }),
    prisma.post.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.favorite.findMany({ where: { userId: session.user.id } })
  ]);

  const allMine = (allMineRaw as PostItem[]) || [];
  const allMatched = (allMatchedRaw as PostItem[]) || [];
  const pagePosts = (pagePostsRaw as PostItem[]) || [];

  const publishedCount = allMine.filter((p) => p.published).length;
  const draftCount = allMine.length - publishedCount;
  const totalPages = Math.max(1, Math.ceil(allMatched.length / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--line-soft)] bg-white/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">DASHBOARD</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-800 sm:text-3xl">文章管理控制台</h1>
          </div>
          <Link href="/write/new" className="btn">
            新建文章
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-zinc-500">文章总数</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-800">{allMine.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-zinc-500">已发布</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-800">{publishedCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-zinc-500">草稿 / 收藏</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-800">
            {draftCount} / {favorites.length}
          </p>
        </div>
      </section>

      <form action="/dashboard" className="card grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input className="input" name="q" defaultValue={q} placeholder="搜索标题或摘要..." />
        <select className="input" name="status" defaultValue={status}>
          <option value="all">全部</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
        <button className="btn" type="submit">
          筛选
        </button>
        {(q || status !== 'all') && (
          <Link className="rounded-md border border-[var(--line-strong)] px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/dashboard">
            重置
          </Link>
        )}
      </form>

      <section className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white/60">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line-soft)] bg-white/40 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left">标题</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">更新时间</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagePosts.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={4}>
                    暂无匹配文章
                  </td>
                </tr>
              )}
              {pagePosts.map((post) => (
                <tr key={post.id} className="border-b border-[var(--line-soft)] last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-800">{post.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{post.excerpt || '暂无摘要'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${post.published ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-700'}`}>
                      {post.published ? '已发布' : '草稿'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{formatDate(post.updatedAt || post.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/posts/${post.slug}`} className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs hover:bg-zinc-100">
                        查看
                      </Link>
                      <Link href={`/write?id=${post.id}`} className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs hover:bg-zinc-100">
                        编辑
                      </Link>
                      <form action={setPostPublished}>
                        <input type="hidden" name="id" value={post.id} />
                        <input type="hidden" name="nextPublished" value={post.published ? '0' : '1'} />
                        <button type="submit" className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs hover:bg-zinc-100">
                          {post.published ? '转草稿' : '发布'}
                        </button>
                      </form>
                      <form action={deletePost}>
                        <input type="hidden" name="id" value={post.id} />
                        <button type="submit" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                          删除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            className={`rounded-md border border-[var(--line-strong)] px-3 py-1.5 text-sm ${page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-zinc-100'}`}
            href={buildHref(q, status, page - 1)}
          >
            上一页
          </Link>
          <span className="text-sm text-zinc-600">
            第 {page} / {totalPages} 页
          </span>
          <Link
            className={`rounded-md border border-[var(--line-strong)] px-3 py-1.5 text-sm ${page >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-zinc-100'}`}
            href={buildHref(q, status, page + 1)}
          >
            下一页
          </Link>
        </div>
      )}
    </div>
  );
}
