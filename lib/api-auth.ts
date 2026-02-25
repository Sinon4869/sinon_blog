import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';

export async function requireUserApi() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!session || !user) {
    return {
      ok: false as const,
      session: null,
      user: null,
      response: NextResponse.json({ error: '未登录' }, { status: 401 })
    };
  }

  return { ok: true as const, session, user, response: null };
}

export async function requireAdminApi() {
  const auth = await requireUserApi();
  if (!auth.ok) return auth;

  if (auth.user.role !== 'ADMIN') {
    return {
      ok: false as const,
      session: null,
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    };
  }

  return { ok: true as const, session: auth.session, user: auth.user, response: null };
}
