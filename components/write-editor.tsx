'use client';

import { useMemo, useRef, useState } from 'react';
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
  const [published, setPublished] = useState(!!post?.published);
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const backgroundRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Image, Link.configure({ openOnClick: false })],
    content: post?.content || '<p></p>',
    editorProps: {
      attributes: {
        class: 'simple-editor-content'
      }
    }
  });

  const content = editor?.getHTML() || '';
  const plainText = editor?.getText() || '';
  const stat = useMemo(() => estimateReadingTime(plainText), [plainText]);

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

  if (!editor) return null;

  return (
    <form
      action={async (formData) => {
        formData.set('content', editor.getHTML());
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
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-3 sm:grid sm:grid-cols-[320px_1fr_28px] sm:gap-6">
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
          <div className="hidden items-center justify-center sm:flex">
            <div className="space-y-3">
              <div className="h-12 w-3 rounded-full bg-emerald-500" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-3 w-3 rounded-full bg-zinc-300" />
              ))}
            </div>
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
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-3 py-2">
          <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().undo().run()} aria-label="undo">
            ↶
          </button>
          <button type="button" className="tiptap-btn" onClick={() => editor.chain().focus().redo().run()} aria-label="redo">
            ↷
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200" />

          <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            H1
          </button>
          <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </button>
          <button type="button" className={`tiptap-btn ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            H3
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200" />

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
          <span className="mx-1 h-5 w-px bg-zinc-200" />

          <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            •
          </button>
          <button type="button" className={`tiptap-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            1.
          </button>
          <button type="button" className={`tiptap-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            Quote
          </button>
          <button type="button" className={`tiptap-btn ${editor.isActive('codeBlock') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            {'{ }'}
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200" />

          <button
            type="button"
            className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`}
            onClick={() => {
              const url = window.prompt('输入链接 URL');
              if (!url) return;
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }}
          >
            Link
          </button>
          <button type="button" className="tiptap-btn" onClick={() => fileRef.current?.click()}>
            Add
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleInlineImage(e.target.files?.[0])} />
        </div>

        <div className="min-h-[58vh] bg-white px-4 py-5 md:px-8 md:py-8">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          字数：{stat.words} · 预计阅读 {stat.minutes} 分钟
        </span>
        <span>{uploading ? '图片上传中...' : ''}</span>
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
