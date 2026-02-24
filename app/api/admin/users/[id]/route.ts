import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUPER_ADMIN_EMAIL } from '@/lib/site-settings';

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
  if (id === session.user.id) {
    if (parsed.data.disabled === true) {
      return NextResponse.json({ error: '不能禁用当前登录账号' }, { status: 400 });
    }
    if (parsed.data.role && parsed.data.role !== 'ADMIN') {
      return NextResponse.json({ error: '不能降级当前登录账号' }, { status: 400 });
    }
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  const isSuperAdmin = target.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  if (isSuperAdmin) {
    if (parsed.data.role && parsed.data.role !== 'ADMIN') {
      return NextResponse.json({ error: '超级管理员角色不可修改' }, { status: 400 });
    }
    if (parsed.data.disabled === true) {
      return NextResponse.json({ error: '超级管理员不可禁用' }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.disabled !== undefined ? { disabled: parsed.data.disabled ? 1 : 0 } : {})
    }
  });
  if (!user) return NextResponse.json({ error: '更新失败' }, { status: 500 });

  await prisma.auditLog.create({
    data: {
      actor_user_id: session.user.id,
      target_user_id: id,
      action: 'admin_user_update',
      detail: JSON.stringify(parsed.data)
    }
  });

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      disabled: user.disabled,
      last_login_at: (user as { last_login_at?: string | null }).last_login_at || null
    }
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  if (target.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: '超级管理员不可删除' }, { status: 400 });
  }
  if (id === session.user.id) {
    return NextResponse.json({ error: '不能删除当前登录账号' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      actor_user_id: session.user.id,
      target_user_id: id,
      action: 'admin_user_delete',
      detail: JSON.stringify({ id })
    }
  });
  return NextResponse.json({ ok: true });
}
