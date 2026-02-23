'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CherryInstance = {
  getMarkdown: () => string;
  setValue: (value: string, keepCursor?: boolean) => void;
  destroy: () => void;
};

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

async function uploadToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.set('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || '上传失败');
  return data.url;
}

function normalizeMarkdownForCount(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/[#>*_\-\[\]()`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateReadingTime(markdown: string) {
  const plain = normalizeMarkdownForCount(markdown);
  const words = plain ? plain.split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / 220));
  return { words, minutes };
}

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WriteEditor({ action, post }: WriteEditorProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [tags, setTags] = useState(post?.tags || '');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [backgroundImage, setBackgroundImage] = useState(post?.backgroundImage || '');
  const [uploading, setUploading] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [content, setContent] = useState(post?.content || '');

  const cherryRef = useRef<CherryInstance | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const backgroundRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const mod = await import('cherry-markdown');
      if (!mounted || !editorHostRef.current) return;
      const Cherry = mod.default;
      const initialValue = post?.content || '';

      const fileUpload = async (file: File, callback: (url: string, params?: { name?: string }) => void) => {
        try {
          const url = await uploadToR2(file);
          callback(url, { name: file.name });
        } catch (e) {
          alert(e instanceof Error ? e.message : '上传失败');
        }
      };

      const cherry = new Cherry({
        el: editorHostRef.current,
        value: initialValue,
        locale: 'zh_CN',
        fileUpload,
        callback: {
          fileUpload,
          afterChange: (cherryInstance: CherryInstance) => {
            setContent(cherryInstance.getMarkdown());
          },
          afterInit: (cherryInstance: CherryInstance) => {
            setContent(cherryInstance.getMarkdown());
          }
        }
      }) as CherryInstance;

      cherryRef.current = cherry;
      setEditorReady(true);
    })();

    return () => {
      mounted = false;
      cherryRef.current?.destroy();
      cherryRef.current = null;
      setEditorReady(false);
    };
  }, [post?.content]);

  const stat = useMemo(() => estimateReadingTime(content), [content]);

  async function handleCoverImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToR2(file);
      setCoverImage(url);
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
      const url = await uploadToR2(file);
      setBackgroundImage(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  function openPublishPreview() {
    const titleValue = title.trim();
    const contentValue = cherryRef.current?.getMarkdown() || '';
    if (!titleValue || !contentValue.trim()) {
      alert('请先填写标题与正文内容');
      return;
    }

    const payload = {
      id: post?.id,
      title: titleValue,
      excerpt: excerpt.trim(),
      content: contentValue,
      tags: tags.trim(),
      coverImage: coverImage.trim(),
      backgroundImage: backgroundImage.trim()
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    window.location.href = `/write/preview?draft=${encodeURIComponent(encoded)}`;
  }

  return (
    <form
      action={async (formData) => {
        const submitAction = String(formData.get('submitAction') || 'draft');
        if (submitAction !== 'draft') return;
        const saveOk = window.confirm(post?.id ? '确认保存草稿修改？' : '确认保存为草稿？');
        if (!saveOk) return;
        formData.set('content', cherryRef.current?.getMarkdown() || '');
        formData.set('published', 'off');
        await action(formData);
      }}
      className="space-y-4 pb-24 md:pb-0"
    >
      <input type="hidden" name="id" value={post?.id || ''} />
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="coverImage" value={coverImage} />
      <input type="hidden" name="backgroundImage" value={backgroundImage} />

      <div className="card space-y-3">
        <input className="input text-lg font-semibold" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文章标题" required />
        <input className="input" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="一句话摘要（可选）" />
        <input className="input" name="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，逗号分隔（可选）" />
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-4">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-3 sm:grid sm:grid-cols-[320px_1fr] sm:gap-6">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="cover-preview" className="h-56 w-full rounded-lg object-cover sm:h-[260px]" />
          ) : (
            <div className="h-56 w-full rounded-lg bg-zinc-200 sm:h-[260px]" />
          )}
          <div className="space-y-3 py-2">
            <p className="text-sm text-zinc-500">{todayLabel()}</p>
            <p className="text-3xl font-bold text-zinc-700 sm:text-4xl">{title || '这里显示标题预览'}</p>
            <p className="text-xl text-zinc-600">{excerpt || '这里显示摘要预览'}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-sm font-medium text-zinc-700">封面图（列表卡片）</p>
            <input className="input" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." />
            <button type="button" className="tiptap-btn" onClick={() => coverRef.current?.click()}>
              上传封面图
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverImage(e.target.files?.[0])} />
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-sm font-medium text-zinc-700">背景图（文章头图）</p>
            <input className="input" value={backgroundImage} onChange={(e) => setBackgroundImage(e.target.value)} placeholder="https://..." />
            <button type="button" className="tiptap-btn" onClick={() => backgroundRef.current?.click()}>
              上传背景图
            </button>
            <input ref={backgroundRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleBackgroundImage(e.target.files?.[0])} />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900">
          {backgroundImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backgroundImage} alt="background-preview" className="h-40 w-full object-cover opacity-70 sm:h-52" />
          ) : (
            <div className="h-40 w-full bg-zinc-800 sm:h-52" />
          )}
          <div className="-mt-20 p-4 text-white sm:-mt-24 sm:p-6">
            <p className="text-xs text-zinc-200">{todayLabel()}</p>
            <p className="mt-1 text-xl font-semibold sm:text-3xl">{title || '这里显示文章头图预览'}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-2 text-sm text-zinc-500">Cherry Markdown 完整版编辑器</div>
        <div className="cherry-host min-h-[58vh] bg-white px-2 py-2 md:px-3 md:py-3">
          <div ref={editorHostRef} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          字数：{stat.words} · 预计阅读 {stat.minutes} 分钟
        </span>
        <span>{uploading ? '图片上传中...' : editorReady ? '编辑器已就绪' : '编辑器加载中...'}</span>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            className="rounded-md border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            type="submit"
            name="submitAction"
            value="draft"
            disabled={uploading || !editorReady}
          >
            保存草稿
          </button>
          <button className="btn" type="button" disabled={uploading || !editorReady} onClick={openPublishPreview}>
            发布文章
          </button>
        </div>
      </div>
    </form>
  );
}

