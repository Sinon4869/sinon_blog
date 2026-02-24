import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/security';
import { SUPER_ADMIN_EMAIL, isRegistrationEnabled } from '@/lib/site-settings';

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = enforceRateLimit(`register:${ip}`, 8, 10 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    const enabled = await isRegistrationEnabled();
    if (!enabled) {
      return NextResponse.json({ error: '当前站点已关闭注册' }, { status: 403 });
    }

    const payload = schema.parse(await req.json());
    const email = sanitizeText(payload.email).toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: '邮箱已注册' }, { status: 400 });

    const password = await hash(payload.password, 10);
    await prisma.user.create({
      data: {
        name: payload.name,
        email,
        password,
        role: email === SUPER_ADMIN_EMAIL ? 'ADMIN' : 'USER'
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }
}
