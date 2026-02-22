import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { AdminUserTable } from '@/components/admin-user-table';
import { prisma } from '@/lib/prisma';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [users, posts, comments, userList] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

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
    </div>
  );
}
