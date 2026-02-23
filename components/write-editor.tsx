'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
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
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [toolbarDocked, setToolbarDocked] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const backgroundRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const toolbarAnchorRef = useRef<HTMLDivElement | null>(null);

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
        class: 'simple-editor-content'
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
    const el = toolbarAnchorRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setToolbarDocked(!entry.isIntersecting);
      },
      { threshold: 1, rootMargin: '-90px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pinToolbar]);

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
      </details>

      <div ref={toolbarAnchorRef} className="h-px w-full" />
      <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-50/70">
          <div
            className={`${pinToolbar ? 'md:sticky md:top-[86px]' : ''} z-30 border-b border-zinc-200 px-2 py-2 transition-all duration-300 md:px-3 ${
              toolbarDocked
                ? 'bg-[rgba(247,246,242,0.92)] shadow-[0_10px_24px_-16px_rgba(40,40,40,0.45)] backdrop-blur-xl'
                : 'bg-zinc-50/95 backdrop-blur'
            }`}
          >
            <div
              className={`rounded-xl border border-zinc-200 bg-white/86 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all duration-300 ${
                toolbarDocked ? 'md:mx-auto md:max-w-[1100px]' : ''
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs tracking-wide text-zinc-600">编辑器工具栏</p>
                <button
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98]"
                  onClick={() => setPinToolbar((v) => !v)}
                  type="button"
                >
                  {pinToolbar ? '取消吸顶' : '固定到顶部'}
                </button>
              </div>
              <div
                className={`hide-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5 ${
                  toolbarDocked ? 'flex-nowrap' : 'flex-wrap'
                }`}
              >
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
              <ToolButton label="行内代码" active={editor.isActive('code')} onClick={toggleInlineCode} />
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
            </div>
          </div>
          <div className="px-3 pb-2 pt-2">
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
            {editor.isActive('codeBlock') && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2">
                <label className="text-xs text-zinc-600">语言</label>
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                >
                  <option value="plaintext">Plain</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="json">JSON</option>
                  <option value="bash">Bash</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="java">Java</option>
                  <option value="sql">SQL</option>
                  <option value="xml">XML</option>
                  <option value="yaml">YAML</option>
                </select>
                <label className="ml-1 text-xs text-zinc-600">背景色</label>
                <input
                  aria-label="代码块背景色"
                  className="h-7 w-10 rounded border border-zinc-300 bg-white p-0.5"
                  onChange={(e) => setCodeBackground(e.target.value)}
                  type="color"
                  value={codeBackground}
                />
                <button className="tiptap-btn" onClick={applyCodeBlockOptions} type="button">
                  应用代码块样式
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-0 min-h-[58vh] bg-white px-4 py-5 md:px-8 md:py-8">
          <EditorContent editor={editor} />
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
