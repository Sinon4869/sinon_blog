import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { saveUserSystemConfig } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
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

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [usersRaw, posts, comments, userListRaw, logsRaw, registrationSetting, anonymousSetting] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true, last_login_at: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.auditLog.findMany({ take: 20 }),
    prisma.setting.get(SETTING_KEYS.registrationEnabled),
    prisma.setting.get(SETTING_KEYS.anonymousCommentEnabled)
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

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">后台管理</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card">用户总数：{users}</div>
        <div className="card">文章总数：{posts}</div>
        <div className="card">评论总数：{comments}</div>
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
      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">用户管理</h2>
        <p className="text-sm text-zinc-500">超级管理员账号 {SUPER_ADMIN_EMAIL} 固定为 ADMIN，不可降权、禁用或删除。</p>
        <AdminUserTable initialUsers={userList} />
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
