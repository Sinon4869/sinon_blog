import { createCategory, mergeOrDeleteCategory, renameCategory, updateCategoryOrder } from '@/app/actions';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  post_count: number;
};

export function CategoryManagementCenter({ categories }: { categories: CategoryItem[] }) {
  return (
    <div id="category-center" className="card space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-800">分类管理中心</h2>
          <p className="mt-1 text-sm text-zinc-500">更轻量的分类工作流：创建、重命名、排序、合并、删除。</p>
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

      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">暂无分类</p>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <article key={cat.id} className="rounded-2xl border border-[var(--line-soft)] bg-white/85 p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zinc-800">#{cat.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    slug: <span className="font-mono">{cat.slug}</span>
                  </p>
                </div>
                <span className="rounded-full border border-[var(--line-soft)] bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">文章 {cat.post_count}</span>
              </div>

              <div className="grid gap-2 lg:grid-cols-3">
                <form action={renameCategory} className="rounded-xl border border-[var(--line-soft)] bg-white/90 p-2">
                  <input type="hidden" name="tagId" value={cat.id} />
                  <label className="mb-1 block text-xs text-zinc-500">重命名</label>
                  <div className="flex gap-2">
                    <input className="input" name="nextName" defaultValue={cat.name} placeholder="分类名" />
                    <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认重命名该分类？">
                      保存
                    </ConfirmSubmitButton>
                  </div>
                </form>

                <form action={updateCategoryOrder} className="rounded-xl border border-[var(--line-soft)] bg-white/90 p-2">
                  <input type="hidden" name="tagId" value={cat.id} />
                  <label className="mb-1 block text-xs text-zinc-500">排序</label>
                  <div className="flex gap-2">
                    <input className="input" name="sortOrder" type="number" defaultValue={cat.sort_order} />
                    <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认更新排序？">
                      保存
                    </ConfirmSubmitButton>
                  </div>
                </form>

                <form action={mergeOrDeleteCategory} className="rounded-xl border border-[var(--line-soft)] bg-white/90 p-2">
                  <input type="hidden" name="sourceTagId" value={cat.id} />
                  <input type="hidden" name="mode" value="merge" />
                  <label className="mb-1 block text-xs text-zinc-500">合并到</label>
                  <div className="flex gap-2">
                    <select className="input" name="targetTagId" defaultValue="">
                      <option value="">选择目标分类...</option>
                      {categories
                        .filter((x) => x.id !== cat.id)
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
              </div>

              <div className="mt-3 flex justify-end">
                <form action={mergeOrDeleteCategory}>
                  <input type="hidden" name="sourceTagId" value={cat.id} />
                  <input type="hidden" name="mode" value="delete" />
                  <ConfirmSubmitButton className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100" confirmText="确认删除该分类？若存在文章关联将被拦截。">
                    删除分类
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
