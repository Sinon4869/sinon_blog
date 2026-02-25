import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { AdminWorkspace } from '@/components/admin-workspace';
import { authOptions } from '@/lib/auth';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="space-y-4">
      <section className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">ADMIN</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-800 sm:text-3xl">后台管理</h1>
      </section>
      <AdminWorkspace />
    </div>
  );
}
