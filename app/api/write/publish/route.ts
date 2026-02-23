import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

type DraftInput = {
  id?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string;
  coverImage?: string;
  backgroundImage?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as DraftInput;
  const id = body.id?.trim();
  const title = body.title?.trim() || '';
  const content = body.content?.trim() || '';
  const excerpt = body.excerpt?.trim() || '';
  const coverImage = body.coverImage?.trim() || '';
  const backgroundImage = body.backgroundImage?.trim() || '';
  const tagLine = body.tags?.trim() || '';

  if (!title || !content) return Response.json({ error: '标题与内容不能为空' }, { status: 400 });

  if (id) {
    const exists = await prisma.post.findUnique({ where: { id } });
    if (!exists) return Response.json({ error: '文章不存在' }, { status: 404 });
    if (exists.authorId !== session.user.id && session.user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const words = content.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.round(words / 220));
  const slug = id ? undefined : `${slugify(title)}-${Date.now().toString().slice(-5)}`;

  const post = id
    ? await prisma.post.update({
        where: { id },
        data: {
          title,
          excerpt,
          content,
          published: true,
          publishedAt: new Date(),
          reading_time: readingTime,
          seo_title: title.slice(0, 60),
          seo_description: (excerpt || content.slice(0, 120)).slice(0, 160),
          cover_image: coverImage || null,
          background_image: backgroundImage || null
        }
      })
    : await prisma.post.create({
        data: {
          title,
          slug: slug!,
          excerpt,
          content,
          published: true,
          publishedAt: new Date(),
          reading_time: readingTime,
          seo_title: title.slice(0, 60),
          seo_description: (excerpt || content.slice(0, 120)).slice(0, 160),
          cover_image: coverImage || null,
          background_image: backgroundImage || null,
          authorId: session.user.id
        }
      });

  const tags = tagLine
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  await prisma.postTag.deleteMany({ where: { postId: post.id } });
  for (const tagName of tags) {
    const tag = await prisma.tag.upsert({
      where: { slug: slugify(tagName) },
      update: { name: tagName },
      create: { name: tagName, slug: slugify(tagName) }
    });
    await prisma.postTag.create({ data: { postId: post.id, tagId: tag.id } });
  }

  return Response.json({ ok: true, id: post.id, slug: post.slug });
}
