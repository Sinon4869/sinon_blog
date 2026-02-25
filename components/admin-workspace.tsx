import { savePersonalIntroConfig, saveSiteConfig, saveUserSystemConfig } from '@/app/actions';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { AdminUserTable } from '@/components/admin-user-table';
import { CategoryManagementCenter } from '@/components/category-management-center';
import { SiteIconConfigField } from '@/components/site-icon-config-field';
import { AdminNotice } from '@/components/admin-notice';
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


export async function AdminWorkspace({ notice, type }: { notice?: string; type?: 'success' | 'error' } = {}) {
  const [usersRaw, posts, comments, userListRaw, logsRaw, registrationSetting, anonymousSetting, categoriesRaw, introName, introBio, introAvatar, introLinks, siteTitleSetting, siteIconSetting, siteIconUrlSetting] = await Promise.all([
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
    prisma.setting.get(SETTING_KEYS.siteIconUrl)
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
  const siteIconUrl = String((siteIconUrlSetting as { value?: string } | null)?.value || '').trim();

  return (
    <div className="space-y-4">
      <AdminNotice notice={notice} type={type} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card">用户总数：{users}</div>
        <div className="card">文章总数：{posts}</div>
        <div className="card">评论总数：{comments}</div>
      </div>


      <div id="site-nav-config" className="card space-y-3">
        <h2 className="text-lg font-semibold">站点与导航配置</h2>
        <form action={saveSiteConfig} className="grid gap-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">站点标题</label>
            <input className="input" name="siteTitle" defaultValue={siteTitle} placeholder="例如：Komorebi" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">站点图标（支持 emoji / 短字符）</label>
            <input className="input" name="siteIcon" defaultValue={siteIcon} placeholder="例如：🌍 或 木" maxLength={8} />
          </div>
          <SiteIconConfigField initialUrl={siteIconUrl} />
          <p className="text-xs text-zinc-500">分类请在下方“分类管理中心”统一维护，导航将自动同步分类数据。</p>
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

      <CategoryManagementCenter categories={categories} />

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
