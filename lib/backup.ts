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

export async function listBackupKeys(limit = 20) {
  const bucket = await getR2();
  if (!bucket) return { ok: false, error: 'missing_r2_binding', keys: [] as string[] } as const;

  const listed = await bucket.list({ prefix: 'backups/posts/', limit: Math.min(100, Math.max(1, limit)) });
  const keys = (listed?.objects || []).map((o: any) => String(o.key || '')).filter(Boolean).sort().reverse();
  return { ok: true, keys } as const;
}

export async function restorePostsFromR2(key: string) {
  const bucket = await getR2();
  if (!bucket) return { ok: false, error: 'missing_r2_binding' } as const;

  const obj = await bucket.get(key);
  if (!obj) return { ok: false, error: 'backup_not_found' } as const;

  const text = await obj.text();
  const parsed = JSON.parse(text) as { posts?: any[] };
  const posts = Array.isArray(parsed.posts) ? parsed.posts : [];

  let upserts = 0;
  for (const p of posts) {
    const exists = await prisma.post.findUnique({ where: { id: String(p.id || '') } });
    const payload = {
      title: String(p.title || ''),
      slug: String(p.slug || ''),
      excerpt: String(p.excerpt || ''),
      content: String(p.content || ''),
      published: p.published ? 1 : 0,
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
      cover_image: p.coverImage || null,
      background_image: p.backgroundImage || null,
      authorId: String((exists as any)?.authorId || p?.author?.id || '')
    };

    if (!payload.authorId) continue;

    if (exists) {
      await prisma.post.update({ where: { id: exists.id }, data: payload });
    } else {
      await prisma.post.create({ data: { id: String(p.id || ''), ...payload } });
    }

    await prisma.postTag.deleteMany({ where: { postId: String(p.id || '') } });
    for (const tagName of (Array.isArray(p.tags) ? p.tags : []).slice(0, 20)) {
      const name = String(tagName || '').trim();
      if (!name) continue;
      const slug = name.toLowerCase().replace(/\s+/g, '-').slice(0, 60);
      const tag = await prisma.tag.upsert({ where: { slug }, update: { name }, create: { name, slug } });
      await prisma.postTag.create({ data: { postId: String(p.id || ''), tagId: tag.id } });
    }
    upserts += 1;
  }

  return { ok: true, restored: upserts } as const;
}
