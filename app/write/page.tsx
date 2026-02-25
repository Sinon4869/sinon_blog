import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { WriteEditor } from '@/components/write-editor';
import { authOptions } from '@/lib/auth';
import { prisma, type Row } from '@/lib/prisma';

export default async function WritePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!sp.id) redirect('/write/new');

  const post = await prisma.post.findUnique({
    where: { id: sp.id },
    include: { tags: { include: { tag: true } } }
  });
  if (!post) redirect('/dashboard');

  if (post.authorId !== session.user.id && session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const categories = await prisma.tag.findMany({ take: 40 });

  return (
    <WriteEditor
      action={savePost}
      availableCategories={categories.map((t: Row) => String(t?.name || ''))}
      post={
        {
          id: post.id,
          title: post.title,
          excerpt: post.excerpt || '',
          content: post.content,
          published: post.published,
          tags: post.tags.map((t: { tag: { name: string } }) => t.tag.name).join(','),
          coverImage: (post as { cover_image?: string | null }).cover_image || '',
          backgroundImage: (post as { background_image?: string | null }).background_image || ''
        }
      }
    />
  );
}
