'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { sanitizeHtml } from '@/lib/security';

type DraftPayload = {
  id?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string;
  coverImage?: string;
  backgroundImage?: string;
};

function decodeDraft(raw: string): DraftPayload | null {
  if (!raw) return null;
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    return JSON.parse(json) as DraftPayload;
  } catch {
    return null;
  }
}

export function WritePreviewClient({ draftRaw }: { draftRaw: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const draft = useMemo(() => decodeDraft(draftRaw), [draftRaw]);

  async function confirmPublish() {
    if (!draft) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/write/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft)
      });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok) throw new Error(data.error || '发布失败');
      router.push((data.path || '/dashboard') as Route);
    } catch (e) {
      alert(e instanceof Error ? e.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!draft) {
    return (
      <div className="container-page space-y-3">
        <h1 className="text-2xl font-bold">预览数据无效</h1>
        <Link href="/write/new" className="btn inline-block">
          返回编辑
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">发布前预览</h1>
        <div className="flex gap-2">
          <Link href={draft.id ? `/write?id=${draft.id}` : '/write/new'} className="rounded border px-3 py-2 text-sm">
            返回编辑
          </Link>
          <button className="btn" type="button" disabled={submitting} onClick={confirmPublish}>
            {submitting ? '发布中...' : '确认发布'}
          </button>
        </div>
      </div>

      {draft.backgroundImage && <img src={draft.backgroundImage} alt="bg" className="h-56 w-full rounded-xl object-cover" />}

      <article className="card space-y-3">
        <h2 className="text-3xl font-bold">{draft.title || '未命名标题'}</h2>
        {draft.excerpt && <p className="text-zinc-600">{draft.excerpt}</p>}
        {draft.coverImage && <img src={draft.coverImage} alt="cover" className="h-56 w-full rounded-xl object-cover" />}
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(draft.content || '') }} />
      </article>
    </div>
  );
}
