import type { MetadataRoute } from 'next';

import { prisma } from '@/lib/prisma';
import { buildPostPath } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const [posts, tags, users] = await Promise.all([
    prisma.post.findMany({ where: { published: true }, select: { id: true, publishedAt: true, createdAt: true, updatedAt: true } }),
    prisma.tag.findMany({ select: { slug: true } }),
    prisma.user.findMany({ select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' } })
  ]);

  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/search`, lastModified: new Date() },
    ...posts.map((p) => ({
      url: `${base}${buildPostPath(p)}`,
      lastModified: p.updatedAt
    })),
    ...tags.map((t) => ({
      url: `${base}/?tag=${encodeURIComponent(t.slug)}`,
      lastModified: new Date()
    })),
    ...users.slice(0, 200).map((u) => ({
      url: `${base}/profile/${u.id}`,
      lastModified: u.createdAt || new Date()
    }))
  ];
}
