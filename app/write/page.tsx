import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { WriteEditor } from '@/components/write-editor';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

  return (
    <WriteEditor
      action={savePost}
      post={
        {
          id: post.id,
          title: post.title,
          excerpt: post.excerpt || '',
          content: post.content,
          published: post.published,
          tags: post.tags.map((t: { tag: { name: string } }) => t.tag.name).join(',')
        }
      }
    />
  );
}
