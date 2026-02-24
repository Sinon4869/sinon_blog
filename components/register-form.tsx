'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RegisterForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card space-y-4">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold">注册已关闭</h1>
            <p className="text-sm text-zinc-500">管理员暂时关闭了新用户注册。</p>
          </div>
          <p className="text-center text-sm text-zinc-500">
            已有账号？
            <Link href="/login" className="ml-1 text-zinc-900 underline">
              去登录
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">创建账号</h1>
          <p className="text-sm text-zinc-500">几秒钟完成注册，开始你的博客创作</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setLoading(true);
            const formData = new FormData(e.currentTarget);
            const body = {
              name: formData.get('name'),
              email: formData.get('email'),
              password: formData.get('password')
            };
            const res = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            setLoading(false);
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              setError(data?.error || '注册失败，邮箱可能已存在');
              return;
            }
            router.push('/login');
          }}
        >
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">昵称</label>
            <input className="input" name="name" placeholder="你的昵称" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">邮箱</label>
            <input className="input" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-600">密码</label>
            <input className="input" name="password" type="password" placeholder="至少 6 位" required />
          </div>

          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? '注册中…' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          已有账号？
          <Link href="/login" className="ml-1 text-zinc-900 underline">
            去登录
          </Link>
        </p>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

