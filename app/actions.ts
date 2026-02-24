'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { bumpCacheVersion } from '@/lib/cf-cache';
import { prisma } from '@/lib/prisma';
import { SETTING_KEYS } from '@/lib/site-settings';
import { sanitizeHtml, sanitizeText } from '@/lib/security';
import { savePostWithTags } from '@/lib/post-service';
import { archiveNotionByPostId, syncPostToNotion } from '@/lib/notion-sync';
import { buildPostPath } from '@/lib/utils';

function makeInternalPostSlug() {
  return `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

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

export async function savePost(formData: FormData) {
  const user = await requireUser();
  const id = formData.get('id')?.toString();
  const title = sanitizeText(formData.get('title')?.toString() ?? '', 200);
  const content = sanitizeHtml(formData.get('content')?.toString() ?? '');
  const excerpt = sanitizeText(formData.get('excerpt')?.toString() ?? '', 500);
  const tagLine = sanitizeText(formData.get('tags')?.toString() ?? '', 300);
  const coverImage = sanitizeText(formData.get('coverImage')?.toString().trim() ?? '', 2000);
  const backgroundImage = sanitizeText(formData.get('backgroundImage')?.toString().trim() ?? '', 2000);
  const published = formData.get('published') === 'on';

  if (!title || !content) throw new Error('标题与内容不能为空');

  const slug = id ? undefined : makeInternalPostSlug();

  const tags = tagLine
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.round(words / 220));

  const post = await savePostWithTags({
    id,
    authorId: user.id,
    title,
    excerpt,
    content,
    published,
    coverImage,
    backgroundImage,
    tags,
    readingTime,
    slug
  });

  await bumpCacheVersion();
  await syncPostToNotion(post.id, published ? 'publish' : 'save');
  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath(buildPostPath(post));
}

export async function deletePost(formData: FormData) {
  const user = await requireUser();
  const id = formData.get('id')?.toString();
  if (!id) return;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return;
  if (post.authorId !== user.id && user.role !== 'ADMIN') throw new Error('无权限删除');

  await prisma.post.delete({ where: { id } });
  await bumpCacheVersion();
  await archiveNotionByPostId(id);
  revalidatePath('/');
  revalidatePath('/dashboard');
}

export async function setPostPublished(formData: FormData) {
  const user = await requireUser();
  const id = formData.get('id')?.toString();
  const nextPublished = formData.get('nextPublished')?.toString() === '1';
  if (!id) return;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return;
  if (post.authorId !== user.id && user.role !== 'ADMIN') throw new Error('无权限修改');

  await prisma.post.update({
    where: { id },
    data: {
      published: nextPublished ? 1 : 0,
      publishedAt: nextPublished ? new Date() : null
    }
  });

  await bumpCacheVersion();
  await syncPostToNotion(post.id, 'toggle-publish');
  revalidatePath('/');
  revalidatePath('/dashboard');
  if (post.id) revalidatePath(buildPostPath(post));
}

export async function saveSiteConfig(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可修改站点配置');

  const siteTitleRaw = formData.get('siteTitle')?.toString().trim() || 'Komorebi';
  const siteTitle = siteTitleRaw.slice(0, 40) || 'Komorebi';
  const categoriesJson = formData.get('categoriesJson')?.toString() || '[]';
  let categoryNames: string[] = [];
  try {
    const parsed = JSON.parse(categoriesJson);
    if (Array.isArray(parsed)) {
      categoryNames = Array.from(
        new Set(
          parsed
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        )
      ).slice(0, 20);
    }
  } catch {
    throw new Error('分类数据格式错误，请重新添加分类');
  }

  await prisma.setting.set(SETTING_KEYS.siteTitle, siteTitle);
  await prisma.setting.set(SETTING_KEYS.navCategories, JSON.stringify(categoryNames));

  revalidatePath('/');
  revalidatePath('/dashboard');
}

export async function saveUserSystemConfig(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可修改用户系统配置');

  const registrationEnabled = formData.get('registrationEnabled') === 'on';
  const anonymousCommentEnabled = formData.get('anonymousCommentEnabled') === 'on';

  await prisma.setting.set(SETTING_KEYS.registrationEnabled, registrationEnabled ? '1' : '0');
  await prisma.setting.set(SETTING_KEYS.anonymousCommentEnabled, anonymousCommentEnabled ? '1' : '0');

  revalidatePath('/admin');
  revalidatePath('/login');
  revalidatePath('/register');
}

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
