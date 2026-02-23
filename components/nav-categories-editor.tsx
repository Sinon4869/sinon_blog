'use client';

import { useMemo, useState } from 'react';

type Props = {
  initialCategories: string[];
};

function normalizeCategory(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 20);
}

export function NavCategoriesEditor({ initialCategories }: Props) {
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [draft, setDraft] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const normalized = normalizeCategory(draft);
  const canAdd = normalized.length > 0 && !categories.includes(normalized) && categories.length < 20;
  const categoriesJson = useMemo(() => JSON.stringify(categories), [categories]);

  function moveCategory(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= categories.length || to >= categories.length) return;
    setCategories((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-sm text-zinc-600">文章分类</label>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="输入分类名称，例如：复盘"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (!canAdd) return;
            setCategories((prev) => [...prev, normalized]);
            setDraft('');
          }}
        />
        <button
          className="rounded-md border border-[var(--line-strong)] px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canAdd}
          onClick={(e) => {
            e.preventDefault();
            if (!canAdd) return;
            setCategories((prev) => [...prev, normalized]);
            setDraft('');
          }}
          type="button"
        >
          添加分类
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.length === 0 && <p className="text-sm text-zinc-500">暂无分类，添加后会显示在导航“文章”菜单。</p>}
        {categories.map((name, index) => (
          <span
            key={name}
            className={`inline-flex cursor-move items-center gap-1 rounded-full border border-[var(--line-soft)] bg-zinc-100 px-3 py-1 text-xs text-zinc-700 ${
              draggingIndex === index ? 'opacity-60' : ''
            }`}
            draggable
            onDragStart={() => setDraggingIndex(index)}
            onDragEnd={() => setDraggingIndex(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingIndex == null) return;
              moveCategory(draggingIndex, index);
              setDraggingIndex(null);
            }}
            title="拖拽可排序"
          >
            <button
              className="rounded px-1 leading-none text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              onClick={() => moveCategory(index, Math.max(0, index - 1))}
              type="button"
              title="上移"
            >
              ↑
            </button>
            <button
              className="rounded px-1 leading-none text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              onClick={() => moveCategory(index, Math.min(categories.length - 1, index + 1))}
              type="button"
              title="下移"
            >
              ↓
            </button>
            <span>#{name}</span>
            <button
              className="rounded px-1 leading-none text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              onClick={() => setCategories((prev) => prev.filter((item) => item !== name))}
              type="button"
              title="删除"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input name="categoriesJson" type="hidden" value={categoriesJson} />
      <p className="text-xs text-zinc-500">最多 20 个分类，单个分类最多 20 个字符。支持拖拽或 ↑↓ 调整顺序。</p>
    </div>
  );
}
