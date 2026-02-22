import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { saveProfile } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.id !== params.id && session.user.role !== 'ADMIN') redirect('/');

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) redirect('/');

  return (
    <form action={saveProfile} className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">个人资料</h1>
      <input className="input" name="name" defaultValue={user.name || ''} placeholder="昵称" />
      <textarea className="input min-h-24" name="bio" defaultValue={user.bio || ''} placeholder="个人简介" />
      <button className="btn" type="submit">
        保存资料
      </button>
    </form>
  );
}
