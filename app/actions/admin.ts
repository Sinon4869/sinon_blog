'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

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

function redirectAdminNotice(notice: string, type: 'success' | 'error', hash: 'site-nav-config' | 'category-center' = 'site-nav-config') {
  redirect((`/admin?notice=${encodeURIComponent(notice)}&type=${type}#${hash}` as never));
}

export async function saveSiteConfig(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可修改站点配置');

  const siteTitleRaw = formData.get('siteTitle')?.toString().trim() || 'Komorebi';
  const siteTitle = siteTitleRaw.slice(0, 40) || 'Komorebi';
  const siteIcon = sanitizeText(formData.get('siteIcon')?.toString() || '', 8).trim();
  const siteIconUrl = sanitizeText(formData.get('siteIconUrl')?.toString() || '', 2000).trim();

  if (siteIconUrl) {
    const isRelativeAssetPath = siteIconUrl.startsWith('/api/assets/') || siteIconUrl.startsWith('/');
    if (!isRelativeAssetPath) {
      try {
        const u = new URL(siteIconUrl);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('invalid');
      } catch {
        redirectAdminNotice('站点图标图片 URL 无效，请使用 http/https 或站内 /api/assets/... 路径', 'error', 'site-nav-config');
      }
    }
  }

  await prisma.setting.set(SETTING_KEYS.siteTitle, siteTitle);
  await prisma.setting.set(SETTING_KEYS.siteIcon, siteIcon);
  await prisma.setting.set(SETTING_KEYS.siteIconUrl, siteIconUrl);

  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath('/admin');
  redirectAdminNotice('站点配置已保存', 'success', 'site-nav-config');
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
  redirectAdminNotice('分类创建成功', 'success', 'category-center');
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
  redirectAdminNotice('分类排序已更新', 'success', 'category-center');
}

export async function updateCategoryOrderBatch(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可管理分类');

  const raw = formData.get('categoryOrderJson')?.toString() || '[]';
  let items: Array<{ id: string; sortOrder: number }> = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      items = parsed
        .map((x) => ({ id: String(x?.id || '').trim(), sortOrder: Number(x?.sortOrder ?? 0) }))
        .filter((x) => x.id && Number.isFinite(x.sortOrder))
        .slice(0, 200);
    }
  } catch {
    redirectAdminNotice('排序数据格式错误', 'error', 'category-center');
  }

  if (!items.length) redirectAdminNotice('没有可保存的排序变更', 'error', 'category-center');

  await prisma.transaction(async (tx) => {
    for (const item of items) {
      await tx.run('UPDATE tags SET sort_order = ? WHERE id = ?', item.sortOrder, item.id);
    }
  });

  revalidatePath('/admin');
  revalidatePath('/');
  redirectAdminNotice('拖拽排序已保存', 'success', 'category-center');
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
  redirectAdminNotice('分类重命名成功', 'success', 'category-center');
}

export async function mergeOrDeleteCategory(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可管理分类');

  const sourceTagId = formData.get('sourceTagId')?.toString().trim();
  const targetTagId = formData.get('targetTagId')?.toString().trim() || '';
  const mode = formData.get('mode')?.toString().trim() || 'delete';
  if (!sourceTagId) redirectAdminNotice('分类参数不完整', 'error', 'category-center');

  const source = (await prisma.tag.findUnique({ where: { id: sourceTagId } })) as { id: string } | null;
  if (!source) redirectAdminNotice('分类不存在或已被处理', 'error', 'category-center');

  let linked = 0;
  try {
    linked = await prisma.transaction(async (tx) => {
      const countRow = await tx.one<{ c: number }>('SELECT COUNT(*) as c FROM post_tags WHERE tagId = ?', sourceTagId);
      return Number(countRow?.c ?? 0);
    });
  } catch {
    redirectAdminNotice('分类关联检查失败，请稍后重试', 'error', 'category-center');
  }

  if (mode === 'merge') {
    if (!targetTagId || targetTagId === sourceTagId) redirectAdminNotice('请选择有效的合并目标分类', 'error', 'category-center');

    const target = (await prisma.tag.findUnique({ where: { id: targetTagId } })) as { id: string } | null;
    if (!target) redirectAdminNotice('目标分类不存在', 'error', 'category-center');

    try {
      await prisma.transaction(async (tx) => {
        await tx.run('INSERT OR IGNORE INTO post_tags (postId, tagId) SELECT postId, ? FROM post_tags WHERE tagId = ?', targetTagId, sourceTagId);
        await tx.run('DELETE FROM post_tags WHERE tagId = ?', sourceTagId);
        await tx.run('DELETE FROM tags WHERE id = ?', sourceTagId);
      });
    } catch {
      redirectAdminNotice('分类合并失败，请稍后重试', 'error', 'category-center');
    }
  } else {
    if (linked > 0) redirectAdminNotice('该分类仍有关联文章，请先合并再删除', 'error', 'category-center');
    try {
      await prisma.tag.delete({ where: { id: sourceTagId } });
    } catch {
      redirectAdminNotice('分类删除失败，请稍后重试', 'error', 'category-center');
    }
  }

  revalidatePath('/admin');
  revalidatePath('/');
  redirectAdminNotice(mode === 'merge' ? '分类合并成功' : '分类删除成功', 'success', 'category-center');
}
