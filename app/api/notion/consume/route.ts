import { NextResponse } from 'next/server';

import { consumePendingNotionEvents } from '@/lib/notion-sync';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { limit?: number; token?: string };
  const token = req.headers.get('x-sync-token') || body.token;
  const expected = process.env.NOTION_SYNC_TOKEN;

  if (expected && token !== expected) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const limit = Math.min(100, Math.max(1, Number(body.limit || 20)));
  const result = await consumePendingNotionEvents(limit);
  return NextResponse.json({ ok: true, ...result });
}
