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
import { buildPostPath, slugify } from '@/lib/utils';

function makeInternalPostSlug() {
  return `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function htmlToPlainText(input: string) {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMeaningfulHtmlContent(input: string) {
  const plain = htmlToPlainText(input);
  if (plain.length > 0) return true;
  return /<(img|video|audio|iframe|table|hr)\b/i.test(input);
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

  if (!title || !hasMeaningfulHtmlContent(content)) throw new Error('标题与内容不能为空');

  const slug = id ? undefined : makeInternalPostSlug();

  const tags = tagLine
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  const words = htmlToPlainText(content)
    .split(/\s+/)
    .filter(Boolean).length;
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

export async function savePersonalIntroConfig(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可修改个人介绍配置');

  const name = sanitizeText(formData.get('profileName')?.toString() || '', 50).trim();
  const bio = sanitizeText(formData.get('profileBio')?.toString() || '', 300).trim();
  const avatar = sanitizeText(formData.get('profileAvatar')?.toString() || '', 2000).trim();
  const website = sanitizeText(formData.get('profileWebsite')?.toString() || '', 2000).trim();
  const github = sanitizeText(formData.get('profileGithub')?.toString() || '', 2000).trim();
  const x = sanitizeText(formData.get('profileX')?.toString() || '', 2000).trim();

  const urlFields = [
    { label: '网站', url: website },
    { label: 'GitHub', url: github },
    { label: 'X', url: x }
  ].filter((i) => i.url);

  for (const item of [avatar, ...urlFields.map((i) => i.url)]) {
    if (!item) continue;
    try {
      const u = new URL(item);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('invalid');
    } catch {
      throw new Error('链接格式无效，请使用 http/https 完整链接');
    }
  }

  await prisma.setting.set(SETTING_KEYS.profileName, name);
  await prisma.setting.set(SETTING_KEYS.profileBio, bio);
  await prisma.setting.set(SETTING_KEYS.profileAvatar, avatar);
  await prisma.setting.set(SETTING_KEYS.profileLinks, JSON.stringify(urlFields));

  revalidatePath('/admin');
  revalidatePath('/');
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

export async function updateCategoryOrder(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可管理分类');

  const tagId = formData.get('tagId')?.toString().trim();
  const sortOrderRaw = formData.get('sortOrder')?.toString().trim() || '0';
  if (!tagId) throw new Error('分类不存在');

  const sortOrder = Number(sortOrderRaw);
  if (!Number.isFinite(sortOrder)) throw new Error('排序值无效');

  await prisma.tag.update({ where: { id: tagId }, data: { sort_order: Math.max(-9999, Math.min(9999, Math.round(sortOrder))) } });
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function renameCategory(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可管理分类');

  const tagId = formData.get('tagId')?.toString().trim();
  const nextName = sanitizeText(formData.get('nextName')?.toString() || '', 50).trim();
  if (!tagId || !nextName) throw new Error('分类参数不完整');

  const tag = (await prisma.tag.findUnique({ where: { id: tagId } })) as { id: string; slug: string } | null;
  if (!tag) throw new Error('分类不存在');

  const baseSlug = slugify(nextName);
  if (!baseSlug) throw new Error('分类名称无效');

  let nextSlug = baseSlug;
  let i = 2;
  while (true) {
    const found = (await prisma.tag.findUnique({ where: { slug: nextSlug } })) as { id: string } | null;
    if (!found || found.id === tagId) break;
    nextSlug = `${baseSlug}-${i}`;
    i += 1;
  }

  await prisma.tag.update({ where: { id: tagId }, data: { name: nextName, slug: nextSlug } });
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function mergeOrDeleteCategory(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可管理分类');

  const sourceTagId = formData.get('sourceTagId')?.toString().trim();
  const targetTagId = formData.get('targetTagId')?.toString().trim() || '';
  const mode = formData.get('mode')?.toString().trim() || 'delete';
  if (!sourceTagId) throw new Error('分类参数不完整');

  const source = (await prisma.tag.findUnique({ where: { id: sourceTagId } })) as { id: string } | null;
  if (!source) throw new Error('分类不存在');

  const linked = await prisma.transaction(async (tx) => {
    const countRow = await tx.one<{ c: number }>('SELECT COUNT(*) as c FROM post_tags WHERE tagId = ?', sourceTagId);
    return countRow?.c ?? 0;
  });

  if (mode === 'merge') {
    if (!targetTagId) throw new Error('请选择合并目标分类');
    if (targetTagId === sourceTagId) throw new Error('不能合并到自身');

    const target = (await prisma.tag.findUnique({ where: { id: targetTagId } })) as { id: string } | null;
    if (!target) throw new Error('目标分类不存在');

    await prisma.transaction(async (tx) => {
      await tx.run('INSERT OR IGNORE INTO post_tags (postId, tagId) SELECT postId, ? FROM post_tags WHERE tagId = ?', targetTagId, sourceTagId);
      await tx.run('DELETE FROM post_tags WHERE tagId = ?', sourceTagId);
      await tx.run('DELETE FROM tags WHERE id = ?', sourceTagId);
    });
  } else {
    if (linked > 0) throw new Error('该分类下仍有关联文章，请先选择“合并”再删除');
    await prisma.tag.delete({ where: { id: sourceTagId } });
  }

  revalidatePath('/admin');
  revalidatePath('/');
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
