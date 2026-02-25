'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';

const QUICK_ITEMS = [
  { href: '/write/new', label: '新建文章' },
  { href: '/dashboard', label: '控制台' },
  { href: '/archives', label: '归档' },
  { href: '/search', label: '搜索' }
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = QUICK_ITEMS.filter((x) => x.label.toLowerCase().includes(q.trim().toLowerCase()));
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--line-soft)] bg-white p-3" onClick={(e) => e.stopPropagation()}>
        <input autoFocus className="input" placeholder="输入命令..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-2 space-y-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href as Route} className="block rounded px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          {items.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">无匹配项</p>}
        </div>
      </div>
    </div>
  );
}
