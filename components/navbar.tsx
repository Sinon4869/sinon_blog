import Link from 'next/link';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

export async function Navbar() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-bold sm:text-lg">
          Modern Blog
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link href="/">首页</Link>
          <Link href="/write">写文章</Link>
          <Link href="/dashboard">控制台</Link>
          {session?.user?.role === 'ADMIN' && <Link href="/admin">后台</Link>}
          {session?.user ? (
            <>
              <Link href={`/profile/${session.user.id}`}>个人资料</Link>
              <Link href="/account">账户</Link>
              <form action="/api/auth/signout" method="post">
                <button className="btn" type="submit">
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">登录</Link>
              <Link href="/register" className="btn">
                注册
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu */}
        <details className="group relative md:hidden">
          <summary className="list-none rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            菜单
          </summary>
          <nav className="absolute right-0 z-20 mt-2 min-w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
            <Link href="/" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
              首页
            </Link>
            <Link href="/write" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
              写文章
            </Link>
            <Link href="/dashboard" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
              控制台
            </Link>
            {session?.user?.role === 'ADMIN' && (
              <Link href="/admin" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                后台
              </Link>
            )}
            <div className="my-1 h-px bg-zinc-200" />
            {session?.user ? (
              <>
                <Link href={`/profile/${session.user.id}`} className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  个人资料
                </Link>
                <Link href="/account" className="block rounded px-3 py-2 text-sm hover:bg-zinc-100">
                  账户管理
                </Link>
                <form action="/api/auth/signout" method="post" className="px-1 pb-1 pt-2">
                  <button className="btn w-full" type="submit">
                    退出
                  </button>
                </form>
              </>
            ) : (
              <div className="space-y-2 px-1 pb-1 pt-2">
                <Link href="/login" className="block rounded px-2 py-2 text-sm hover:bg-zinc-100">
                  登录
                </Link>
                <Link href="/register" className="btn block w-full text-center">
                  注册
                </Link>
              </div>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
