import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { AdminWorkspace } from '@/components/admin-workspace';
import { authOptions } from '@/lib/auth';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">后台管理</h1>
      <AdminWorkspace />
    </div>
  );
}
