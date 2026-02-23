'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type NavTag = { id: string; name: string; slug: string };
type SessionData = { id: string; role: string } | null;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavbarClient({
  siteTitle,
  tags,
  session
}: {
  siteTitle: string;
  tags: NavTag[];
  session: SessionData;
}) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      setCompact(y > 20);
      if (y < 16) {
        setHidden(false);
      } else if (delta > 8 && y > 120) {
        setHidden(true);
      } else if (delta < -8) {
        setHidden(false);
      }
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLink = (href: string) =>
    `rounded-md px-2.5 py-1.5 transition-all duration-300 hover:bg-white/80 hover:text-zinc-900 active:scale-[0.98] ${
      isActive(pathname, href) ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-700'
    }`;

  return (
    <header className="sticky top-0 z-40 px-3 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
      <div
        className={`mx-auto flex w-full max-w-[1400px] items-center justify-between rounded-2xl border border-[var(--line-soft)] bg-[rgba(247,246,242,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-all duration-300 backdrop-blur-xl ${
          hidden ? '-translate-y-24 opacity-0' : 'translate-y-0 opacity-100'
        } ${compact ? 'px-3 py-2 shadow-md shadow-zinc-900/5 sm:px-4' : 'px-4 py-3 sm:px-5'}`}
      >
        <Link href="/" className="flex items-center gap-2 text-base font-semibold text-zinc-800 sm:text-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-200 text-sm">木</span>
          <span className="text-[28px] font-semibold leading-none tracking-tight">{siteTitle}</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link href="/search" className={navLink('/search')}>
            搜索
          </Link>
          <Link href="/" className={navLink('/')}>
            首页
          </Link>
          <details className="group relative">
            <summary className={navLink('/articles') + ' list-none cursor-pointer'}>文章</summary>
            <div className="absolute right-0 top-10 min-w-48 rounded-xl border border-[var(--line-soft)] bg-[#f8f7f3]/95 p-2 shadow-lg backdrop-blur">
              <Link href="/" className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100">
                全部文章
              </Link>
              {tags.map((t) => (
                <Link key={t.id} href={`/?tag=${encodeURIComponent(t.slug)}`} className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100">
                  #{t.name}
                </Link>
              ))}
            </div>
          </details>

          {session ? (
            <>
              <Link href="/dashboard" className={navLink('/dashboard')}>
                控制台
              </Link>
              <Link href="/write/new" className={navLink('/write')}>
                写文章
              </Link>
              <details className="group relative">
                <summary className={navLink('/account') + ' list-none cursor-pointer'}>我的</summary>
                <div className="absolute right-0 top-10 min-w-40 rounded-xl border border-[var(--line-soft)] bg-[#f8f7f3]/95 p-2 shadow-lg backdrop-blur">
                  <Link href={`/profile/${session.id}`} className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100">
                    个人资料
                  </Link>
                  <Link href="/account" className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100">
                    账户设置
                  </Link>
                  {session.role === 'ADMIN' && (
                    <Link href="/admin" className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100">
                      后台管理
                    </Link>
                  )}
                  <form action="/api/auth/signout" method="post" className="mt-1">
                    <button className="w-full rounded px-2.5 py-1.5 text-left text-zinc-700 hover:bg-zinc-100" type="submit">
                      退出登录
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link href="/login" className={navLink('/login')}>
              登录
            </Link>
          )}
        </nav>

        <details className="group relative md:hidden">
            <summary className="list-none rounded-md border border-[var(--line-soft)] bg-[#f8f7f3] px-3 py-2 text-sm text-zinc-700 transition-all active:scale-[0.98]">菜单</summary>
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
            {session ? (
              <>
                <Link href="/dashboard" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  控制台
                </Link>
                <Link href="/write/new" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  写文章
                </Link>
                <Link href={`/profile/${session.id}`} className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  个人资料
                </Link>
                <Link href="/account" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  账户管理
                </Link>
                {session.role === 'ADMIN' && (
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
