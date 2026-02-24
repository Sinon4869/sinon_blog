import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ANONYMOUS_USER_EMAIL, SUPER_ADMIN_EMAIL } from '@/lib/site-settings';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const usersRaw = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true, last_login_at: true },
    orderBy: { createdAt: 'desc' }
  });
  const users = usersRaw
    .filter((user) => String(user.email || '').toLowerCase() !== ANONYMOUS_USER_EMAIL)
    .map((user) => ({
      ...user,
      role: String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL ? 'ADMIN' : user.role
    }));

  return NextResponse.json({ users });
}
