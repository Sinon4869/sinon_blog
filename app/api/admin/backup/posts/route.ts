import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/api-auth';
import { backupPostsToR2, listBackupKeys, restorePostsFromR2 } from '@/lib/backup';

export async function GET(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') || '20');
  const result = await listBackupKeys(limit);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const body = (await req.json().catch(() => ({}))) as { action?: 'backup' | 'restore'; key?: string };
  const action = body.action || 'backup';

  if (action === 'restore') {
    if (!body.key) return NextResponse.json({ ok: false, error: 'missing_key' }, { status: 400 });
    const restored = await restorePostsFromR2(body.key);
    return NextResponse.json(restored, { status: restored.ok ? 200 : 500 });
  }

  const result = await backupPostsToR2();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
