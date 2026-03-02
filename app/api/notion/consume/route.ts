import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { env } from '@/lib/env';
import { consumePendingNotionEvents } from '@/lib/notion-sync';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { limit?: number; token?: string };
  const token = req.headers.get('x-sync-token') || body.token;
  const expected = env.NOTION_SYNC_TOKEN;

  if (expected) {
    if (token !== expected) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
  }

  const limit = Math.min(100, Math.max(1, Number(body.limit || 20)));
  const result = await consumePendingNotionEvents(limit);
  return NextResponse.json({ ok: true, ...result });
}
