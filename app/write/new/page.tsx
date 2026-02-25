import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { WriteEditor } from '@/components/write-editor';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function WriteCreatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const categories = await prisma.tag.findMany({ take: 40 });

  return <WriteEditor action={savePost} availableCategories={categories.map((t: { name: string }) => t.name)} />;
}
