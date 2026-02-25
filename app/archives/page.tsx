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

export default async function ArchivesPage() {
  const posts = await prisma.post.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' }, take: 300 });

  const map = new Map<string, Group>();
  for (const p of posts) {
    const base = p.publishedAt || p.createdAt;
    const key = monthKey(base);
    if (!map.has(key)) map.set(key, { key, label: key, posts: [] });
    map.get(key)!.posts.push(p);
  }

  const groups = Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));

  return (
    <div className="space-y-5">
      <section className="card">
        <p className="text-xs tracking-[0.2em] text-zinc-500">ARCHIVES</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-800">文章归档</h1>
        <p className="mt-2 text-sm text-zinc-600">按年月浏览历史文章，共 {posts.length} 篇。</p>
      </section>

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

      {groups.length === 0 && <section className="card text-sm text-zinc-500">暂无已发布文章。</section>}
    </div>
  );
}
