import { NextResponse } from 'next/server';

export async function POST(req: Request) {
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
