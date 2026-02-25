'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { createCategory, mergeOrDeleteCategory, renameCategory, updateCategoryOrderBatch } from '@/app/actions';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  post_count: number;
};

export function CategoryManagementCenter({ categories }: { categories: CategoryItem[] }) {
  const [items, setItems] = useState<CategoryItem[]>(categories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const active = useMemo(() => items.find((x) => x.id === activeId) || null, [items, activeId]);
  const orderJson = useMemo(() => JSON.stringify(items.map((x, i) => ({ id: x.id, sortOrder: i }))), [items]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [activeId]);

  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    setItems((prev) => {
      const from = prev.findIndex((x) => x.id === fromId);
      const to = prev.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }

  return (
    <div id="category-center" className="card space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-800">分类管理中心</h2>
          <p className="mt-1 text-sm text-zinc-500">支持拖拽排序；点“管理”在抽屉里完成重命名、合并、删除。</p>
        </div>
      </div>

      <form action={createCategory} className="rounded-2xl border border-[var(--line-soft)] bg-white/80 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className="input" name="name" placeholder="输入新分类名称，例如：产品复盘" />
          <ConfirmSubmitButton className="btn" confirmText="确认创建该分类？">
            新建分类
          </ConfirmSubmitButton>
        </div>
      </form>

      <form action={updateCategoryOrderBatch} className="space-y-2">
        <input type="hidden" name="categoryOrderJson" value={orderJson} />
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">拖拽左侧手柄调整顺序，完成后保存。</p>
          <ConfirmSubmitButton className="btn-secondary" confirmText="确认保存当前拖拽排序？">
            保存排序
          </ConfirmSubmitButton>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">暂无分类</p>
      ) : (
        <div className="space-y-2">
          {items.map((cat) => (
            <article
              key={cat.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--line-soft)] bg-white/85 p-3"
              draggable
              onDragStart={() => setDragId(cat.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, cat.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
            >
              <div className="cursor-grab select-none text-zinc-400" title="拖拽排序">
                ☰
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-800">#{cat.name}</p>
                <p className="text-xs text-zinc-500">slug: {cat.slug} · 文章: {cat.post_count}</p>
              </div>
              <button type="button" className="btn-secondary text-xs" onClick={() => setActiveId(cat.id)}>
                管理
              </button>
            </article>
          ))}
        </div>
      )}

      {active && mounted &&
        createPortal(
          <div className="fixed inset-0 z-[125]">
            <button className="absolute inset-0 h-full w-full bg-zinc-900/35" onClick={() => setActiveId(null)} />
            <aside className="absolute right-0 top-0 h-screen w-full max-w-md overflow-y-auto border-l border-[var(--line-soft)] bg-[#f8f7f3] p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-800">管理分类：#{active.name}</h3>
                <button className="btn-secondary" type="button" onClick={() => setActiveId(null)}>
                  关闭
                </button>
              </div>

              <div className="space-y-3">
                <form action={renameCategory} className="rounded-xl border border-[var(--line-soft)] bg-white p-3">
                  <input type="hidden" name="tagId" value={active.id} />
                  <label className="mb-1 block text-xs text-zinc-500">重命名</label>
                  <div className="flex gap-2">
                    <input className="input" name="nextName" defaultValue={active.name} />
                    <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认重命名该分类？">
                      保存
                    </ConfirmSubmitButton>
                  </div>
                </form>

                <form action={mergeOrDeleteCategory} className="rounded-xl border border-[var(--line-soft)] bg-white p-3">
                  <input type="hidden" name="sourceTagId" value={active.id} />
                  <input type="hidden" name="mode" value="merge" />
                  <label className="mb-1 block text-xs text-zinc-500">合并到</label>
                  <div className="flex gap-2">
                    <select className="input" name="targetTagId" defaultValue="">
                      <option value="">选择目标分类...</option>
                      {items
                        .filter((x) => x.id !== active.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                    <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认合并该分类到目标分类？">
                      合并
                    </ConfirmSubmitButton>
                  </div>
                </form>

                <form action={mergeOrDeleteCategory} className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <input type="hidden" name="sourceTagId" value={active.id} />
                  <input type="hidden" name="mode" value="delete" />
                  <ConfirmSubmitButton className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100" confirmText="确认删除该分类？若存在文章关联将被拦截。">
                    删除分类
                  </ConfirmSubmitButton>
                </form>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </div>
  );
}
