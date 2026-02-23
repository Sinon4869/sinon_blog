import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPostPath } from '@/lib/utils';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', req.url));

  const formData = await req.formData();
  const postId = formData.get('postId')?.toString();
  const content = formData.get('content')?.toString();

  if (!postId || !content) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !post.published) return NextResponse.json({ error: 'post not found' }, { status: 404 });

  await prisma.comment.create({ data: { postId, content, userId: session.user.id } });

  return NextResponse.redirect(new URL(buildPostPath(post), req.url));
}
