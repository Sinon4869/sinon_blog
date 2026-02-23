'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

import { evaluatePublishChecklist } from '@/lib/publish-checklist';

type TemplateItem = {
  id: string;
  name: string;
  scene: string;
  title: string;
  excerpt: string;
  tags: string;
  content: string;
};

type WriteEditorProps = {
  action: (formData: FormData) => void | Promise<void>;
  templates?: TemplateItem[];
  initialTemplateId?: string;
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
const MAX_SNAPSHOTS = 5;
const SYNC_INTERVAL_MS = 20_000;

type DraftPayload = {
  postId: string;
  title: string;
  excerpt: string;
  tags: string;
  content: string;
  coverImage: string;
  backgroundImage: string;
};

type DraftVersion = {
  id: string;
  createdAt: string;
  title: string;
  excerpt: string;
  tags: string;
  content: string;
  coverImage: string;
  backgroundImage: string;
};

type SyncState = 'idle' | 'syncing' | 'synced' | 'failed';

async function uploadToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.set('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || '上传失败');
  return data.url;
}

function estimateReadingTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return { words, minutes };
}

function normalizePostId(postId?: string) {
  return (postId || 'new').trim() || 'new';
}

export function WriteEditor({ action, post, templates = [], initialTemplateId }: WriteEditorProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [tags, setTags] = useState(post?.tags || '');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [backgroundImage, setBackgroundImage] = useState(post?.backgroundImage || '');
  const [published, setPublished] = useState(!!post?.published);
  const [restored, setRestored] = useState(false);
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [publishPreview, setPublishPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateNotice, setTemplateNotice] = useState(initialTemplateId ? '已套用模板' : '');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncedAt, setSyncedAt] = useState('');
  const [readyToSync, setReadyToSync] = useState(false);
  const [hasUnsyncedChange, setHasUnsyncedChange] = useState(false);

  const postId = normalizePostId(post?.id);
  const draftKey = `${DRAFT_PREFIX}${postId}`;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedRef = useRef('');
  const syncInFlightRef = useRef(false);

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

  const checklist = useMemo(
    () =>
      evaluatePublishChecklist({
        title,
        excerpt,
        tags,
        content,
        coverImage
      }),
    [title, excerpt, tags, content, coverImage]
  );

  function currentPayload(): DraftPayload {
    return {
      postId,
      title,
      excerpt,
      tags,
      content,
      coverImage,
      backgroundImage
    };
  }

  function payloadToString(payload: DraftPayload) {
    return JSON.stringify(payload);
  }

  function saveLocalDraft(payload = currentPayload()) {
    localStorage.setItem(draftKey, JSON.stringify(payload));
  }

  function restoreLocalDraft() {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as Partial<DraftPayload>;
      applyDraft(parsed);
      setHasUnsyncedChange(true);
      setSyncState('idle');
      return true;
    } catch {
      return false;
    }
  }

  function applyDraft(draft: Partial<DraftPayload>) {
    setTitle(draft.title || '');
    setExcerpt(draft.excerpt || '');
    setTags(draft.tags || '');
    setCoverImage(draft.coverImage || '');
    setBackgroundImage(draft.backgroundImage || '');
    if (editor && draft.content) editor.commands.setContent(draft.content);
    setRestored(true);
  }

  function clearLocalDraft() {
    localStorage.removeItem(draftKey);
    setRestored(false);
  }

  async function fetchVersions() {
    const res = await fetch(`/api/write/drafts/versions?postId=${encodeURIComponent(postId)}&limit=${MAX_SNAPSHOTS}`);
    const data = (await res.json().catch(() => ({}))) as { versions?: DraftVersion[] };
    if (!res.ok || !Array.isArray(data.versions)) return;
    setVersions(data.versions);
  }

  async function syncDraft(payload: DraftPayload) {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncState('syncing');
    try {
      const res = await fetch('/api/write/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as { syncedAt?: string };
      if (!res.ok) throw new Error('sync_failed');
      lastSyncedRef.current = payloadToString(payload);
      setHasUnsyncedChange(false);
      setSyncState('synced');
      setSyncedAt(data.syncedAt || '');
      saveLocalDraft(payload);
    } catch {
      setSyncState('failed');
      saveLocalDraft(payload);
    } finally {
      syncInFlightRef.current = false;
    }
  }

  async function saveSnapshot() {
    const payload = currentPayload();
    const res = await fetch('/api/write/drafts/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = (await res.json().catch(() => ({}))) as { versions?: DraftVersion[] };
    if (!res.ok || !Array.isArray(data.versions)) {
      alert('保存快照失败');
      return;
    }
    setVersions(data.versions);
    lastSyncedRef.current = payloadToString(payload);
    setSyncState('synced');
    setSyncedAt(new Date().toISOString());
    setHasUnsyncedChange(false);
    setTemplateNotice('已保存云端快照');
  }

  function restoreVersion(id: string) {
    const found = versions.find((v) => v.id === id);
    if (!found) return;
    applyDraft(found);
    setHasUnsyncedChange(true);
    setSyncState('idle');
    setTemplateNotice('已恢复云端快照');
  }

  function applyTemplate(tpl: TemplateItem) {
    const hasTyped = title.trim() || excerpt.trim() || tags.trim() || plainText.trim();
    if (hasTyped && !window.confirm('套用模板将覆盖当前编辑内容，是否继续？')) return;
    setTitle(tpl.title);
    setExcerpt(tpl.excerpt);
    setTags(tpl.tags);
    if (editor) editor.commands.setContent(marked.parse(tpl.content));
    setHasUnsyncedChange(true);
    setSyncState('idle');
    setTemplateNotice(`已套用模板：${tpl.name}`);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openFullPreview() {
    const payload = {
      id: post?.id,
      title,
      excerpt,
      content: editor?.getHTML() || '',
      tags,
      coverImage,
      backgroundImage
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    window.location.href = `/write/preview?draft=${encodeURIComponent(encoded)}`;
  }

  async function handleInlineImage(file: File | undefined) {
    if (!file || !editor) return;
    setUploading(true);
    try {
      const url = await uploadToR2(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setCoverImage(await uploadToR2(file));
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleBackgroundImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setBackgroundImage(await uploadToR2(file));
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;

    async function bootstrap() {
      try {
        const res = await fetch(`/api/write/drafts?postId=${encodeURIComponent(postId)}`);
        const data = (await res.json().catch(() => ({}))) as {
          draft?: {
            postId: string;
            title: string;
            excerpt: string;
            tags: string;
            content: string;
            coverImage: string;
            backgroundImage: string;
            syncedAt: string;
          } | null;
        };

        if (cancelled) return;
        if (res.ok && data.draft) {
          applyDraft(data.draft);
          lastSyncedRef.current = payloadToString({
            postId,
            title: data.draft.title || '',
            excerpt: data.draft.excerpt || '',
            tags: data.draft.tags || '',
            content: data.draft.content || '',
            coverImage: data.draft.coverImage || '',
            backgroundImage: data.draft.backgroundImage || ''
          });
          setHasUnsyncedChange(false);
          setSyncState('synced');
          setSyncedAt(data.draft.syncedAt || '');
        } else {
          const restoredLocal = restoreLocalDraft();
          if (!restoredLocal) {
            lastSyncedRef.current = payloadToString(currentPayload());
          }
        }
      } catch {
        if (!cancelled) restoreLocalDraft();
      } finally {
        if (!cancelled) {
          setReadyToSync(true);
          void fetchVersions();
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, postId]);

  useEffect(() => {
    if (!readyToSync || !editor) return;
    const now = payloadToString(currentPayload());
    if (!lastSyncedRef.current) {
      lastSyncedRef.current = now;
      return;
    }
    if (now !== lastSyncedRef.current) {
      setHasUnsyncedChange(true);
      if (syncState !== 'syncing') setSyncState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToSync, title, excerpt, tags, coverImage, backgroundImage, content]);

  useEffect(() => {
    if (!readyToSync) return;
    const timer = window.setInterval(() => {
      if (!hasUnsyncedChange) return;
      const payload = currentPayload();
      void syncDraft(payload);
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToSync, hasUnsyncedChange, title, excerpt, tags, coverImage, backgroundImage, content]);

  if (!editor) return null;

  return (
    <form
      action={async (formData) => {
        if (checklist.warnings.length > 0) {
          const warningText = checklist.warnings.map((w) => `- ${w.label}`).join('\n');
          const ok = window.confirm(`发布检查存在提示项：\n${warningText}\n\n仍然继续保存吗？`);
          if (!ok) return;
        }

        formData.set('content', editor.getHTML());
        await action(formData);
        clearLocalDraft();
      }}
      className="space-y-3 pb-24 md:pb-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{post?.id ? '编辑文章' : '新建文章'}</h1>
        <div className="text-xs text-zinc-500">
          同步状态：
          {syncState === 'idle' && '未同步'}
          {syncState === 'syncing' && '同步中...'}
          {syncState === 'synced' && `已同步${syncedAt ? `（${new Date(syncedAt).toLocaleString('zh-CN')}）` : ''}`}
          {syncState === 'failed' && '同步失败（已保留本地草稿）'}
        </div>
      </div>

      {!post?.id && templates.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold">模板中心</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {templates.map((tpl) => (
              <button key={tpl.id} type="button" className="rounded-lg border p-3 text-left hover:bg-zinc-50" onClick={() => applyTemplate(tpl)}>
                <p className="text-sm font-medium">{tpl.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{tpl.scene}</p>
              </button>
            ))}
          </div>
          {templateNotice && <p className="text-xs text-green-700">{templateNotice}</p>}
        </div>
      )}

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

      <div className="card space-y-3" ref={editorRef}>
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
            <button type="button" className="rounded border px-2 py-1" onClick={() => saveLocalDraft()}>
              保存本地草稿
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={saveSnapshot}>
              保存云端快照
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={() => void fetchVersions()}>
              刷新快照
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={clearLocalDraft}>
              清除本地草稿
            </button>
            {uploading && <span>图片处理中...</span>}
          </div>
        </div>

        {versions.length > 0 && (
          <div className="rounded border border-zinc-200 p-2 text-xs">
            <p className="mb-2 font-medium">最近 {Math.min(MAX_SNAPSHOTS, versions.length)} 次云端快照</p>
            <div className="space-y-1">
              {versions.map((v) => (
                <button key={v.id} type="button" className="block w-full rounded border px-2 py-1 text-left hover:bg-zinc-50" onClick={() => restoreVersion(v.id)}>
                  {new Date(v.createdAt).toLocaleString('zh-CN')} · {v.title || '未命名'}
                </button>
              ))}
            </div>
          </div>
        )}

        {restored && <p className="text-xs text-green-600">已恢复草稿内容</p>}
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">发布检查（提示式）</h3>
        <div className="space-y-1 text-sm">
          {checklist.items.map((item) => (
            <p key={item.key} className={item.ok ? 'text-green-700' : 'text-amber-700'}>
              {item.ok ? '通过' : '提示'} · {item.label}
            </p>
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">发布前预览</h3>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setPublishPreview((v) => !v)}>
              {publishPreview ? '收起预览' : '展开预览'}
            </button>
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={openFullPreview}>
              独立预览页
            </button>
          </div>
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
