'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitizeText } from '@/lib/security';
import { SETTING_KEYS } from '@/lib/site-settings';
import { slugify } from '@/lib/utils';

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('请先登录');
  return session.user;
}

export async function saveSiteConfig(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可修改站点配置');

  const siteTitleRaw = formData.get('siteTitle')?.toString().trim() || 'Komorebi';
  const siteTitle = siteTitleRaw.slice(0, 40) || 'Komorebi';
  const siteIcon = sanitizeText(formData.get('siteIcon')?.toString() || '', 8).trim();
  const categoriesJson = formData.get('categoriesJson')?.toString() || '[]';
  let categoryNames: string[] = [];
  try {
    const parsed = JSON.parse(categoriesJson);
    if (Array.isArray(parsed)) {
      categoryNames = Array.from(new Set(parsed.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 20);
    }
  } catch {
    throw new Error('分类数据格式错误，请重新添加分类');
  }

  await prisma.setting.set(SETTING_KEYS.siteTitle, siteTitle);
  await prisma.setting.set(SETTING_KEYS.siteIcon, siteIcon);
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

export async function createCategory(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可管理分类');

  const name = sanitizeText(formData.get('name')?.toString() || '', 50).trim();
  if (!name) throw new Error('请输入分类名称');

  const baseSlug = slugify(name);
  if (!baseSlug) throw new Error('分类名称无效');

  let nextSlug = baseSlug;
  let i = 2;
  while (true) {
    const found = (await prisma.tag.findUnique({ where: { slug: nextSlug } })) as { id: string } | null;
    if (!found) break;
    nextSlug = `${baseSlug}-${i}`;
    i += 1;
  }

  await prisma.tag.upsert({
    where: { slug: nextSlug },
    update: { name },
    create: { name, slug: nextSlug, sort_order: 0 }
  });
  revalidatePath('/admin');
  revalidatePath('/');
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
