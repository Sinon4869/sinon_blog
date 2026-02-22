import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(req: Request) {
  try {
    const payload = schema.parse(await req.json());
    const exists = await prisma.user.findUnique({ where: { email: payload.email } });
    if (exists) return NextResponse.json({ error: '邮箱已注册' }, { status: 400 });

    const password = await hash(payload.password, 10);
    await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }
}
