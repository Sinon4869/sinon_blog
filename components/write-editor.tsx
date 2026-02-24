'use client';

import { SmartImage } from '@/components/smart-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { createLowlight, common } from 'lowlight';
import { marked } from 'marked';
import { AppModal } from '@/components/app-modal';
// toolbar removed in notion-only mode

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

type SlashCommand = {
  key: string;
  label: string;
  keywords: string[];
  run: () => void;
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

const lowlight = createLowlight(common);
const CodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      backgroundColor: {
        default: '#151920',
        parseHTML: (element) => element.getAttribute('data-bg') || '#151920',
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            'data-bg': attributes.backgroundColor,
            style: `background-color:${attributes.backgroundColor};`
          };
        }
      }
    };
  }
}).configure({ lowlight });

export function WriteEditor({ action, post }: WriteEditorProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [tags, setTags] = useState(post?.tags || '');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [backgroundImage, setBackgroundImage] = useState(post?.backgroundImage || '');
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState(() => estimateReadingTime(''));
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('plaintext');
  const [codeBackground, setCodeBackground] = useState('#151920');
  const [pinToolbar, setPinToolbar] = useState(true);
  const editorMode = 'notion' as const;
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [toolbarDocked, setToolbarDocked] = useState(false);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [toolbarLeft, setToolbarLeft] = useState(0);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashFrom, setSlashFrom] = useState<number | null>(null);
  const [slashTo, setSlashTo] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const backgroundRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const toolbarAnchorRef = useRef<HTMLDivElement | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image,
      Link.configure({ openOnClick: false }),
      CodeBlock,
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
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `simple-editor-content ${editorMode === 'notion' ? 'notion-like-content' : ''}`
      },
      handleDOMEvents: {
        paste: (_view, event) => {
          const e = event as ClipboardEvent;
          const files = Array.from(e.clipboardData?.files || []);
          const image = files.find((f) => f.type.startsWith('image/'));
          if (!image) return false;

          e.preventDefault();
          setUploading(true);
          uploadToR2(image)
            .then((url) => {
              editor?.chain().focus().setImage({ src: url, alt: image.name || 'pasted-image' }).run();
            })
            .catch((err) => {
              setFeedback(err instanceof Error ? err.message : '粘贴图片上传失败');
            })
            .finally(() => setUploading(false));
          return true;
        },
        drop: (_view, event) => {
          const e = event as DragEvent;
          const files = Array.from(e.dataTransfer?.files || []);
          const image = files.find((f) => f.type.startsWith('image/'));
          if (!image) return false;
          e.preventDefault();
          setUploading(true);
          uploadToR2(image)
            .then((url) => {
              editor?.chain().focus().setImage({ src: url, alt: image.name || 'dropped-image' }).run();
            })
            .catch((err) => {
              setFeedback(err instanceof Error ? err.message : '拖拽图片上传失败');
            })
            .finally(() => setUploading(false));
          return true;
        }
      }
    }
  });

  useEffect(() => {
    if (!editor) return;
    const syncStats = () => setStats(estimateReadingTime(editor.getText() || ''));
    syncStats();
    editor.on('blur', syncStats);
    return () => {
      editor.off('blur', syncStats);
    };
  }, [editor]);

  useEffect(() => {
    if (!pinToolbar) {
      setToolbarDocked(false);
      return;
    }
    const anchorEl = toolbarAnchorRef.current;
    const shellEl = editorShellRef.current;
    if (!anchorEl || !shellEl) return;

    const TOP_OFFSET = 92;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const anchorRect = anchorEl.getBoundingClientRect();
      const shellRect = shellEl.getBoundingClientRect();
      const anchorY = anchorRect.top + scrollY;
      const shellBottomY = shellRect.bottom + scrollY;
      const startY = anchorY - TOP_OFFSET;
      const endY = shellBottomY - TOP_OFFSET - Math.max(toolbarHeight, 56) - 8;
      const shouldDock = scrollY >= startY && scrollY <= endY;
      setToolbarDocked(shouldDock);
      if (shouldDock) {
        setToolbarLeft(shellRect.left);
        setToolbarWidth(shellRect.width);
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pinToolbar, toolbarHeight]);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const update = () => setToolbarHeight(el.getBoundingClientRect().height);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [toolbarDocked]);

  useEffect(() => {
    if (!editor) return;
    const syncCodeAttrs = () => {
      if (!editor.isActive('codeBlock')) return;
      const attrs = editor.getAttributes('codeBlock') as { language?: string; backgroundColor?: string };
      setCodeLanguage(attrs.language || 'plaintext');
      setCodeBackground(attrs.backgroundColor || '#151920');
    };
    syncCodeAttrs();
    editor.on('selectionUpdate', syncCodeAttrs);
    editor.on('transaction', syncCodeAttrs);
    return () => {
      editor.off('selectionUpdate', syncCodeAttrs);
      editor.off('transaction', syncCodeAttrs);
    };
  }, [editor]);

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
    setLinkValue(prev);
    setShowLinkModal(true);
  }

  function insertCodeBlock() {
    if (!editor) return;
    if (editor.isActive('codeBlock')) {
      editor.chain().focus().toggleCodeBlock().run();
      return;
    }
    editor
      .chain()
      .focus()
      .setCodeBlock({ language: codeLanguage })
      .updateAttributes('codeBlock', { backgroundColor: codeBackground })
      .insertContent('// 在这里输入代码')
      .run();
  }

  function applyCodeBlockOptions() {
    if (!editor || !editor.isActive('codeBlock')) return;
    editor.chain().focus().updateAttributes('codeBlock', { language: codeLanguage, backgroundColor: codeBackground }).run();
  }

  function toggleInlineCode() {
    if (!editor) return;
    if (editor.isActive('codeBlock')) return;
    editor.chain().focus().toggleCode().run();
  }

  async function saveDraftWithConfirm() {
    if (!formRef.current || !editor) return;
    setSaving(true);
    setFeedback('');
    try {
      const formData = new FormData(formRef.current);
      formData.set('content', editor.getHTML());
      formData.set('coverImage', coverImage);
      formData.set('backgroundImage', backgroundImage);
      formData.set('published', 'off');
      await action(formData);
      setFeedback('草稿已保存');
    } catch {
      setFeedback('保存失败，请重试');
    } finally {
      setSaving(false);
    }
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

  const removeSlashTrigger = () => {
    if (!editor || slashFrom == null || slashTo == null) return;
    editor.chain().focus().deleteRange({ from: slashFrom, to: slashTo }).run();
    setSlashOpen(false);
    setSlashQuery('');
    setSlashIndex(0);
    setSlashFrom(null);
    setSlashTo(null);
  };

  const slashCommands: SlashCommand[] = useMemo(() => {
    if (!editor) return [];
    return [
      { key: 'text', label: 'Text', keywords: ['文本', 'paragraph'], run: () => editor.chain().focus().setParagraph().run() },
      { key: 'h1', label: 'Heading 1', keywords: ['标题', 'h1'], run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
      { key: 'h2', label: 'Heading 2', keywords: ['标题', 'h2'], run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
      { key: 'h3', label: 'Heading 3', keywords: ['标题', 'h3'], run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
      { key: 'bullet', label: 'Bullet List', keywords: ['列表', 'bullet'], run: () => editor.chain().focus().toggleBulletList().run() },
      { key: 'number', label: 'Numbered List', keywords: ['编号', 'ordered'], run: () => editor.chain().focus().toggleOrderedList().run() },
      { key: 'task', label: 'To-do List', keywords: ['任务', 'todo'], run: () => editor.chain().focus().toggleTaskList().run() },
      { key: 'quote', label: 'Quote', keywords: ['引用'], run: () => editor.chain().focus().toggleBlockquote().run() },
      { key: 'code', label: 'Code Block', keywords: ['代码'], run: () => insertCodeBlock() },
      { key: 'image', label: 'Image Upload', keywords: ['图片', 'image'], run: () => fileRef.current?.click() }
    ];
  }, [editor, slashFrom, slashTo]);

  const filteredSlash = useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.toLowerCase().includes(q)));
  }, [slashCommands, slashQuery]);

  useEffect(() => {
    if (!editor || editorMode !== 'notion') return;

    const detectSlash = () => {
      const { from } = editor.state.selection;
      const $from = editor.state.selection.$from;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      const idx = textBefore.lastIndexOf('/');
      if (idx < 0) {
        setSlashOpen(false);
        return;
      }
      const query = textBefore.slice(idx + 1);
      if (/\s/.test(query)) {
        setSlashOpen(false);
        return;
      }
      setSlashOpen(true);
      setSlashQuery(query);
      setSlashFrom($from.start() + idx);
      setSlashTo(from);
      setSlashIndex(0);
    };

    detectSlash();
    editor.on('selectionUpdate', detectSlash);
    editor.on('update', detectSlash);
    editor.on('transaction', detectSlash);
    return () => {
      editor.off('selectionUpdate', detectSlash);
      editor.off('update', detectSlash);
      editor.off('transaction', detectSlash);
    };
  }, [editor, editorMode, slashOpen, filteredSlash, slashIndex]);

  useEffect(() => {
    if (!slashOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashIndex((v) => (filteredSlash.length ? (v + 1) % filteredSlash.length : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashIndex((v) => (filteredSlash.length ? (v - 1 + filteredSlash.length) % filteredSlash.length : 0));
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSlashOpen(false);
      } else if (event.key === 'Enter' && filteredSlash[slashIndex]) {
        event.preventDefault();
        removeSlashTrigger();
        filteredSlash[slashIndex].run();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [slashOpen, filteredSlash, slashIndex]);

  if (!editor) return null;

  return (
    <>
    <form ref={formRef} className="space-y-5 pb-24 md:pb-0">
      <input type="hidden" name="id" value={post?.id || ''} />
      <input type="hidden" name="content" value="" />
      <input type="hidden" name="coverImage" value={coverImage} />
      <input type="hidden" name="backgroundImage" value={backgroundImage} />

      <div className="card space-y-3">
        <input className="input text-lg font-semibold" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文章标题" required />
        <input className="input" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="一句话摘要（可选）" />
        <input className="input" name="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签，逗号分隔（可选）" />
      </div>

      <details className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-zinc-700">封面与背景图设置</summary>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-3 sm:grid sm:grid-cols-[320px_1fr] sm:gap-6">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <SmartImage src={coverImage} alt="cover-preview" width={1200} height={560} className="h-56 w-full rounded-lg object-cover sm:h-[260px]" />
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
            <SmartImage src={backgroundImage} alt="background-preview" width={1200} height={420} className="h-40 w-full object-cover opacity-70 sm:h-52" />
          ) : (
            <div className="h-40 w-full bg-zinc-800 sm:h-52" />
          )}
          <div className="-mt-20 p-4 text-white sm:-mt-24 sm:p-6">
            <p className="text-xs text-zinc-200">{todayLabel()}</p>
            <p className="mt-1 text-xl font-semibold sm:text-3xl">{title || '这里显示文章头图预览'}</p>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2">
        <span className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">Notion-like Editor</span>
        <span className="text-xs text-zinc-500">已启用：Slash 命令 / 粘贴与拖拽图片上传 / TipTap 菜单</span>
      </div>

      <div ref={toolbarAnchorRef} className="h-px w-full" />
      <div ref={editorShellRef} className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="relative z-0 min-h-[58vh] bg-white px-4 py-5 md:px-8 md:py-8">
          {editorMode === 'notion' && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                onClick={() => {
                  setSlashOpen(true);
                  setSlashQuery('');
                  setSlashIndex(0);
                }}
              >
                + 插入块
              </button>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                onClick={() => editor.chain().focus().deleteSelection().run()}
              >
                删除当前选择
              </button>
            </div>
          )}

          <EditorContent editor={editor} />

          <FloatingMenu editor={editor} className="rounded-lg border border-zinc-200 bg-white p-1 shadow">
            <div className="flex flex-wrap gap-1">
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => editor.chain().focus().toggleBulletList().run()}>List</button>
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => insertCodeBlock()}>Code</button>
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => fileRef.current?.click()}>Image</button>
            </div>
          </FloatingMenu>

          <BubbleMenu editor={editor} className="rounded-lg border border-zinc-200 bg-white p-1 shadow">
            <div className="flex gap-1">
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
              <button type="button" className="rounded px-2 py-1 text-xs hover:bg-zinc-100" onClick={addOrEditLink}>Link</button>
            </div>
          </BubbleMenu>

          {slashOpen && (
            <div className="absolute left-4 top-16 z-20 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg md:left-8">
              <input
                value={slashQuery}
                onChange={(e) => {
                  setSlashQuery(e.target.value);
                  setSlashIndex(0);
                }}
                placeholder="/ 输入命令"
                className="mb-2 w-full rounded-md border border-zinc-200 px-2 py-1 text-sm"
              />
              <div className="max-h-72 overflow-auto">
                {filteredSlash.length === 0 && <p className="px-2 py-1 text-xs text-zinc-500">无匹配命令</p>}
                {filteredSlash.map((cmd, idx) => (
                  <button
                    key={cmd.key}
                    type="button"
                    className={`block w-full rounded px-2 py-1.5 text-left text-sm ${idx === slashIndex ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100'}`}
                    onClick={() => {
                      removeSlashTrigger();
                      cmd.run();
                    }}
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          字数：{stats.words} · 预计阅读 {stats.minutes} 分钟
        </span>
        <span>{uploading ? '图片上传中...' : saving ? '保存中...' : feedback}</span>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            className="rounded-md border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            type="button"
            disabled={uploading || saving}
            onClick={() => setShowSaveConfirm(true)}
          >
            {saving ? '保存中...' : '保存草稿'}
          </button>
          <button className="btn" type="button" disabled={uploading || saving} onClick={openPublishPreview}>
            发布文章
          </button>
        </div>
      </div>
    </form>
    <AppModal
      open={showSaveConfirm}
      title="确认保存草稿"
      description={post?.id ? '将覆盖当前草稿内容。' : '将创建新的草稿内容。'}
      onCancel={() => setShowSaveConfirm(false)}
      onConfirm={async () => {
        setShowSaveConfirm(false);
        await saveDraftWithConfirm();
      }}
      confirmText="确认保存"
    >
      <p className="text-sm text-zinc-600">当前编辑内容会保存到草稿，之后可继续编辑或发布。</p>
    </AppModal>
    <AppModal
      open={showLinkModal}
      title="插入链接"
      description="请输入完整 URL（例如 https://example.com）"
      onCancel={() => setShowLinkModal(false)}
      onConfirm={() => {
        if (!editor) return;
        const url = linkValue.trim();
        if (!url) {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
          setShowLinkModal(false);
          return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        setShowLinkModal(false);
      }}
      confirmText="应用链接"
    >
      <label className="mb-1 block text-sm text-zinc-600">链接 URL</label>
      <input className="input" value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://..." />
    </AppModal>
    </>
  );
}
