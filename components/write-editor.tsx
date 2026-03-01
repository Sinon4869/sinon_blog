'use client';

import { SmartImage } from '@/components/smart-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/core/style.css';
import '@blocknote/mantine/style.css';
import { marked } from 'marked';
import { AppModal } from '@/components/app-modal';

type WriteEditorProps = {
  action: (formData: FormData) => void | Promise<void | { id?: string }>;
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
  availableCategories?: string[];
};

type EditorInsertCap = {
  document: Array<{ id: string }>;
  insertBlocks?: (blocks: Array<{ type: string; props?: Record<string, unknown>; content?: string }>, referenceId: string, placement: 'before' | 'after') => void;
};

const CODE_LANG_OPTIONS = [
  'text',
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'python',
  'go',
  'rust',
  'java',
  'kotlin',
  'swift',
  'bash',
  'json',
  'yaml',
  'sql',
  'html',
  'css',
  'markdown'
];

function looksLikeHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function normalizeEditorContent(raw?: string) {
  const value = raw || '';
  if (!value.trim()) return '';
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

function hasMeaningfulHtmlContent(input: string) {
  const plain = input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length > 0) return true;
  return /<(img|video|audio|iframe|table|hr)\b/i.test(input);
}

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WriteEditor({ action, post, availableCategories = [] }: WriteEditorProps) {
  const [currentPostId, setCurrentPostId] = useState(post?.id || '');
  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const initialSelected = (post?.tags || '')
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialSelected);
  const [categoryToAdd, setCategoryToAdd] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [coverImage, setCoverImage] = useState(post?.coverImage || '');
  const [backgroundImage, setBackgroundImage] = useState(post?.backgroundImage || '');
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState(() => estimateReadingTime(''));
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [dirty, setDirty] = useState(false);
  const [codeLang, setCodeLang] = useState('typescript');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('write_editor_code_lang') || '';
      if (saved && CODE_LANG_OPTIONS.includes(saved)) {
        setCodeLang(saved);
      }
    } catch {
      // ignore storage read errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('write_editor_code_lang', codeLang);
    } catch {
      // ignore storage write errors
    }
  }, [codeLang]);

  const normalizedOptions = Array.from(new Set([...(availableCategories || []).map((v) => v.trim()).filter(Boolean), ...selectedCategories]));
  const filteredOptions = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((n) => n.toLowerCase().includes(q));
  }, [normalizedOptions, categoryQuery]);
  const tags = selectedCategories.join(',');

  const coverRef = useRef<HTMLInputElement | null>(null);
  const backgroundRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const editorWrapRef = useRef<HTMLDivElement | null>(null);
  const bootstrappedRef = useRef(false);
  const initialSnapshotRef = useRef('');
  const savingLockRef = useRef(false);

  const editor = useCreateBlockNote({
    uploadFile: async (file) => {
      setUploading(true);
      setFeedback('图片上传中...');
      try {
        const url = await uploadToR2(file);
        return url;
      } finally {
        setUploading(false);
        setFeedback('');
      }
    }
  });

  useEffect(() => {
    if (!editor || bootstrappedRef.current) return;
    const html = normalizeEditorContent(post?.content);
    if (html) {
      const parsed = editor.tryParseHTMLToBlocks(html);
      if (parsed.length) {
        const oldIds = editor.document.map((b) => b.id);
        editor.replaceBlocks(oldIds, parsed);
      }
    }
    const nextHtml = editor.blocksToHTMLLossy(editor.document);
    const md = editor.blocksToMarkdownLossy(editor.document);
    setContentHtml(nextHtml);
    setStats(estimateReadingTime(md));
    initialSnapshotRef.current = JSON.stringify({
      title: post?.title || '',
      excerpt: post?.excerpt || '',
      tags: (post?.tags || '').split(',').map((i) => i.trim()).filter(Boolean),
      coverImage: post?.coverImage || '',
      backgroundImage: post?.backgroundImage || '',
      contentHtml: nextHtml
    });
    setDirty(false);
    bootstrappedRef.current = true;
  }, [editor, post?.content, post?.coverImage, post?.backgroundImage, post?.excerpt, post?.tags, post?.title]);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    const current = JSON.stringify({ title, excerpt, tags: selectedCategories, coverImage, backgroundImage, contentHtml });
    setDirty(current !== initialSnapshotRef.current);
  }, [title, excerpt, selectedCategories, coverImage, backgroundImage, contentHtml]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowSaveConfirm(true);
      }
      if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        openPublishPreview();
      }
      if (e.key === 'Escape') setShowSaveConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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

  async function saveDraftWithConfirm() {
    if (!formRef.current || saving || savingLockRef.current) return;
    savingLockRef.current = true;
    setSaving(true);
    setSaveState('saving');
    setFeedback('');
    try {
      const formData = new FormData(formRef.current);
      formData.set('content', contentHtml);
      formData.set('coverImage', coverImage);
      formData.set('backgroundImage', backgroundImage);
      formData.set('published', 'off');
      const result = await action(formData);
      const savedId = (result && typeof result === 'object' && 'id' in result ? String((result as { id?: string }).id || '') : '') || currentPostId;
      if (savedId && savedId !== currentPostId) {
        setCurrentPostId(savedId);
        window.history.replaceState(null, '', `/write?id=${savedId}`);
      }
      setSaveState('saved');
      const now = new Date();
      setLastSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setFeedback('草稿已保存');
      initialSnapshotRef.current = JSON.stringify({ title, excerpt, tags: selectedCategories, coverImage, backgroundImage, contentHtml });
      setDirty(false);
    } catch {
      setSaveState('error');
      setFeedback('保存失败，请重试');
    } finally {
      setSaving(false);
      savingLockRef.current = false;
    }
  }

  function addSelectedCategory() {
    const value = categoryToAdd.trim();
    if (!value) return;
    setSelectedCategories((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCategoryToAdd('');
  }

  function removeCategory(name: string) {
    setSelectedCategories((prev) => prev.filter((v) => v !== name));
  }

  function moveCategory(name: string, direction: -1 | 1) {
    setSelectedCategories((prev) => {
      const idx = prev.indexOf(name);
      if (idx < 0) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  function useFirstImageAsCover() {
    const match = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (!match?.[1]) {
      setFeedback('正文中未找到图片');
      return;
    }
    setCoverImage(match[1]);
    setFeedback('已使用正文首图作为封面');
  }

  function addCustomCategory() {
    const value = newCategory.trim();
    if (!value) return;
    setSelectedCategories((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setNewCategory('');
  }

  function focusEditorSoon() {
    requestAnimationFrame(() => {
      const root = editorWrapRef.current;
      const input = root?.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (input) {
        input.focus();
        input.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  async function insertCodeBlockTemplate() {
    const template = `\n\n\`\`\`${codeLang}\n// your code here\n\`\`\`\n`;
    const cap = editor as unknown as EditorInsertCap;
    const tail = cap.document?.[cap.document.length - 1]?.id;
    if (tail && typeof cap.insertBlocks === 'function') {
      cap.insertBlocks([{ type: 'paragraph', content: template }], tail, 'after');
      setFeedback(`已插入 ${codeLang} 代码模板`);
      focusEditorSoon();
      return;
    }

    try {
      await navigator.clipboard.writeText(template);
      setFeedback('已复制代码模板，直接粘贴到编辑器即可');
      focusEditorSoon();
    } catch {
      setFeedback('插入失败，请手动输入代码块');
    }
  }

  function openPublishPreview() {
    const titleValue = title.trim();
    if (!titleValue || !hasMeaningfulHtmlContent(contentHtml)) {
      alert('请先填写标题与正文内容');
      return;
    }

    const payload = {
      id: currentPostId || undefined,
      title: titleValue,
      excerpt: excerpt.trim(),
      content: contentHtml,
      tags: tags.trim(),
      coverImage: coverImage.trim(),
      backgroundImage: backgroundImage.trim()
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    window.location.href = `/write/preview?draft=${encodeURIComponent(encoded)}`;
  }

  return (
    <>
      <form ref={formRef} className="space-y-5 pb-24 md:pb-0">
        <input type="hidden" name="id" value={currentPostId} />
        <input type="hidden" name="content" value={contentHtml} />
        <input type="hidden" name="coverImage" value={coverImage} />
        <input type="hidden" name="backgroundImage" value={backgroundImage} />

        <div className="card space-y-3">
          <input className="input text-lg font-semibold" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文章标题" required />
          <input className="input" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="一句话摘要（可选）" />
          <input type="hidden" name="tags" value={tags} />

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700">分类（下拉选择）</p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input" value={categoryQuery} onChange={(e) => setCategoryQuery(e.target.value)} placeholder="搜索分类..." />
              <select className="input" value={categoryToAdd} onChange={(e) => setCategoryToAdd(e.target.value)}>
                <option value="">请选择分类</option>
                {filteredOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                onClick={addSelectedCategory}
              >
                添加到文章
              </button>
            </div>

            <div className="space-y-2">
              {selectedCategories.length === 0 && <span className="text-xs text-zinc-500">尚未选择分类</span>}
              {selectedCategories.map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="rounded-full border border-[var(--bg-ink)] bg-[var(--bg-ink)] px-3 py-1 text-xs tracking-wide text-white">#{name}</span>
                  <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => moveCategory(name, -1)}>
                    ↑
                  </button>
                  <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => moveCategory(name, 1)}>
                    ↓
                  </button>
                  <button type="button" className="rounded border px-2 py-0.5 text-xs text-red-700" onClick={() => removeCategory(name)}>
                    移除
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="没有合适分类？新增一个"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomCategory();
                  }
                }}
              />
              <button
                type="button"
                className="rounded-md border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                onClick={addCustomCategory}
              >
                新增并选中
              </button>
            </div>
          </div>
        </div>

        <details className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-zinc-700">封面与背景图设置</summary>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-3 sm:grid sm:grid-cols-[320px_1fr] sm:gap-6">
            {coverImage ? (
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
              <p className="text-xs text-zinc-500">建议比例 16:9（例如 1200x675）</p>
              <input className="input" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  onClick={() => coverRef.current?.click()}
                >
                  上传封面图
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  onClick={useFirstImageAsCover}
                >
                  使用正文首图
                </button>
              </div>
              <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverImage(e.target.files?.[0])} />
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-sm font-medium text-zinc-700">背景图（文章头图）</p>
              <input className="input" value={backgroundImage} onChange={(e) => setBackgroundImage(e.target.value)} placeholder="https://..." />
              <button
                type="button"
                className="rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                onClick={() => backgroundRef.current?.click()}
              >
                上传背景图
              </button>
              <input ref={backgroundRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleBackgroundImage(e.target.files?.[0])} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900">
            {backgroundImage ? (
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

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2">
          <span className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">BlockNote Editor</span>
          <span className="text-xs text-zinc-500">Slash 命令、拖拽/粘贴图片上传由 BlockNote 原生支持</span>
          <span className="ml-auto text-xs text-zinc-500">代码语言</span>
          <select className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700" value={codeLang} onChange={(e) => setCodeLang(e.target.value)}>
            {CODE_LANG_OPTIONS.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md border border-[var(--line-strong)] bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            onClick={insertCodeBlockTemplate}
          >
            插入代码模板
          </button>
        </div>

        <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div ref={editorWrapRef} className="min-h-[58vh] bg-white px-4 py-5 md:px-8 md:py-8">
            <BlockNoteView
              editor={editor}
              onChange={() => {
                const nextHtml = editor.blocksToHTMLLossy(editor.document);
                const md = editor.blocksToMarkdownLossy(editor.document);
                setContentHtml(nextHtml);
                setStats(estimateReadingTime(md));
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            字数：{stats.words} · 预计阅读 {stats.minutes} 分钟
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-1 ${
                saveState === 'error'
                  ? 'bg-red-100 text-red-700'
                  : saveState === 'saved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : saveState === 'saving'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {uploading ? '图片上传中' : saveState === 'saving' || saving ? '保存中' : saveState === 'saved' ? '已保存' : saveState === 'error' ? '保存失败' : '待保存'}
            </span>
            {lastSavedAt && <span>最后保存：{lastSavedAt}</span>}
            {feedback && <span>{feedback}</span>}
          </div>
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
        description={currentPostId ? '将覆盖当前草稿内容。' : '将创建新的草稿内容。'}
        onCancel={() => setShowSaveConfirm(false)}
        onConfirm={async () => {
          setShowSaveConfirm(false);
          await saveDraftWithConfirm();
        }}
        confirmText="确认保存"
      >
        <p className="text-sm text-zinc-600">当前编辑内容会保存到草稿，之后可继续编辑或发布。</p>
      </AppModal>
    </>
  );
}
