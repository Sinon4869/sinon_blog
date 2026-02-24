'use client';

import type { Editor } from '@tiptap/react';

type Props = {
  editor: Editor;
  toolbarDocked: boolean;
  pinToolbar: boolean;
  toolbarHeight: number;
  toolbarLeft: number;
  toolbarWidth: number;
  toolbarRef: { current: HTMLDivElement | null };
  onTogglePin: () => void;
  onToggleInlineCode: () => void;
  onInsertCodeBlock: () => void;
  onAddOrEditLink: () => void;
  onInlineImage: (file: File | undefined) => void;
  fileRef: { current: HTMLInputElement | null };
  codeLanguage: string;
  setCodeLanguage: (v: string) => void;
  codeBackground: string;
  setCodeBackground: (v: string) => void;
  onApplyCodeBlockOptions: () => void;
};

function ToolButton({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={`tiptap-btn ${active ? 'is-active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function EditorToolbar({
  editor,
  toolbarDocked,
  pinToolbar,
  toolbarHeight,
  toolbarLeft,
  toolbarWidth,
  toolbarRef,
  onTogglePin,
  onToggleInlineCode,
  onInsertCodeBlock,
  onAddOrEditLink,
  onInlineImage,
  fileRef,
  codeLanguage,
  setCodeLanguage,
  codeBackground,
  setCodeBackground,
  onApplyCodeBlockOptions
}: Props) {
  return (
    <>
      {toolbarDocked && pinToolbar && <div aria-hidden className="hidden md:block" style={{ height: `${toolbarHeight}px` }} />}
      <div className="border-b border-zinc-200 bg-zinc-50/70">
        <div
          ref={(el) => {
            toolbarRef.current = el;
          }}
          className={`z-30 border-b border-zinc-200 px-2 py-2 transition-all duration-300 md:px-3 ${toolbarDocked && pinToolbar ? 'md:fixed md:top-[92px]' : ''} ${
            toolbarDocked
              ? 'bg-[rgba(247,246,242,0.92)] shadow-[0_10px_24px_-16px_rgba(40,40,40,0.45)] backdrop-blur-xl'
              : 'bg-zinc-50/95 backdrop-blur'
          }`}
          style={toolbarDocked && pinToolbar ? { left: `${toolbarLeft}px`, width: `${toolbarWidth}px` } : undefined}
        >
          <div className={`rounded-xl border border-zinc-200 bg-white/86 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all duration-300 ${toolbarDocked ? 'md:mx-auto md:max-w-[1100px]' : ''}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs tracking-wide text-zinc-600">编辑器工具栏</p>
              <button className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98]" onClick={onTogglePin} type="button">
                {pinToolbar ? '取消吸顶' : '固定到顶部'}
              </button>
            </div>
            <div className={`hide-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5 ${toolbarDocked ? 'flex-nowrap' : 'flex-wrap'}`}>
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
              <ToolButton label="行内代码" active={editor.isActive('code')} onClick={onToggleInlineCode} />
              <ToolButton label="代码块" active={editor.isActive('codeBlock')} onClick={onInsertCodeBlock} />
              <span className="mx-1 h-5 w-px bg-zinc-200" />

              <ToolButton label="列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <ToolButton label="编号" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
              <ToolButton label="任务" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
              <ToolButton label="引用" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
              <ToolButton label="分割线" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
              <span className="mx-1 h-5 w-px bg-zinc-200" />

              <ToolButton label="链接" active={editor.isActive('link')} onClick={onAddOrEditLink} />
              <ToolButton label="图片" onClick={() => fileRef.current?.click()} />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onInlineImage(e.target.files?.[0])} />
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
              <select className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs" value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}>
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
              <input aria-label="代码块背景色" className="h-7 w-10 rounded border border-zinc-300 bg-white p-0.5" onChange={(e) => setCodeBackground(e.target.value)} type="color" value={codeBackground} />
              <button className="tiptap-btn" onClick={onApplyCodeBlockOptions} type="button">
                应用代码块样式
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
