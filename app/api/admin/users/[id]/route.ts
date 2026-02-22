import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z
  .object({
    role: z.enum(['USER', 'ADMIN']).optional(),
    disabled: z.boolean().optional()
  })
  .refine((v) => v.role !== undefined || v.disabled !== undefined, { message: '至少提供一个更新字段' });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数错误' }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.disabled !== undefined ? { disabled: parsed.data.disabled ? 1 : 0 } : {})
    }
  });
  if (!user) return NextResponse.json({ error: '更新失败' }, { status: 500 });

  return NextResponse.json({ user: { id: user.id, role: user.role, disabled: user.disabled } });
}
