import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_WEBHOOK_BYTES = 256 * 1024;

function cuidLike() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  const token = req.headers.get('x-sync-token') || req.headers.get('x-webhook-token') || '';
  const expected = process.env.NOTION_WEBHOOK_TOKEN || process.env.NOTION_SYNC_TOKEN || '';
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

  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ ok: false, error: 'payload_too_large' }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });

  await prisma.transaction(async (tx) => {
    await tx.run(
      `CREATE TABLE IF NOT EXISTS sync_events (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        post_id TEXT,
        notion_page_id TEXT,
        status TEXT NOT NULL,
        payload_json TEXT,
        error TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await tx.run(
      `INSERT INTO sync_events (id, direction, post_id, notion_page_id, status, payload_json, error, retry_count)
       VALUES (?, 'notion_to_blog', NULL, NULL, 'pending', ?, NULL, 0)`,
      cuidLike(),
      JSON.stringify(body)
    );
  });

  return NextResponse.json({ ok: true });
}
