'use client';

import { useState } from 'react';
import { SUPER_ADMIN_EMAIL } from '@/lib/constants';

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: 'USER' | 'ADMIN';
  disabled: number;
  createdAt: string;
  last_login_at?: string | null;
};

export function AdminUserTable({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState('');
  const [loadingId, setLoadingId] = useState('');

  async function updateUser(id: string, payload: { role?: 'USER' | 'ADMIN'; disabled?: boolean }) {
    setError('');
    setLoadingId(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setLoadingId('');
    if (!res.ok) {
      setError(data.error || '操作失败');
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
  }

  async function deleteUser(id: string) {
    setError('');
    setLoadingId(id);
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    setLoadingId('');
    if (!res.ok) {
      setError(data.error || '删除失败');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left">邮箱</th>
              <th className="px-3 py-2 text-left">昵称</th>
              <th className="px-3 py-2 text-left">角色</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">最近登录</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSuperAdmin = u.email.toLowerCase() === SUPER_ADMIN_EMAIL;
              return (
                <tr key={u.id} className="border-t">
                <td className="px-3 py-2">
                  {u.email}
                  {isSuperAdmin && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">超级管理员</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.name || '-'}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.disabled ? '已禁用' : '正常'}</td>
                <td className="px-3 py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('zh-CN') : '-'}</td>
                <td className="space-x-2 px-3 py-2">
                  <button
                    className="rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loadingId === u.id || isSuperAdmin}
                    onClick={() => updateUser(u.id, { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                  >
                    切换角色
                  </button>
                  <button
                    className="rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loadingId === u.id || isSuperAdmin}
                    onClick={() => updateUser(u.id, { disabled: !u.disabled })}
                  >
                    {u.disabled ? '启用' : '禁用'}
                  </button>
                  <button
                    className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loadingId === u.id || isSuperAdmin}
                    onClick={() => {
                      if (!confirm(`确认删除用户 ${u.email}？此操作不可恢复。`)) return;
                      void deleteUser(u.id);
                    }}
                  >
                    删除
                  </button>
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
