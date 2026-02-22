import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WriteEditor } from '@/components/write-editor';

export default async function WritePage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const post = searchParams.id
    ? await prisma.post.findUnique({
        where: { id: searchParams.id },
        include: { tags: { include: { tag: true } } }
      })
    : null;

  if (post && post.authorId !== session.user.id && session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <WriteEditor
      action={savePost}
      post={
        post
          ? {
              id: post.id,
              title: post.title,
              excerpt: post.excerpt || '',
              content: post.content,
              published: post.published,
              tags: post.tags.map((t: { tag: { name: string } }) => t.tag.name).join(',')
            }
          : undefined
      }
    />
  );
}
