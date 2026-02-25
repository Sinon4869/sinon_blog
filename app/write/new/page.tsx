import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { WriteEditor } from '@/components/write-editor';
import { authOptions } from '@/lib/auth';
import { prisma, type Row } from '@/lib/prisma';

export default async function WriteCreatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const categories = await prisma.tag.findMany({ take: 40 });

  return (
    <div className="space-y-4">
      <section className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">WRITER</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-800 sm:text-3xl">新建文章</h1>
      </section>
      <WriteEditor action={savePost} availableCategories={categories.map((t: Row) => String(t?.name || ''))} />
    </div>
  );
}
