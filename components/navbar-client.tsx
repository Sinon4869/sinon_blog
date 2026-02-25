'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type NavTag = { id: string; name: string; slug: string };
type SessionData = { id: string; role: string } | null;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavbarClient({
  siteTitle,
  siteIcon,
  siteIconUrl,
  tags,
  session
}: {
  siteTitle: string;
  siteIcon: string;
  siteIconUrl: string;
  tags: NavTag[];
  session: SessionData;
}) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [compact, setCompact] = useState(false);
  const [openMenu, setOpenMenu] = useState<'articles' | 'account' | null>(null);
  const articlesRef = useRef<HTMLDetailsElement | null>(null);
  const accountRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    let lastY = window.scrollY;
    let downDistance = 0;
    let upDistance = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      setCompact(y > 20);

      if (y < 16) {
        setHidden(false);
        downDistance = 0;
        upDistance = 0;
        lastY = y;
        return;
      }

      if (delta > 0) {
        downDistance += delta;
        upDistance = 0;
        if (y > 140 && downDistance > 48) {
          setHidden(true);
          downDistance = 0;
        }
      } else if (delta < 0) {
        upDistance += -delta;
        downDistance = 0;
        // 避免“轻微上划就出现”打断阅读，需要明显回拉才显示
        if (upDistance > 140 || y < 72) {
          setHidden(false);
          upDistance = 0;
        }
      }

      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inArticles = articlesRef.current?.contains(target);
      const inAccount = accountRef.current?.contains(target);
      if (!inArticles && !inAccount) setOpenMenu(null);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  const navLink = (href: string) =>
    `rounded-lg px-2.5 py-1.5 transition-all duration-300 hover:bg-white/85 hover:text-zinc-900 active:scale-[0.98] ${
      isActive(pathname, href) ? 'bg-white text-zinc-900 shadow-sm shadow-zinc-900/10' : 'text-zinc-700'
    }`;

  return (
    <header className="sticky top-0 z-40 px-3 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
      <div
        className={`mx-auto flex w-full max-w-[1400px] items-center justify-between rounded-2xl border border-[var(--line-soft)] bg-[rgba(248,247,243,0.78)] shadow-[0_10px_26px_rgba(28,29,31,0.08),inset_0_1px_0_rgba(255,255,255,0.52)] transition-all duration-300 backdrop-blur-2xl ${
          hidden ? '-translate-y-24 opacity-0' : 'translate-y-0 opacity-100'
        } ${compact ? 'px-3 py-2 shadow-lg shadow-zinc-900/10 sm:px-4' : 'px-4 py-3 sm:px-5'}`}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2 text-base font-semibold text-zinc-800 sm:text-lg">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/50 bg-gradient-to-br from-zinc-200 to-zinc-300 text-sm shadow-inner">
            {siteIconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteIconUrl} alt="site icon" className="h-full w-full object-cover" />
            ) : (
              siteIcon
            )}
          </span>
          <span className="max-w-[46vw] truncate text-[24px] font-semibold leading-none tracking-tight sm:max-w-none sm:text-[28px]">{siteTitle}</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link href="/search" className={navLink('/search')}>
            搜索
          </Link>
          <Link href="/" className={navLink('/')}>
            首页
          </Link>
          <details ref={articlesRef} open={openMenu === 'articles'} className="group relative">
            <summary
              className={navLink('/articles') + ' list-none cursor-pointer'}
              onClick={(e) => {
                e.preventDefault();
                setOpenMenu((prev) => (prev === 'articles' ? null : 'articles'));
              }}
            >
              文章
            </summary>
            <div className="absolute right-0 top-10 min-w-48 rounded-xl border border-[var(--line-soft)] bg-[#f8f7f3]/95 p-2 shadow-lg backdrop-blur">
              <Link href="/" className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100" onClick={() => setOpenMenu(null)}>
                全部文章
              </Link>
              <Link href={'/archives' as Route} className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100" onClick={() => setOpenMenu(null)}>
                归档
              </Link>
              {tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/category/${encodeURIComponent(t.slug)}` as Route}
                  className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100"
                  onClick={() => setOpenMenu(null)}
                >
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
              <details ref={accountRef} open={openMenu === 'account'} className="group relative">
                <summary
                  className={navLink('/account') + ' list-none cursor-pointer'}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu((prev) => (prev === 'account' ? null : 'account'));
                  }}
                >
                  我的
                </summary>
                <div className="absolute right-0 top-10 min-w-40 rounded-xl border border-[var(--line-soft)] bg-[#f8f7f3]/95 p-2 shadow-lg backdrop-blur">
                  <Link href={`/profile/${session.id}`} className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100" onClick={() => setOpenMenu(null)}>
                    个人资料
                  </Link>
                  <Link href="/account" className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100" onClick={() => setOpenMenu(null)}>
                    账户设置
                  </Link>
                  {session.role === 'ADMIN' && (
                    <Link href="/admin" className="block rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100" onClick={() => setOpenMenu(null)}>
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

        <details className="group relative shrink-0 md:hidden">
          <summary className="list-none rounded-lg border border-[var(--line-soft)] bg-[rgba(248,247,243,0.9)] px-3 py-2 text-sm text-zinc-700 shadow-sm transition-all active:scale-[0.98]">菜单</summary>
          <nav className="absolute right-0 z-20 mt-2 min-w-48 rounded-2xl border border-[var(--line-soft)] bg-[rgba(248,247,243,0.95)] p-2 shadow-xl backdrop-blur">
            <Link href="/search" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
              搜索
            </Link>
            <Link href="/" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
              首页
            </Link>
            <Link href={'/archives' as Route} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
              归档
            </Link>
            <p className="px-3 pt-2 text-[11px] tracking-[0.18em] text-zinc-500">分类</p>
            {tags.map((t) => (
              <Link key={t.id} href={`/category/${encodeURIComponent(t.slug)}` as Route} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
                #{t.name}
              </Link>
            ))}

            <div className="my-1 h-px bg-zinc-200" />
            {session ? (
              <>
                <Link href="/dashboard" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
                  控制台
                </Link>
                <Link href="/write/new" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
                  写文章
                </Link>
                <Link href={`/profile/${session.id}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
                  个人资料
                </Link>
                <Link href="/account" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
                  账户管理
                </Link>
                {session.role === 'ADMIN' && (
                  <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
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
              <Link href="/login" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/80">
                登录
              </Link>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
