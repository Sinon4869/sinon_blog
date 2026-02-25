/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { buildCacheKey, cacheGetJson, cacheSetJson, getCacheVersion } from '@/lib/cf-cache';
import { prisma } from '@/lib/prisma';
import { getRequestId, logObs } from '@/lib/obs';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/security';

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  const { searchParams } = new URL(req.url);
  const ip = getClientIp(req);
  const limit = enforceRateLimit(`search:${ip}`, 90, 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ requestId, error: 'rate_limited' }, { status: 429, headers: { 'x-cache-status': 'bypass' } });
  }

  const q = sanitizeText(searchParams.get('q') || '', 120).trim();
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const pageSize = Math.min(20, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));

  if (!q) {
    return NextResponse.json({ requestId, q, page, pageSize, total: 0, items: [] }, { headers: { 'x-cache-status': 'bypass' } });
  }

  const version = await getCacheVersion();
  const cacheKey = buildCacheKey('search', { version, q, page, pageSize });
  const cached = await cacheGetJson<{ q: string; page: number; pageSize: number; total: number; items: unknown[] }>(cacheKey);
  if (cached) {
    return NextResponse.json({ requestId, ...cached }, {
      headers: {
        'x-cache-status': 'hit',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
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

  const payload = { q, page, pageSize, total, items };
  await cacheSetJson(cacheKey, payload, 60);

  logObs('search_query', {
    requestId,
    q,
    page,
    pageSize,
    total,
    cache: 'miss',
    durationMs: Date.now() - startedAt
  });

  return NextResponse.json({ requestId, ...payload }, {
    headers: {
      'x-cache-status': 'miss',
      'cache-control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
