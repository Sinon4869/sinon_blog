import { NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = enforceRateLimit(`web-vitals:${ip}`, 120, 60 * 1000);
  if (!limit.ok) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: false }, { status: 400 });

  console.info(
    JSON.stringify({
      type: 'web_vitals',
      ts: new Date().toISOString(),
      ...payload
    })
  );

  return NextResponse.json({ ok: true });
}
