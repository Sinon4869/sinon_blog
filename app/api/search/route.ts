/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getRequestId, logObs } from '@/lib/obs';

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(20, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));

  if (!q) {
    return NextResponse.json({ q, page, pageSize, total: 0, items: [] });
  }

  const where = {
    published: true,
    OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { excerpt: { contains: q, mode: 'insensitive' as const } }]
  };

  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        createdAt: true,
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } }
      }
    }),
    prisma.post.count({ where })
  ]);

  logObs('search_query', {
    requestId,
    q,
    page,
    pageSize,
    total,
    durationMs: Date.now() - startedAt
  });

  return NextResponse.json({ requestId, q, page, pageSize, total, items });
}
