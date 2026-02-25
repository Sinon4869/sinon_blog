import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/api-auth';
import { listSyncConflicts, resolveSyncConflict } from '@/lib/notion-sync';

export async function GET(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')));
  const items = await listSyncConflicts(limit);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const body = (await req.json().catch(() => ({}))) as { postId?: string; keep?: 'blog' | 'notion' };
  if (!body.postId || (body.keep !== 'blog' && body.keep !== 'notion')) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const result = await resolveSyncConflict(body.postId, body.keep);
  return NextResponse.json(result);
}
