import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { deleteMyAccount, updateEmail, updatePassword } from '@/app/actions';

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="card space-y-3">
        <h1 className="text-2xl font-bold">账户管理</h1>
        <p className="text-sm text-zinc-600">登录邮箱：{session.user.email}</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">修改邮箱</h2>
        <form action={updateEmail} className="space-y-3">
          <input className="input" type="email" name="newEmail" placeholder="新邮箱" required />
          <input className="input" type="password" name="currentPasswordForEmail" placeholder="当前密码（有密码账号必填）" />
          <button className="btn" type="submit">
            更新邮箱
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">修改密码</h2>
        <form action={updatePassword} className="space-y-3">
          <input className="input" type="password" name="currentPassword" placeholder="当前密码" required />
          <input className="input" type="password" name="newPassword" placeholder="新密码（至少6位）" required />
          <button className="btn" type="submit">
            更新密码
          </button>
        </form>
      </section>

      <section className="card space-y-3 border-red-200">
        <h2 className="text-lg font-semibold text-red-600">危险操作</h2>
        <p className="text-sm text-zinc-600">删除账户会移除你的个人资料、文章、评论与收藏，无法恢复。</p>
        <form action={deleteMyAccount} className="space-y-3">
          <input
            className="input"
            name="confirmEmail"
            placeholder={`输入邮箱确认删除：${session.user.email}`}
            required
          />
          <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500" type="submit">
            删除我的账户
          </button>
        </form>
      </section>
    </div>
  );
}
