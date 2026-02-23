import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import type { Route } from 'next';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPostPath } from '@/lib/utils';

function slugCandidates(raw: string) {
  const set = new Set<string>();
  const value = (raw || '').trim();
  if (value) set.add(value);
  try {
    const decoded = decodeURIComponent(value);
    if (decoded) set.add(decoded);
  } catch {
    // ignore malformed encoding
  }
  return Array.from(set);
}

export default async function LegacyPostSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  let post = null as Awaited<ReturnType<typeof prisma.post.findUnique>>;
  for (const candidate of slugCandidates(slug)) {
    post = await prisma.post.findUnique({
      where: { slug: candidate },
      select: {
        slug: true,
        published: true,
        publishedAt: true,
        createdAt: true,
        authorId: true
      }
    });
    if (post) break;
  }

  if (!post) return notFound();
  if (!post.published && session?.user?.id !== post.authorId && session?.user?.role !== 'ADMIN') {
    return notFound();
  }

  redirect(buildPostPath(post) as Route);
}
