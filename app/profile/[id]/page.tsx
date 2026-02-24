import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { saveProfile } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.id !== id && session.user.role !== 'ADMIN') redirect('/');

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect('/');

  return (
    <form action={saveProfile} className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">个人资料</h1>
      <p className="text-sm text-zinc-600">邮箱：{user.email}</p>
      <input className="input" name="name" defaultValue={user.name || ''} placeholder="昵称" />
      <textarea className="input min-h-24" name="bio" defaultValue={user.bio || ''} placeholder="个人简介" />
      <input className="input" name="image" defaultValue={user.image || ''} placeholder="头像 URL（可选）" />
      <button className="btn" type="submit">
        保存资料
      </button>
    </form>
  );
}
