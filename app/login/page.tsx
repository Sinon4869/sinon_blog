'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">欢迎回来</h1>
          <p className="text-sm text-zinc-500">登录后继续写作与管理你的内容</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setLoading(true);
            const formData = new FormData(e.currentTarget);
            const res = await signIn('credentials', {
              email: formData.get('email'),
              password: formData.get('password'),
              redirect: false
            });
            setLoading(false);
            if (res?.error) setError('账号或密码错误');
            else router.push('/dashboard');
          }}
        >
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">邮箱</label>
            <input className="input" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">密码</label>
            <input className="input" name="password" type="password" placeholder="请输入密码" required />
          </div>

          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
            onClick={() => signIn('google')}
            type="button"
          >
            使用 Google 登录
          </button>
          <button
            className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
            onClick={() => signIn('github')}
            type="button"
          >
            使用 GitHub 登录
          </button>
        </div>

        <p className="text-center text-sm text-zinc-500">
          还没有账号？
          <Link href="/register" className="ml-1 text-zinc-900 underline">
            去注册
          </Link>
        </p>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
