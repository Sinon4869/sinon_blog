'use client';

import { useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { marked } from 'marked';

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

function looksLikeHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function normalizeEditorContent(raw?: string) {
  const value = raw || '';
  if (!value.trim()) return '<p></p>';
  if (looksLikeHtml(value)) return value;
  return marked.parse(value, { gfm: true, breaks: true, async: false }) as string;
}

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

function ToolButton({
  label,
  active,
  onClick,
  type = 'button'
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button type={type} className={`tiptap-btn ${active ? 'is-active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function WriteEditor({ action, post }: WriteEditorProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [tags, setTags] = useState(post?.tags || '');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [backgroundImage, setBackgroundImage] = useState(post?.backgroundImage || '');
  const [uploading, setUploading] = useState(false);
  const [content, setContent] = useState(post?.content || '');

  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const backgroundRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] })
    ],
    content: normalizeEditorContent(post?.content),
    editorProps: {
      attributes: {
        class: 'simple-editor-content'
      }
    },
    onUpdate({ editor: e }) {
      setContent(e.getHTML());
    },
    onCreate({ editor: e }) {
      setContent(e.getHTML());
    }
  });

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

  function addOrEditLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('输入链接 URL', prev);
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function insertCodeBlock() {
    if (!editor) return;
    if (editor.isActive('codeBlock')) {
      editor.chain().focus().toggleCodeBlock().run();
      return;
    }
    editor.chain().focus().setCodeBlock().insertContent('// 在这里输入代码').run();
  }

  function openPublishPreview() {
    const titleValue = title.trim();
    const contentValue = editor?.getHTML() || '';
    if (!titleValue || !contentValue || contentValue === '<p></p>') {
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

  if (!editor) return null;

  return (
    <form
      action={async (formData) => {
        const submitAction = String(formData.get('submitAction') || 'draft');
        if (submitAction !== 'draft') return;
        const saveOk = window.confirm(post?.id ? '确认保存草稿修改？' : '确认保存为草稿？');
        if (!saveOk) return;
        formData.set('content', editor.getHTML());
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
        <div className="space-y-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            <ToolButton label="↶" onClick={() => editor.chain().focus().undo().run()} />
            <ToolButton label="↷" onClick={() => editor.chain().focus().redo().run()} />
            <span className="mx-1 h-5 w-px bg-zinc-200" />

            <ToolButton label="H1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
            <ToolButton label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
            <ToolButton label="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
            <span className="mx-1 h-5 w-px bg-zinc-200" />

            <ToolButton label="B" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
            <ToolButton label="I" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
            <ToolButton label="U" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
            <ToolButton label="S" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
            <ToolButton label="Mark" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} />
            <ToolButton label="行内代码" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />
            <ToolButton label="代码块" active={editor.isActive('codeBlock')} onClick={insertCodeBlock} />
            <span className="mx-1 h-5 w-px bg-zinc-200" />

            <ToolButton label="列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
            <ToolButton label="编号" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
            <ToolButton label="任务" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
            <ToolButton label="引用" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
            <ToolButton label="分割线" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
            <span className="mx-1 h-5 w-px bg-zinc-200" />

            <ToolButton label="链接" active={editor.isActive('link')} onClick={addOrEditLink} />
            <ToolButton label="图片" onClick={() => fileRef.current?.click()} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleInlineImage(e.target.files?.[0])} />
          </div>

          <details className="rounded-md border border-zinc-200 bg-white px-2 py-1">
            <summary className="cursor-pointer select-none text-xs text-zinc-600">高级功能</summary>
            <div className="mt-2 flex flex-wrap items-center gap-1 pb-1">
              <ToolButton label="取消链接" onClick={() => editor.chain().focus().unsetLink().run()} />
              <ToolButton label="表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
              <ToolButton label="+行" onClick={() => editor.chain().focus().addRowAfter().run()} />
              <ToolButton label="+列" onClick={() => editor.chain().focus().addColumnAfter().run()} />
              <ToolButton label="删行" onClick={() => editor.chain().focus().deleteRow().run()} />
              <ToolButton label="删列" onClick={() => editor.chain().focus().deleteColumn().run()} />
              <ToolButton label="删除表格" onClick={() => editor.chain().focus().deleteTable().run()} />
              <span className="mx-1 h-5 w-px bg-zinc-200" />
              <ToolButton label="左对齐" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
              <ToolButton label="居中" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
              <ToolButton label="右对齐" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
              <ToolButton label="清除格式" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
            </div>
          </details>
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

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            className="rounded-md border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            type="submit"
            name="submitAction"
            value="draft"
            disabled={uploading}
          >
            保存草稿
          </button>
          <button className="btn" type="button" disabled={uploading} onClick={openPublishPreview}>
            发布文章
          </button>
        </div>
      </div>
    </form>
  );
}

