import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [users, posts, comments] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count()
  ]);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">后台管理（基础）</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card">用户总数：{users}</div>
        <div className="card">文章总数：{posts}</div>
        <div className="card">评论总数：{comments}</div>
      </div>
    </div>
  );
}
