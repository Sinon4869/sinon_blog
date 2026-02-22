'use client';

import { useState } from 'react';

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: 'USER' | 'ADMIN';
  disabled: number;
  createdAt: string;
};

export function AdminUserTable({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState('');

  async function updateUser(id: string, payload: { role?: 'USER' | 'ADMIN'; disabled?: boolean }) {
    setError('');
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || '操作失败');
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
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
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.name || '-'}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.disabled ? '已禁用' : '正常'}</td>
                <td className="space-x-2 px-3 py-2">
                  <button className="rounded border px-2 py-1" onClick={() => updateUser(u.id, { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' })}>
                    切换角色
                  </button>
                  <button className="rounded border px-2 py-1" onClick={() => updateUser(u.id, { disabled: !u.disabled })}>
                    {u.disabled ? '启用' : '禁用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
