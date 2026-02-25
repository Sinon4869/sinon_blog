import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(req.url);
  const action = (searchParams.get('action') || '').trim();
  const actor = (searchParams.get('actor') || '').trim();
  const take = Math.min(200, Math.max(1, Number(searchParams.get('take') || '50')));
  const exportCsv = searchParams.get('export') === 'csv';

  const rows = (await prisma.auditLog.findMany({ take })) as Array<Record<string, unknown>>;
  const filtered = rows.filter((r) => {
    if (action && !String(r.action || '').includes(action)) return false;
    if (actor && String(r.actor_user_id || '') !== actor) return false;
    return true;
  });

  if (exportCsv) {
    const head = 'id,created_at,action,actor_user_id,target_user_id,detail\n';
    const body = filtered
      .map((r) =>
        [r.id, r.created_at, r.action, r.actor_user_id || '', r.target_user_id || '', String(r.detail || '').replace(/\"/g, '""')]
          .map((v) => `"${String(v ?? '')}"`)
          .join(',')
      )
      .join('\n');

    return new Response(head + body, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="audit-logs.csv"'
      }
    });
  }

  return NextResponse.json({ total: filtered.length, items: filtered });
}
