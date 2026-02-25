'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { bumpCacheVersion } from '@/lib/cf-cache';
import { archiveNotionByPostId, syncPostToNotion } from '@/lib/notion-sync';
import { savePostWithTags } from '@/lib/post-service';
import { prisma } from '@/lib/prisma';
import { sanitizeHtml, sanitizeText } from '@/lib/security';
import { buildPostPath } from '@/lib/utils';

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
