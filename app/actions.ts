'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

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
  const title = formData.get('title')?.toString() ?? '';
  const content = formData.get('content')?.toString() ?? '';
  const excerpt = formData.get('excerpt')?.toString() ?? '';
  const tagLine = formData.get('tags')?.toString() ?? '';
  const coverImage = formData.get('coverImage')?.toString().trim() ?? '';
  const backgroundImage = formData.get('backgroundImage')?.toString().trim() ?? '';
  const published = formData.get('published') === 'on';

  if (!title || !content) throw new Error('标题与内容不能为空');

  const slugBase = slugify(title);
  const slug = id ? undefined : `${slugBase}-${Date.now().toString().slice(-5)}`;

  const tags = tagLine
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.round(words / 220));

  const post = id
    ? await prisma.post.update({
        where: { id },
        data: {
          title,
          excerpt,
          content,
          published,
          publishedAt: published ? new Date() : null,
          reading_time: readingTime,
          seo_title: title.slice(0, 60),
          seo_description: (excerpt || content.slice(0, 120)).slice(0, 160),
          cover_image: coverImage || null,
          background_image: backgroundImage || null
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
          reading_time: readingTime,
          seo_title: title.slice(0, 60),
          seo_description: (excerpt || content.slice(0, 120)).slice(0, 160),
          cover_image: coverImage || null,
          background_image: backgroundImage || null,
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

  revalidatePath('/');
  revalidatePath('/dashboard');
  if (post.slug) revalidatePath(`/posts/${post.slug}`);
}

export async function saveSiteConfig(formData: FormData) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('仅管理员可修改站点配置');

  const siteTitleRaw = formData.get('siteTitle')?.toString().trim() || 'Komorebi';
  const siteTitle = siteTitleRaw.slice(0, 40) || 'Komorebi';
  const categoriesRaw = formData.get('categories')?.toString() || '';
  const categoryNames = Array.from(
    new Set(
      categoriesRaw
        .split(/[\n,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ).slice(0, 20);

  await prisma.setting.set('site_title', siteTitle);
  await prisma.setting.set('nav_categories', categoryNames.join(','));

  for (const name of categoryNames) {
    const slug = slugify(name);
    if (!slug) continue;
    await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug }
    });
  }

  revalidatePath('/');
  revalidatePath('/dashboard');
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
