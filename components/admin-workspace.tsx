import { createCategory, mergeOrDeleteCategory, renameCategory, savePersonalIntroConfig, saveSiteConfig, saveUserSystemConfig, updateCategoryOrder } from '@/app/actions';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { NavCategoriesEditor } from '@/components/nav-categories-editor';
import { AdminUserTable } from '@/components/admin-user-table';
import { prisma } from '@/lib/prisma';
import { ANONYMOUS_USER_EMAIL, SETTING_KEYS, SUPER_ADMIN_EMAIL } from '@/lib/site-settings';

type AuditLogItem = {
  id: string;
  actor_user_id?: string | null;
  target_user_id?: string | null;
  action: string;
  created_at: string;
};

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  post_count: number;
};

function parseConfiguredCategories(value: string) {
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 20);
    }
  } catch {}
  return raw
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function AdminWorkspace() {
  const [usersRaw, posts, comments, userListRaw, logsRaw, registrationSetting, anonymousSetting, categoriesRaw, introName, introBio, introAvatar, introLinks, siteTitleSetting, siteIconSetting, navCategoriesSetting] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true, last_login_at: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.auditLog.findMany({ take: 20 }),
    prisma.setting.get(SETTING_KEYS.registrationEnabled),
    prisma.setting.get(SETTING_KEYS.anonymousCommentEnabled),
    prisma.tag.adminList(),
    prisma.setting.get(SETTING_KEYS.profileName),
    prisma.setting.get(SETTING_KEYS.profileBio),
    prisma.setting.get(SETTING_KEYS.profileAvatar),
    prisma.setting.get(SETTING_KEYS.profileLinks),
    prisma.setting.get(SETTING_KEYS.siteTitle),
    prisma.setting.get(SETTING_KEYS.siteIcon),
    prisma.setting.get(SETTING_KEYS.navCategories)
  ]);

  const registrationEnabled = !registrationSetting || registrationSetting.value !== '0';
  const anonymousCommentEnabled = !!anonymousSetting && anonymousSetting.value === '1';
  const userList = userListRaw
    .filter((u) => String(u.email || '').toLowerCase() !== ANONYMOUS_USER_EMAIL)
    .map((u) => ({
      ...u,
      role: String(u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL ? 'ADMIN' : u.role
    }));
  const users = Math.max(0, usersRaw - (userListRaw.length - userList.length));

  const logs: AuditLogItem[] = (logsRaw || []).map((l: Record<string, unknown>) => ({
    id: String(l.id || ''),
    action: String(l.action || ''),
    created_at: String(l.created_at || ''),
    actor_user_id: l.actor_user_id ? String(l.actor_user_id) : null,
    target_user_id: l.target_user_id ? String(l.target_user_id) : null
  }));
  const categories: CategoryItem[] = (categoriesRaw || []).map((c: Record<string, unknown>) => ({
    id: String(c.id || ''),
    name: String(c.name || ''),
    slug: String(c.slug || ''),
    sort_order: Number(c.sort_order || 0),
    post_count: Number(c.post_count || 0)
  }));

  let introLinksParsed: Array<{ label: string; url: string }> = [];
  try {
    const parsed = JSON.parse(String((introLinks as { value?: string } | null)?.value || '[]'));
    if (Array.isArray(parsed)) {
      introLinksParsed = parsed
        .map((x) => ({ label: String(x?.label || ''), url: String(x?.url || '') }))
        .filter((x) => x.label && x.url);
    }
  } catch {}

  const website = introLinksParsed.find((x) => x.label === '网站')?.url || '';
  const github = introLinksParsed.find((x) => x.label === 'GitHub')?.url || '';
  const xUrl = introLinksParsed.find((x) => x.label === 'X')?.url || '';
  const siteTitle = String((siteTitleSetting as { value?: string } | null)?.value || 'Komorebi');
  const siteIcon = String((siteIconSetting as { value?: string } | null)?.value || '木').trim() || '木';
  const navCategories = String((navCategoriesSetting as { value?: string } | null)?.value || '');
  const navCategoryList = parseConfiguredCategories(navCategories);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card">用户总数：{users}</div>
        <div className="card">文章总数：{posts}</div>
        <div className="card">评论总数：{comments}</div>
      </div>


      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">站点与导航配置</h2>
        <form action={saveSiteConfig} className="grid gap-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">站点标题</label>
            <input className="input" name="siteTitle" defaultValue={siteTitle} placeholder="例如：Komorebi" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">站点图标（支持 emoji / 短字符）</label>
            <input className="input" name="siteIcon" defaultValue={siteIcon} placeholder="例如：🌍 或 木" maxLength={8} />
            <p className="mt-1 text-xs text-zinc-500">用于导航 Logo 与浏览器 favicon。若未立即生效，请强制刷新一次。</p>
          </div>
          <NavCategoriesEditor initialCategories={navCategoryList} />
          <div>
            <ConfirmSubmitButton className="btn" confirmText="确认保存站点与导航配置？">
              保存配置
            </ConfirmSubmitButton>
          </div>
        </form>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">用户体系配置</h2>
        <form action={saveUserSystemConfig} className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked={registrationEnabled} name="registrationEnabled" type="checkbox" />
            <span>允许新用户注册</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked={anonymousCommentEnabled} name="anonymousCommentEnabled" type="checkbox" />
            <span>允许匿名评论（未登录可评论）</span>
          </label>
          <ConfirmSubmitButton className="btn" confirmText="确认保存用户体系配置？">
            保存配置
          </ConfirmSubmitButton>
        </form>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">个人介绍管理</h2>
        <form action={savePersonalIntroConfig} className="space-y-3">
          <input className="input" name="profileName" defaultValue={String((introName as { value?: string } | null)?.value || '')} placeholder="展示名称" />
          <textarea className="input min-h-24" name="profileBio" defaultValue={String((introBio as { value?: string } | null)?.value || '')} placeholder="个人介绍" />
          <input className="input" name="profileAvatar" defaultValue={String((introAvatar as { value?: string } | null)?.value || '')} placeholder="头像 URL（http/https）" />
          <div className="grid gap-2 md:grid-cols-3">
            <input className="input" name="profileWebsite" defaultValue={website} placeholder="网站链接" />
            <input className="input" name="profileGithub" defaultValue={github} placeholder="GitHub 链接" />
            <input className="input" name="profileX" defaultValue={xUrl} placeholder="X 链接" />
          </div>
          <ConfirmSubmitButton className="btn" confirmText="确认保存个人介绍配置？">
            保存个人介绍
          </ConfirmSubmitButton>
        </form>
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">用户管理</h2>
        <p className="text-sm text-zinc-500">超级管理员账号 {SUPER_ADMIN_EMAIL} 固定为 ADMIN，不可降权、禁用或删除。</p>
        <AdminUserTable initialUsers={userList} />
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">分类管理中心</h2>
        <p className="text-sm text-zinc-500">分类创建、重命名、合并、删除与排序统一在这里管理。</p>

        <form action={createCategory} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className="input" name="name" placeholder="输入新分类名称，例如：产品复盘" />
          <ConfirmSubmitButton className="btn" confirmText="确认创建该分类？">
            创建分类
          </ConfirmSubmitButton>
        </form>

        <div className="space-y-3">
          {categories.length === 0 && <p className="text-sm text-zinc-500">暂无分类</p>}
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-3 rounded-2xl border border-[var(--line-soft)] bg-white/85 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-zinc-800">#{cat.name}</span>
                <span className="text-zinc-500">slug: {cat.slug}</span>
                <span className="text-zinc-500">文章数: {cat.post_count}</span>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <form action={renameCategory} className="flex gap-2">
                  <input type="hidden" name="tagId" value={cat.id} />
                  <input className="input" name="nextName" defaultValue={cat.name} placeholder="新分类名" />
                  <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认重命名该分类？">
                    重命名
                  </ConfirmSubmitButton>
                </form>

                <form action={updateCategoryOrder} className="flex gap-2">
                  <input type="hidden" name="tagId" value={cat.id} />
                  <input className="input" name="sortOrder" type="number" defaultValue={cat.sort_order} />
                  <ConfirmSubmitButton className="btn-secondary text-xs" confirmText="确认更新排序？">
                    排序
                  </ConfirmSubmitButton>
                </form>

                <form action={mergeOrDeleteCategory} className="flex gap-2">
                  <input type="hidden" name="sourceTagId" value={cat.id} />
                  <input type="hidden" name="mode" value="merge" />
                  <select className="input" name="targetTagId" defaultValue="">
                    <option value="">合并到...</option>
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
              </div>

              <form action={mergeOrDeleteCategory}>
                <input type="hidden" name="sourceTagId" value={cat.id} />
                <input type="hidden" name="mode" value="delete" />
                <ConfirmSubmitButton className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100" confirmText="确认删除该分类？若存在文章关联将被拦截。">
                  删除分类
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">操作审计日志</h2>
          <a className="rounded border px-2 py-1 text-xs" href="/api/admin/audit?export=csv">
            导出 CSV
          </a>
        </div>
        <ul className="space-y-1 text-sm text-zinc-700">
          {logs.length === 0 && <li>暂无日志</li>}
          {logs.map((l) => (
            <li key={l.id}>
              {l.created_at} · {l.action} · actor:{l.actor_user_id || '-'} · target:{l.target_user_id || '-'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
