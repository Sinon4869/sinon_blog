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
    <div id="category-center" className="card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">分类管理中心</h2>
          <p className="text-sm text-zinc-500">统一管理分类创建、重命名、排序、合并与删除。</p>
        </div>
      </div>

      <form action={createCategory} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input" name="name" placeholder="输入新分类名称，例如：产品复盘" />
        <ConfirmSubmitButton className="btn" confirmText="确认创建该分类？">
          创建分类
        </ConfirmSubmitButton>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">暂无分类</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white/75">
          <div className="hidden grid-cols-[minmax(220px,1.2fr)_120px_120px_minmax(220px,1fr)_100px] gap-2 border-b border-[var(--line-soft)] bg-zinc-50/70 px-3 py-2 text-xs text-zinc-500 md:grid">
            <span>分类</span>
            <span>排序</span>
            <span>文章数</span>
            <span>合并到</span>
            <span>操作</span>
          </div>

          <div className="divide-y divide-[var(--line-soft)]">
            {categories.map((cat) => (
              <div key={cat.id} className="space-y-2 px-3 py-3">
                <div className="grid gap-2 md:grid-cols-[minmax(220px,1.2fr)_120px_120px_minmax(220px,1fr)_100px]">
                  <form action={renameCategory} className="flex gap-2">
                    <input type="hidden" name="tagId" value={cat.id} />
                    <input className="input" name="nextName" defaultValue={cat.name} placeholder="分类名" />
                    <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认重命名该分类？">
                      重命名
                    </ConfirmSubmitButton>
                  </form>

                  <form action={updateCategoryOrder} className="flex gap-2">
                    <input type="hidden" name="tagId" value={cat.id} />
                    <input className="input" name="sortOrder" type="number" defaultValue={cat.sort_order} />
                    <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认更新排序？">
                      保存
                    </ConfirmSubmitButton>
                  </form>

                  <div className="flex items-center rounded-lg border border-[var(--line-soft)] bg-zinc-50 px-3 text-sm text-zinc-600">{cat.post_count}</div>

                  <form action={mergeOrDeleteCategory} className="flex gap-2">
                    <input type="hidden" name="sourceTagId" value={cat.id} />
                    <input type="hidden" name="mode" value="merge" />
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
                  </form>

                  <form action={mergeOrDeleteCategory}>
                    <input type="hidden" name="sourceTagId" value={cat.id} />
                    <input type="hidden" name="mode" value="delete" />
                    <ConfirmSubmitButton className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100" confirmText="确认删除该分类？若存在文章关联将被拦截。">
                      删除
                    </ConfirmSubmitButton>
                  </form>
                </div>
                <p className="text-xs text-zinc-500">
                  slug: <span className="font-mono">{cat.slug}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
