import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { AdminUserTable } from '@/components/admin-user-table';
import { prisma } from '@/lib/prisma';

type AuditLogItem = {
  id: string;
  actor_user_id?: string | null;
  target_user_id?: string | null;
  action: string;
  created_at: string;
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [users, posts, comments, userList, logsRaw] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true, last_login_at: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.auditLog.findMany({ take: 20 })
  ]);

  const logs: AuditLogItem[] = (logsRaw || []).map((l: Record<string, unknown>) => ({
    id: String(l.id || ''),
    action: String(l.action || ''),
    created_at: String(l.created_at || ''),
    actor_user_id: l.actor_user_id ? String(l.actor_user_id) : null,
    target_user_id: l.target_user_id ? String(l.target_user_id) : null
  }));

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">后台管理</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card">用户总数：{users}</div>
        <div className="card">文章总数：{posts}</div>
        <div className="card">评论总数：{comments}</div>
      </div>
      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">用户管理</h2>
        <AdminUserTable initialUsers={userList} />
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">操作审计日志</h2>
        <ul className="space-y-1 text-sm text-zinc-700">
          {logs.length === 0 && <li>暂无日志</li>}
          {logs.map((l) => (
            <li key={l.id}>
              {l.created_at} · {l.action} · actor:{l.actor_user_id || '-'} · target:{l.target_user_id || '-'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
