import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

function normalizePath(path: string) {
  const v = String(path || '').trim();
  if (!v.startsWith('/')) return '/';
  if (v.length > 256) return v.slice(0, 256);
  return v;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function visitorId() {
  return `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const path = normalizePath(body?.path || '/');

  if (!(path === '/' || path === '/search' || path.startsWith('/posts/'))) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const jar = await cookies();
  let vid = jar.get('vid')?.value || '';
  if (!vid) vid = visitorId();

  await prisma.analytics.recordVisit({ path, visitorId: vid, viewedOn: dayKey() });

  const res = NextResponse.json({ ok: true });
  if (!jar.get('vid')?.value) {
    res.cookies.set('vid', vid, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365
    });
  }
  return res;
}
