/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(20, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));

  if (!q) {
    return NextResponse.json({ q, page, pageSize, total: 0, items: [] });
  }

  const where = {
    published: true,
    OR: [
      { title: { contains: q, mode: 'insensitive' as const } },
      { excerpt: { contains: q, mode: 'insensitive' as const } },
      { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' as const } } } } }
    ]
  };

  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        createdAt: true,
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } }
      }
    }),
    prisma.post.count({ where })
  ]);

  return NextResponse.json({ q, page, pageSize, total, items });
}
