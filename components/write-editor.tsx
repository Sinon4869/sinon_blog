'use client';

import { useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

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

async function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function estimateReadingTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return { words, minutes };
}

export function WriteEditor({ action, post }: WriteEditorProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [tags, setTags] = useState(post?.tags || '');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [backgroundImage, setBackgroundImage] = useState(post?.backgroundImage || '');
  const [published, setPublished] = useState(!!post?.published);
  const [restored, setRestored] = useState(false);
  const [snapshots, setSnapshots] = useState<DraftPayload[]>([]);
  const [publishPreview, setPublishPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const draftKey = `${DRAFT_PREFIX}${post?.id || 'new'}`;
  const snapshotKey = `${SNAPSHOT_PREFIX}${post?.id || 'new'}`;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Image, Link.configure({ openOnClick: false })],
    content: post?.content
      ? post.content.includes('<')
        ? post.content
        : marked.parse(post.content)
      : '<p></p>'
  });

  const content = editor?.getHTML() || '';
  const plainText = editor?.getText() || '';
  const stat = useMemo(() => estimateReadingTime(plainText), [plainText]);

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
    setCoverImage(d.coverImage || '');
    setBackgroundImage(d.backgroundImage || '');
    setPublished(!!d.published);
    if (editor && d.content) editor.commands.setContent(d.content);
    setRestored(true);
  }

  function restoreLocalDraft() {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      applyDraft(JSON.parse(raw) as DraftPayload);
    } catch {
      // ignore
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

  async function handleInlineImage(file: File | undefined) {
    if (!file || !editor) return;
    setUploading(true);
    try {
      const url = await toDataUrl(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setCoverImage(await toDataUrl(file));
    } finally {
      setUploading(false);
    }
  }

  async function handleBackgroundImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setBackgroundImage(await toDataUrl(file));
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  return (
    <form
      action={async (formData) => {
        formData.set('content', editor.getHTML());
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
      <input type="hidden" name="content" value={content} />

      <div className="grid gap-3">
        <input className="input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" required />
        <input className="input" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="摘要" />
        <input className="input" name="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，逗号分隔（如：前端,AI,随笔）" />

        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" name="coverImage" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="文章插图 URL（列表封面）" />
          <label className="rounded border px-3 py-2 text-sm hover:bg-zinc-50">
            上传封面图
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverImage(e.target.files?.[0])} />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" name="backgroundImage" value={backgroundImage} onChange={(e) => setBackgroundImage(e.target.value)} placeholder="文章背景图 URL（详情页头图）" />
          <label className="rounded border px-3 py-2 text-sm hover:bg-zinc-50">
            上传背景图
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBackgroundImage(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      {(coverImage || backgroundImage) && (
        <div className="card grid gap-3 sm:grid-cols-2">
          {coverImage && (
            <div>
              <p className="mb-1 text-xs text-zinc-500">封面预览</p>
              <img src={coverImage} alt="cover-preview" className="h-36 w-full rounded-md object-cover" />
            </div>
          )}
          {backgroundImage && (
            <div>
              <p className="mb-1 text-xs text-zinc-500">背景预览</p>
              <img src={backgroundImage} alt="bg-preview" className="h-36 w-full rounded-md object-cover" />
            </div>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <div className="tiptap-shell overflow-hidden rounded-xl border border-zinc-200">
          <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 p-2">
            <button type="button" className={`tiptap-btn ${editor.isActive('paragraph') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().setParagraph().run()}>
              P
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              H1
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              H2
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              H3
            </button>
            <span className="mx-1 h-5 w-px bg-zinc-300" />
            <button type="button" className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}>
              B
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}>
              I
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('strike') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()}>
              S
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('code') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleCode().run()}>
              {'</>'}
            </button>
            <span className="mx-1 h-5 w-px bg-zinc-300" />
            <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              • 列表
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              1. 列表
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              引用
            </button>
            <button type="button" className={`tiptap-btn ${editor.isActive('codeBlock') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
              代码块
            </button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              分割线
            </button>
            <span className="mx-1 h-5 w-px bg-zinc-300" />
            <button
              type="button"
              className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`}
              onClick={() => {
                const url = window.prompt('输入链接 URL');
                if (!url) return;
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
              }}
            >
              链接
            </button>
            <button type="button" className="tiptap-btn" onClick={() => fileRef.current?.click()}>
              添加图片
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleInlineImage(e.target.files?.[0])} />
            <span className="mx-1 h-5 w-px bg-zinc-300" />
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().undo().run()}>
              撤销
            </button>
            <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().redo().run()}>
              重做
            </button>
          </div>

          <div className="min-h-[52vh] bg-white p-4 md:min-h-[68vh]">
            <EditorContent editor={editor} />
          </div>
        </div>

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
            {uploading && <span>图片处理中…</span>}
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

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">发布前预览</h3>
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setPublishPreview((v) => !v)}>
            {publishPreview ? '收起预览' : '展开预览'}
          </button>
        </div>
        {publishPreview && (
          <div className="space-y-3 rounded border border-zinc-200 p-3">
            <h2 className="text-2xl font-bold">{title || '未命名标题'}</h2>
            <p className="text-sm text-zinc-500">{excerpt || '暂无摘要'}</p>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" checked={published} onChange={(e) => setPublished(e.target.checked)} /> 发布
      </label>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <button className="btn w-full md:w-auto" type="submit" disabled={uploading}>
          保存文章
        </button>
      </div>
    </form>
  );
}
