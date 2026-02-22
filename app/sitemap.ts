import type { MetadataRoute } from 'next';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const posts = await prisma.post.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } });

  return [
    { url: `${base}/`, lastModified: new Date() },
    ...posts.map((p) => ({
      url: `${base}/posts/${p.slug}`,
      lastModified: p.updatedAt
    }))
  ];
}
