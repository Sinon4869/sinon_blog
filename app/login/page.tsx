'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [oauthError, setOauthError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (!code) return;
    if (code.includes('OAuthAccountNotLinked'))
      return setOauthError('该邮箱已存在密码账号，请先用密码登录后再绑定 Google。');
    if (code.includes('AccessDenied')) return setOauthError('Google 登录被拒绝，请确认该 Google 账号邮箱已验证。');
    if (code.includes('EmailNotVerified')) return setOauthError('Google 邮箱未验证，请先在 Google 完成邮箱验证。');
    if (code.includes('D1_ERROR')) return setOauthError('服务器数据库暂时异常，请稍后重试。');
    setOauthError(`登录失败（${code}）`);
  }, []);

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

        <div className="grid gap-2">
          <button
            className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            type="button"
          >
            使用 Google 登录
          </button>
        </div>

        <p className="text-center text-sm text-zinc-500">
          还没有账号？
          <Link href="/register" className="ml-1 text-zinc-900 underline">
            去注册
          </Link>
        </p>

        {(error || oauthError) && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error || oauthError}</p>
        )}
      </div>
    </div>
  );
}
