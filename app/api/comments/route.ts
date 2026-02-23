import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ANONYMOUS_USER_EMAIL, isAnonymousCommentEnabled } from '@/lib/site-settings';
import { buildPostPath } from '@/lib/utils';

async function ensureAnonymousUser() {
  const anonUser = await prisma.user.findUnique({ where: { email: ANONYMOUS_USER_EMAIL } });
  if (anonUser) return anonUser;
  const created = await prisma.user.create({
    data: {
      email: ANONYMOUS_USER_EMAIL,
      name: '匿名访客',
      role: 'USER',
      disabled: 0
    }
  });
  return created;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const allowAnonymous = await isAnonymousCommentEnabled();
  if (!session?.user?.id && !allowAnonymous) return NextResponse.redirect(new URL('/login', req.url));

  const formData = await req.formData();
  const postId = formData.get('postId')?.toString();
  const content = formData.get('content')?.toString();

  if (!postId || !content) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !post.published) return NextResponse.json({ error: 'post not found' }, { status: 404 });

  let userId = session?.user?.id;
  if (!userId) {
    const anonUser = await ensureAnonymousUser();
    userId = anonUser.id;
  }

  await prisma.comment.create({ data: { postId, content, userId } });

  return NextResponse.redirect(new URL(buildPostPath(post), req.url));
}
