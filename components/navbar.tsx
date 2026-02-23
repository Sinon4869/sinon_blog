/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

export async function Navbar() {
  let session: any = null;
  let tags: Array<{ id: string; name: string; slug: string }> = [];
  let siteTitle = 'Komorebi';
  try {
    const [rawSession, rawTags, titleSetting, categoriesSetting] = await Promise.all([
      getServerSession(authOptions),
      prisma.tag.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
        take: 8
      }),
      prisma.setting.get('site_title'),
      prisma.setting.get('nav_categories')
    ]);
    session = rawSession;
    const dbTags = (rawTags as Array<Record<string, unknown>>).map((t) => ({
      id: String(t.id || ''),
      name: String(t.name || ''),
      slug: String(t.slug || '')
    }));
    const configuredNames = String(categoriesSetting?.value || '')
      .split(/[\n,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    tags =
      configuredNames.length > 0
        ? configuredNames.map((name, i) => ({ id: `cfg-${i}`, name, slug: slugify(name) || name }))
        : dbTags;
    siteTitle = String(titleSetting?.value || '').trim() || 'Komorebi';
  } catch {
    session = null;
    tags = [];
    siteTitle = 'Komorebi';
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line-soft)] bg-[rgba(247,246,242,0.88)] pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-[rgba(247,246,242,0.72)]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold text-zinc-800 sm:text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-200 text-xs">木</span>
          <span>{siteTitle}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 text-sm text-zinc-700 md:flex">
          <Link href="/search" className="hover:text-zinc-900">
            搜索
          </Link>
          <Link href="/" className="hover:text-zinc-900">
            首页
          </Link>
          <details className="group relative">
            <summary className="list-none cursor-pointer hover:text-zinc-900">文章</summary>
            <div className="absolute right-0 top-7 min-w-44 rounded-lg border border-[var(--line-soft)] bg-[#f8f7f3] p-2 shadow-lg">
              <Link href="/" className="block rounded px-2 py-1.5 hover:bg-zinc-100">
                全部文章
              </Link>
              {tags.map((t) => (
                <Link key={t.id} href={`/?tag=${encodeURIComponent(t.slug)}`} className="block rounded px-2 py-1.5 hover:bg-zinc-100">
                  #{t.name}
                </Link>
              ))}
            </div>
          </details>

          {session?.user ? (
            <>
              <Link href="/dashboard" className="hover:text-zinc-900">
                控制台
              </Link>
              <Link href="/write/new" className="hover:text-zinc-900">
                写文章
              </Link>
              <details className="group relative">
                <summary className="list-none cursor-pointer hover:text-zinc-900">我的</summary>
                <div className="absolute right-0 top-7 min-w-36 rounded-lg border border-[var(--line-soft)] bg-[#f8f7f3] p-2 shadow-lg">
                  <Link href={`/profile/${session.user.id}`} className="block rounded px-2 py-1.5 hover:bg-zinc-100">
                    个人资料
                  </Link>
                  <Link href="/account" className="block rounded px-2 py-1.5 hover:bg-zinc-100">
                    账户设置
                  </Link>
                  {session.user.role === 'ADMIN' && (
                    <Link href="/admin" className="block rounded px-2 py-1.5 hover:bg-zinc-100">
                      后台管理
                    </Link>
                  )}
                  <form action="/api/auth/signout" method="post" className="mt-1">
                    <button className="w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100" type="submit">
                      退出登录
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link href="/login" className="rounded-md border border-[var(--line-strong)] px-3 py-1.5 hover:bg-zinc-100">
              登录
            </Link>
          )}
        </nav>

        {/* Mobile menu */}
        <details className="group relative md:hidden">
          <summary className="list-none rounded-md border border-[var(--line-soft)] bg-[#f8f7f3] px-3 py-2 text-sm text-zinc-700">
            菜单
          </summary>
          <nav className="absolute right-0 z-20 mt-2 min-w-44 rounded-lg border border-[var(--line-soft)] bg-[#f8f7f3] p-2 shadow-lg">
            <Link href="/search" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
              搜索
            </Link>
            <Link href="/" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
              首页
            </Link>
            <p className="px-3 pt-2 text-xs text-zinc-500">分类</p>
            {tags.map((t) => (
              <Link key={t.id} href={`/?tag=${encodeURIComponent(t.slug)}`} className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                #{t.name}
              </Link>
            ))}

            <div className="my-1 h-px bg-zinc-200" />
            {session?.user ? (
              <>
                <Link href="/dashboard" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  控制台
                </Link>
                <Link href="/write/new" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  写文章
                </Link>
                <Link href={`/profile/${session.user.id}`} className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  个人资料
                </Link>
                <Link href="/account" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  账户管理
                </Link>
                {session.user.role === 'ADMIN' && (
                  <Link href="/admin" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                    后台管理
                  </Link>
                )}
                <form action="/api/auth/signout" method="post" className="px-1 pb-1 pt-2">
                  <button className="btn w-full" type="submit">
                    退出
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                登录
              </Link>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
