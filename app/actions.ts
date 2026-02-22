'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { compare, hash } from 'bcryptjs';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('请先登录');
  return session.user;
}

export async function savePost(formData: FormData) {
  const user = await requireUser();
  const id = formData.get('id')?.toString();
  const title = formData.get('title')?.toString() ?? '';
  const content = formData.get('content')?.toString() ?? '';
  const excerpt = formData.get('excerpt')?.toString() ?? '';
  const tagLine = formData.get('tags')?.toString() ?? '';
  const published = formData.get('published') === 'on';

  if (!title || !content) throw new Error('标题与内容不能为空');

  const slugBase = slugify(title);
  const slug = id ? undefined : `${slugBase}-${Date.now().toString().slice(-5)}`;

  const tags = tagLine
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  const post = id
    ? await prisma.post.update({
        where: { id },
        data: {
          title,
          excerpt,
          content,
          published,
          publishedAt: published ? new Date() : null
        }
      })
    : await prisma.post.create({
        data: {
          title,
          slug: slug!,
          excerpt,
          content,
          published,
          publishedAt: published ? new Date() : null,
          authorId: user.id
        }
      });

  await prisma.postTag.deleteMany({ where: { postId: post.id } });
  for (const tagName of tags) {
    const tagSlug = slugify(tagName);
    const tag = await prisma.tag.upsert({
      where: { slug: tagSlug },
      update: { name: tagName },
      create: { name: tagName, slug: tagSlug }
    });
    await prisma.postTag.create({ data: { postId: post.id, tagId: tag.id } });
  }

  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath(`/posts/${post.slug}`);
}

export async function deletePost(formData: FormData) {
  const user = await requireUser();
  const id = formData.get('id')?.toString();
  if (!id) return;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return;
  if (post.authorId !== user.id && user.role !== 'ADMIN') throw new Error('无权限删除');

  await prisma.post.delete({ where: { id } });
  revalidatePath('/');
  revalidatePath('/dashboard');
}

export async function saveProfile(formData: FormData) {
  const user = await requireUser();
  const name = formData.get('name')?.toString() ?? '';
  const bio = formData.get('bio')?.toString() ?? '';

  await prisma.user.update({
    where: { id: user.id },
    data: { name, bio }
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
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { slug: true } });
  if (post?.slug) revalidatePath(`/posts/${post.slug}`);
}

export async function updatePassword(formData: FormData) {
  const user = await requireUser();
  const currentPassword = formData.get('currentPassword')?.toString() ?? '';
  const newPassword = formData.get('newPassword')?.toString() ?? '';

  if (newPassword.length < 6) throw new Error('新密码至少6位');

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
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

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
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

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error('用户不存在');
  if (confirmEmail !== dbUser.email.toLowerCase()) throw new Error('确认邮箱不匹配，已取消删除');

  await prisma.user.delete({ where: { id: user.id } });
  redirect('/api/auth/signout');
}
