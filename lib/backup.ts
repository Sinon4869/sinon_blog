/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';

async function getR2() {
  try {
    const mod = (await import('@opennextjs/cloudflare')) as { getCloudflareContext?: (opts: { async: boolean }) => Promise<any> };
    const fn = mod.getCloudflareContext;
    if (!fn) return null;
    const ctx = await fn({ async: true });
    return (ctx?.env as any)?.BLOG_ASSETS || null;
  } catch {
    return null;
  }
}

export async function backupPostsToR2() {
  const bucket = await getR2();
  if (!bucket) return { ok: false, error: 'missing_r2_binding' } as const;

  const posts = await prisma.post.findMany({
    where: { published: true },
    include: { tags: { include: { tag: true } }, author: true },
    orderBy: { updatedAt: 'desc' }
  });

  const now = new Date();
  const datePrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const key = `backups/posts/${datePrefix}/snapshot-${now.toISOString().replace(/[:.]/g, '-')}.json`;

  const payload = {
    exportedAt: now.toISOString(),
    count: posts.length,
    posts: posts.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || '',
      content: p.content,
      published: !!p.published,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      coverImage: p.cover_image || null,
      backgroundImage: p.background_image || null,
      tags: (p.tags || []).map((t: any) => t?.tag?.name).filter(Boolean),
      author: p.author ? { id: p.author.id, name: p.author.name, email: p.author.email } : null
    }))
  };

  await bucket.put(key, JSON.stringify(payload, null, 2), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {
      kind: 'posts-backup',
      date: datePrefix,
      count: String(posts.length)
    }
  });

  return { ok: true, key, count: posts.length } as const;
}
