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
  };
};

const DRAFT_PREFIX = 'komorebi:draft:';

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
  const [published, setPublished] = useState(!!post?.published);
  const [restored, setRestored] = useState(false);

  const draftKey = `${DRAFT_PREFIX}${post?.id || 'new'}`;
  const stat = useMemo(() => estimateReadingTime(content), [content]);

  function saveLocalDraft() {
    const payload = {
      title,
      excerpt,
      tags,
      content,
      published,
      ts: Date.now()
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
  }

  function restoreLocalDraft() {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as {
        title?: string;
        excerpt?: string;
        tags?: string;
        content?: string;
        published?: boolean;
      };
      setTitle(d.title || '');
      setExcerpt(d.excerpt || '');
      setTags(d.tags || '');
      setContent(d.content || '');
      setPublished(!!d.published);
      setRestored(true);
    } catch {
      // ignore broken draft
    }
  }

  function clearLocalDraft() {
    localStorage.removeItem(draftKey);
    setRestored(false);
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
        <input
          className="input"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          required
        />
        <input
          className="input"
          name="excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="摘要"
        />
        <input
          className="input"
          name="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="标签，逗号分隔（如：前端,AI,随笔）"
        />
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
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => insertAtEnd('```ts\nconsole.log("hello");\n```')}
          >
            代码块
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => insertAtEnd('> 引用内容')}
          >
            引用
          </button>
        </div>

        <textarea
          className="input min-h-[50vh] md:min-h-[65vh]"
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Markdown/MDX 内容"
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            字数：{stat.words} · 预计阅读 {stat.minutes} 分钟
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded border px-2 py-1" onClick={restoreLocalDraft}>
              恢复本地草稿
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={saveLocalDraft}>
              保存本地草稿
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={clearLocalDraft}>
              清除草稿
            </button>
          </div>
        </div>
        {restored && <p className="text-xs text-green-600">已恢复本地草稿</p>}
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
