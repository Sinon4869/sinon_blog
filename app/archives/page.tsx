/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import type { Route } from 'next';

import { prisma } from '@/lib/prisma';
import { buildPostPath, formatDate } from '@/lib/utils';

type Group = { key: string; label: string; posts: any[] };

function monthKey(dateLike: Date | string) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default async function ArchivesPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; tag?: string }> }) {
  const sp = await searchParams;
  const year = (sp.year || '').trim();
  const month = (sp.month || '').trim();
  const tag = (sp.tag || '').trim();

  const where = {
    published: true,
    ...(tag
      ? {
          tags: {
            some: {
              tag: { slug: tag }
            }
          }
        }
      : {})
  };

  const [postsRaw, tags] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 400,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        createdAt: true,
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } }
      }
    }),
    prisma.tag.findMany({ take: 40 })
  ]);

  const posts = postsRaw.filter((p: any) => {
    const d = new Date(p.publishedAt || p.createdAt);
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    if (year && y !== year) return false;
    if (month && m !== month) return false;
    return true;
  });

  const map = new Map<string, Group>();
  for (const p of posts) {
    const base = p.publishedAt || p.createdAt;
    const key = monthKey(base);
    if (!map.has(key)) map.set(key, { key, label: key, posts: [] });
    map.get(key)!.posts.push(p);
  }

  const groups = Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  const years = Array.from(new Set(postsRaw.map((p: any) => String(new Date(p.publishedAt || p.createdAt).getFullYear())))).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-5">
      <section className="card">
        <p className="text-xs tracking-[0.2em] text-zinc-500">ARCHIVES</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-800">文章归档</h1>
        <p className="mt-2 text-sm text-zinc-600">按年月浏览历史文章，共 {posts.length} 篇。</p>
      </section>

      <form action="/archives" className="card grid gap-2 sm:grid-cols-4">
        <select className="input" name="year" defaultValue={year}>
          <option value="">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select className="input" name="month" defaultValue={month}>
          <option value="">全部月份</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select className="input" name="tag" defaultValue={tag}>
          <option value="">全部分类</option>
          {tags.map((t: any) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          筛选
        </button>
      </form>

      {groups.map((g) => (
        <section key={g.key} className="card space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800">{g.label}</h2>
          <ul className="space-y-1">
            {g.posts.map((p: any) => (
              <li key={p.id} className="text-sm text-zinc-700">
                <Link href={buildPostPath(p) as Route} className="hover:underline">
                  {p.title}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">{formatDate(p.publishedAt || p.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {groups.length === 0 && <section className="card text-sm text-zinc-500">暂无匹配文章。</section>}
    </div>
  );
}
