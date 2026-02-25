import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { ANONYMOUS_USER_EMAIL, SUPER_ADMIN_EMAIL } from '@/lib/site-settings';

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

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
