import Link from 'next/link';
import type { Route } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { deletePost, saveSiteConfig, setPostPublished } from '@/app/actions';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { NavCategoriesEditor } from '@/components/nav-categories-editor';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPostPath, formatDate } from '@/lib/utils';

const PAGE_SIZE = 10;

type DashboardSearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

type PostItem = {
  id: string;
  title: string;
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

function parseConfiguredCategories(value: string) {
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 20);
    }
  } catch {
    // fallback for legacy values
  }
  return raw
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  const isAdmin = session.user.role === 'ADMIN';

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

  const [allMineRaw, allMatchedRaw, pagePostsRaw, favorites, siteTitleSetting, navCategoriesSetting, analyticsSummary] = await Promise.all([
    prisma.post.findMany({ where: { authorId: session.user.id }, orderBy: { updatedAt: 'desc' } }),
    prisma.post.findMany({ where, orderBy: { updatedAt: 'desc' } }),
    prisma.post.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.favorite.findMany({ where: { userId: session.user.id } }),
    isAdmin ? prisma.setting.get('site_title') : Promise.resolve(null),
    isAdmin ? prisma.setting.get('nav_categories') : Promise.resolve(null),
    prisma.analytics.summary().catch(() => ({ today: { pv: 0, uv: 0 }, sevenDays: { pv: 0, uv: 0 }, topPages: [], sources: [], devices: [], categories: [] }))
  ]);

  const allMine = (allMineRaw as PostItem[]) || [];
  const allMatched = (allMatchedRaw as PostItem[]) || [];
  const pagePosts = (pagePostsRaw as PostItem[]) || [];

  const publishedCount = allMine.filter((p) => p.published).length;
  const draftCount = allMine.length - publishedCount;
  const totalPages = Math.max(1, Math.ceil(allMatched.length / PAGE_SIZE));
  const siteTitle = String((siteTitleSetting as { value?: string } | null)?.value || 'Komorebi');
  const navCategories = String((navCategoriesSetting as { value?: string } | null)?.value || '');
  const navCategoryList = parseConfiguredCategories(navCategories);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--line-soft)] bg-white/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">DASHBOARD</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-800 sm:text-3xl">文章管理控制台</h1>
          </div>
          <form action="/write/new" method="get">
            <ConfirmSubmitButton confirmText="确认新建文章？将进入写作页面。" className="btn">
              新建文章
            </ConfirmSubmitButton>
          </form>
        </div>
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-800">最近编辑</h2>
          <Link href="/write/new" className="text-xs text-zinc-500 hover:underline">
            新建文章
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {allMine.slice(0, 3).map((p) => (
            <Link key={p.id} href={`/write?id=${p.id}`} className="rounded-lg border border-[var(--line-soft)] bg-white p-3 hover:bg-zinc-50">
              <p className="line-clamp-1 text-sm font-medium text-zinc-800">{p.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{formatDate(p.updatedAt || p.createdAt)}</p>
            </Link>
          ))}
          {allMine.length === 0 && <p className="text-sm text-zinc-500">暂无文章</p>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="card space-y-1">
          <p className="text-xs text-zinc-500">访客统计（二期）</p>
          <p className="text-sm font-medium text-zinc-700">今日 PV/UV：{analyticsSummary.today.pv} / {analyticsSummary.today.uv}</p>
          <p className="text-sm font-medium text-zinc-700">近7天 PV/UV：{analyticsSummary.sevenDays.pv} / {analyticsSummary.sevenDays.uv}</p>
          <p className="pt-1 text-xs text-zinc-500">Top 页面：{(analyticsSummary.topPages || []).slice(0, 3).map((x: { path: string; pv: number }) => `${x.path}(${x.pv})`).join('、') || '-'}</p>
          <p className="text-xs text-zinc-500">来源：{(analyticsSummary.sources || []).map((x: { source: string; pv: number }) => `${x.source}:${x.pv}`).join(' / ') || '-'}</p>
          <p className="text-xs text-zinc-500">设备：{(analyticsSummary.devices || []).map((x: { device: string; pv: number }) => `${x.device}:${x.pv}`).join(' / ') || '-'}</p>
          <p className="text-xs text-zinc-500">分类：{(analyticsSummary.categories || []).slice(0, 3).map((x: { name: string; pv: number }) => `${x.name}:${x.pv}`).join(' / ') || '-'}</p>
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

      {isAdmin && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold text-zinc-800">站点配置</h2>
          <form action={saveSiteConfig} className="grid gap-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">站点标题</label>
              <input className="input" name="siteTitle" defaultValue={siteTitle} placeholder="例如：Komorebi" />
            </div>
            <NavCategoriesEditor initialCategories={navCategoryList} />
            <div>
              <ConfirmSubmitButton confirmText="确认保存站点配置？修改后导航将即时更新。" className="btn">
                保存配置
              </ConfirmSubmitButton>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white/60">
        <div className="space-y-3 p-3 md:hidden">
          {pagePosts.length === 0 && <div className="rounded-xl border border-[var(--line-soft)] bg-white p-4 text-sm text-zinc-500">暂无匹配文章</div>}
          {pagePosts.map((post) => (
            <article key={post.id} className="rounded-xl border border-[var(--line-soft)] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-800">{post.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{post.excerpt || '暂无摘要'}</p>
                </div>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs ${post.published ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-700'}`}>
                  {post.published ? '已发布' : '草稿'}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">更新于：{formatDate(post.updatedAt || post.createdAt)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={buildPostPath(post) as Route} className="rounded border border-[var(--line-strong)] px-2 py-2 text-center text-xs hover:bg-zinc-100">
                  查看
                </Link>
                <Link href={`/write?id=${post.id}`} className="rounded border border-[var(--line-strong)] px-2 py-2 text-center text-xs hover:bg-zinc-100">
                  编辑
                </Link>
                <form action={setPostPublished}>
                  <input type="hidden" name="id" value={post.id} />
                  <input type="hidden" name="nextPublished" value={post.published ? '0' : '1'} />
                  <ConfirmSubmitButton
                    confirmText={post.published ? '确认将该文章转为草稿？' : '确认发布该文章？'}
                    className="w-full rounded border border-[var(--line-strong)] px-2 py-2 text-xs hover:bg-zinc-100"
                  >
                    {post.published ? '转草稿' : '发布'}
                  </ConfirmSubmitButton>
                </form>
                <form action={deletePost}>
                  <input type="hidden" name="id" value={post.id} />
                  <ConfirmSubmitButton confirmText="确认删除该文章？此操作不可恢复。" className="w-full rounded border border-red-300 px-2 py-2 text-xs text-red-700 hover:bg-red-50">
                    删除
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
                <tr key={post.id} className="border-b border-[var(--line-soft)] transition-colors hover:bg-white/50 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-800">{post.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{post.excerpt || '暂无摘要'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${post.published ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-700'}`}>
                      {post.published ? '已发布' : '草稿'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{formatDate(post.updatedAt || post.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={buildPostPath(post) as Route} className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs hover:bg-zinc-100">
                        查看
                      </Link>
                      <Link href={`/write?id=${post.id}`} className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs hover:bg-zinc-100">
                        编辑
                      </Link>
                      <form action={setPostPublished}>
                        <input type="hidden" name="id" value={post.id} />
                        <input type="hidden" name="nextPublished" value={post.published ? '0' : '1'} />
                        <ConfirmSubmitButton
                          confirmText={post.published ? '确认将该文章转为草稿？' : '确认发布该文章？'}
                          className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs hover:bg-zinc-100"
                        >
                          {post.published ? '转草稿' : '发布'}
                        </ConfirmSubmitButton>
                      </form>
                      <form action={deletePost}>
                        <input type="hidden" name="id" value={post.id} />
                        <ConfirmSubmitButton confirmText="确认删除该文章？此操作不可恢复。" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                          删除
                        </ConfirmSubmitButton>
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
