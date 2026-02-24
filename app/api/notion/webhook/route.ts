import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

function cuidLike() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
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
