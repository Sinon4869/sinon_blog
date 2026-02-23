'use client';

import { useMemo, useState } from 'react';

type WriteEditorProps = {
  action: (formData: FormData) => void | Promise<void>;
  post?: {
    id?: string;
    title?: string;
    excerpt?: string;
    content?: string;
    published?: boolean;
    tags?: string;
    coverImage?: string;
    backgroundImage?: string;
  };
};

const DRAFT_PREFIX = 'komorebi:draft:';
const SNAPSHOT_PREFIX = 'komorebi:draft-snapshots:';
const MAX_SNAPSHOTS = 5;

type DraftPayload = {
  title: string;
  excerpt: string;
  tags: string;
  content: string;
  coverImage: string;
  backgroundImage: string;
  published: boolean;
  ts: number;
};

function estimateReadingTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return { words, minutes };
}

export function WriteEditor({ action, post }: WriteEditorProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [tags, setTags] = useState(post?.tags || '');
  const [content, setContent] = useState(post?.content || '');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [backgroundImage, setBackgroundImage] = useState(post?.backgroundImage || '');
  const [published, setPublished] = useState(!!post?.published);
  const [restored, setRestored] = useState(false);
  const [snapshots, setSnapshots] = useState<DraftPayload[]>([]);

  const draftKey = `${DRAFT_PREFIX}${post?.id || 'new'}`;
  const snapshotKey = `${SNAPSHOT_PREFIX}${post?.id || 'new'}`;
  const stat = useMemo(() => estimateReadingTime(content), [content]);

  function currentPayload(): DraftPayload {
    return {
      title,
      excerpt,
      tags,
      content,
      coverImage,
      backgroundImage,
      published,
      ts: Date.now()
    };
  }

  function saveLocalDraft() {
    localStorage.setItem(draftKey, JSON.stringify(currentPayload()));
  }

  function loadSnapshots(): DraftPayload[] {
    const raw = localStorage.getItem(snapshotKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DraftPayload[];
    } catch {
      return [];
    }
  }

  function applyDraft(d: Partial<DraftPayload>) {
    setTitle(d.title || '');
    setExcerpt(d.excerpt || '');
    setTags(d.tags || '');
    setContent(d.content || '');
    setCoverImage(d.coverImage || '');
    setBackgroundImage(d.backgroundImage || '');
    setPublished(!!d.published);
    setRestored(true);
  }

  function restoreLocalDraft() {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as DraftPayload;
      applyDraft(d);
    } catch {
      // ignore broken draft
    }
  }

  function saveSnapshot() {
    const next = [currentPayload(), ...loadSnapshots()].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(snapshotKey, JSON.stringify(next));
    setSnapshots(next);
  }

  function restoreSnapshot(idx: number) {
    const list = loadSnapshots();
    const item = list[idx];
    if (!item) return;
    applyDraft(item);
    setSnapshots(list);
  }

  function clearLocalDraft() {
    localStorage.removeItem(draftKey);
    localStorage.removeItem(snapshotKey);
    setSnapshots([]);
    setRestored(false);
  }

  function showSnapshots() {
    setSnapshots(loadSnapshots());
  }

  function insertAtEnd(snippet: string) {
    setContent((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  }

  return (
    <form
      action={async (formData) => {
        await action(formData);
        clearLocalDraft();
      }}
      className="space-y-3 pb-24 md:pb-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{post?.id ? '编辑文章' : '新建文章'}</h1>
        {!post?.id && (
          <div className="flex flex-wrap gap-2 text-xs">
            <a className="rounded border px-2 py-1" href="/write?template=tutorial">
              套用教程模板
            </a>
            <a className="rounded border px-2 py-1" href="/write?template=weekly">
              套用周报模板
            </a>
            <a className="rounded border px-2 py-1" href="/write?template=review">
              套用复盘模板
            </a>
          </div>
        )}
      </div>

      <input type="hidden" name="id" value={post?.id || ''} />

      <div className="grid gap-3">
        <input className="input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" required />
        <input className="input" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="摘要" />
        <input className="input" name="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，逗号分隔（如：前端,AI,随笔）" />
        <input className="input" name="coverImage" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="文章插图 URL（列表封面）" />
        <input className="input" name="backgroundImage" value={backgroundImage} onChange={(e) => setBackgroundImage(e.target.value)} placeholder="文章背景图 URL（详情页头图）" />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => insertAtEnd('## 小标题')}>
            标题
          </button>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => insertAtEnd('**加粗文本**')}>
            加粗
          </button>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => insertAtEnd('- 列表项 1\n- 列表项 2')}>
            列表
          </button>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => insertAtEnd('```ts\nconsole.log("hello");\n```')}>
            代码块
          </button>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => insertAtEnd('> 引用内容')}>
            引用
          </button>
        </div>

        {(coverImage || backgroundImage) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {coverImage && (
              <div>
                <p className="mb-1 text-xs text-zinc-500">封面预览</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="cover-preview" className="h-36 w-full rounded-md object-cover" />
              </div>
            )}
            {backgroundImage && (
              <div>
                <p className="mb-1 text-xs text-zinc-500">背景预览</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={backgroundImage} alt="bg-preview" className="h-36 w-full rounded-md object-cover" />
              </div>
            )}
          </div>
        )}

        <textarea className="input min-h-[50vh] md:min-h-[65vh]" name="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Markdown/MDX 内容" required />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>字数：{stat.words} · 预计阅读 {stat.minutes} 分钟</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded border px-2 py-1" onClick={restoreLocalDraft}>
              恢复本地草稿
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={saveLocalDraft}>
              保存本地草稿
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={saveSnapshot}>
              保存版本快照
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={showSnapshots}>
              查看快照
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={clearLocalDraft}>
              清除草稿
            </button>
          </div>
        </div>

        {snapshots.length > 0 && (
          <div className="rounded border border-zinc-200 p-2 text-xs">
            <p className="mb-2 font-medium">最近 {Math.min(MAX_SNAPSHOTS, snapshots.length)} 次快照</p>
            <div className="space-y-1">
              {snapshots.map((s, idx) => (
                <button key={s.ts} type="button" className="block w-full rounded border px-2 py-1 text-left hover:bg-zinc-50" onClick={() => restoreSnapshot(idx)}>
                  {new Date(s.ts).toLocaleString('zh-CN')} · {s.title || '未命名'}
                </button>
              ))}
            </div>
          </div>
        )}

        {restored && <p className="text-xs text-green-600">已恢复草稿内容</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" checked={published} onChange={(e) => setPublished(e.target.checked)} /> 发布
      </label>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <button className="btn w-full md:w-auto" type="submit">
          保存文章
        </button>
      </div>
    </form>
  );
}
