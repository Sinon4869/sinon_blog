'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPostPath } from '@/lib/utils';

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('请先登录');
  return session.user;
}

const profileSchema = z.object({
  name: z.string().trim().max(50).optional(),
  bio: z.string().trim().max(500).optional(),
  image: z.string().trim().url('头像必须是有效 URL').optional().or(z.literal(''))
});

export async function saveProfile(formData: FormData) {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get('name')?.toString() ?? '',
    bio: formData.get('bio')?.toString() ?? '',
    image: formData.get('image')?.toString() ?? ''
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || '资料格式错误');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name || null,
      bio: parsed.data.bio || null,
      image: parsed.data.image || null
    }
  });

  revalidatePath(`/profile/${user.id}`);
}

export async function toggleFavorite(formData: FormData) {
  const user = await requireUser();
  const postId = formData.get('postId')?.toString();
  if (!postId) return;

  const exists = await prisma.favorite.findUnique({
    where: { userId_postId: { userId: user.id, postId } }
  });

  if (exists) {
    await prisma.favorite.delete({ where: { userId_postId: { userId: user.id, postId } } });
  } else {
    await prisma.favorite.create({ data: { userId: user.id, postId } });
  }

  revalidatePath('/dashboard');
  revalidatePath('/');
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, publishedAt: true, createdAt: true }
  });
  if (post?.id) revalidatePath(buildPostPath(post));
}

export async function updatePassword(formData: FormData) {
  const user = await requireUser();
  const currentPassword = formData.get('currentPassword')?.toString() ?? '';
  const newPassword = formData.get('newPassword')?.toString() ?? '';

  if (newPassword.length < 6) throw new Error('新密码至少6位');

  const dbUser = (await prisma.user.findUnique({ where: { id: user.id } })) as { password?: string | null } | null;
  if (!dbUser?.password) throw new Error('当前账号未设置密码，请使用第三方登录');

  const ok = await compare(currentPassword, dbUser.password);
  if (!ok) throw new Error('当前密码错误');

  const nextHashed = await hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: nextHashed } });

  revalidatePath('/account');
}

export async function updateEmail(formData: FormData) {
  const user = await requireUser();
  const newEmail = formData.get('newEmail')?.toString().trim().toLowerCase() ?? '';
  const currentPassword = formData.get('currentPasswordForEmail')?.toString() ?? '';

  if (!newEmail || !newEmail.includes('@')) throw new Error('请输入有效邮箱');

  const dbUser = (await prisma.user.findUnique({ where: { id: user.id } })) as { email: string; password?: string | null } | null;
  if (!dbUser) throw new Error('用户不存在');
  if (dbUser.email === newEmail) throw new Error('新邮箱不能与当前邮箱相同');

  const exists = await prisma.user.findUnique({ where: { email: newEmail } });
  if (exists) throw new Error('该邮箱已被占用');

  if (dbUser.password) {
    const ok = await compare(currentPassword, dbUser.password);
    if (!ok) throw new Error('当前密码错误');
  }

  await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
  revalidatePath('/account');
}

export async function deleteMyAccount(formData: FormData) {
  const user = await requireUser();
  const confirmEmail = formData.get('confirmEmail')?.toString().trim().toLowerCase() ?? '';

  const dbUser = (await prisma.user.findUnique({ where: { id: user.id } })) as { email: string } | null;
  if (!dbUser) throw new Error('用户不存在');
  if (confirmEmail !== dbUser.email.toLowerCase()) throw new Error('确认邮箱不匹配，已取消删除');

  await prisma.user.delete({ where: { id: user.id } });
  redirect('/api/auth/signout');
}
