import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  postId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(10).optional()
});

const bodySchema = z.object({
  postId: z.string().trim().optional(),
  title: z.string().max(200),
  excerpt: z.string().max(5000),
  content: z.string().max(200000),
  tags: z.string().max(500),
  coverImage: z.string().max(2000),
  backgroundImage: z.string().max(2000)
});

async function resolveDraftPostId(userId: string, role: string | undefined, rawPostId?: string) {
  const postId = rawPostId?.trim() || 'new';
  if (postId === 'new') return postId;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return null;
  if (post.authorId !== userId && role !== 'ADMIN') return null;
  return postId;
}

function normalizeVersion(row: Record<string, unknown>) {
  const payloadRaw = String(row.payload_json || '{}');
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    payload = {};
  }
  return {
    id: String(row.id || ''),
    createdAt: String(row.created_at || ''),
    title: String(payload.title || ''),
    excerpt: String(payload.excerpt || ''),
    tags: String(payload.tags || ''),
    coverImage: String(payload.coverImage || ''),
    backgroundImage: String(payload.backgroundImage || ''),
    content: String(payload.content || '')
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({
    postId: sp.get('postId') || undefined,
    limit: sp.get('limit') || undefined
  });
  if (!parsed.success) return Response.json({ error: 'invalid query' }, { status: 400 });

  const postId = await resolveDraftPostId(session.user.id, session.user.role, parsed.data.postId);
  if (!postId) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const draft = await prisma.draft.findUnique({
    where: {
      user_id_post_id: {
        user_id: session.user.id,
        post_id: postId
      }
    }
  });
  if (!draft) return Response.json({ ok: true, versions: [] });

  const versions = await prisma.draftVersion.findMany({
    where: { draft_id: (draft as { id: string }).id, user_id: session.user.id },
    take: parsed.data.limit || 5
  });

  return Response.json({
    ok: true,
    versions: (versions as Record<string, unknown>[]).map(normalizeVersion)
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!payload.success) return Response.json({ error: payload.error.issues[0]?.message || 'invalid payload' }, { status: 400 });

  const postId = await resolveDraftPostId(session.user.id, session.user.role, payload.data.postId);
  if (!postId) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const draft = await prisma.draft.upsert({
    where: {
      user_id_post_id: {
        user_id: session.user.id,
        post_id: postId
      }
    },
    create: {
      post_id: postId,
      user_id: session.user.id,
      title: payload.data.title,
      excerpt: payload.data.excerpt,
      content: payload.data.content,
      tags: payload.data.tags,
      cover_image: payload.data.coverImage,
      background_image: payload.data.backgroundImage
    },
    update: {
      title: payload.data.title,
      excerpt: payload.data.excerpt,
      content: payload.data.content,
      tags: payload.data.tags,
      cover_image: payload.data.coverImage,
      background_image: payload.data.backgroundImage
    }
  });

  await prisma.draftVersion.create({
    data: {
      draft_id: (draft as { id: string }).id,
      user_id: session.user.id,
      payload_json: JSON.stringify({
        title: payload.data.title,
        excerpt: payload.data.excerpt,
        content: payload.data.content,
        tags: payload.data.tags,
        coverImage: payload.data.coverImage,
        backgroundImage: payload.data.backgroundImage
      })
    }
  });

  await prisma.draftVersion.prune({
    draft_id: (draft as { id: string }).id,
    keep: 5
  });

  const versions = await prisma.draftVersion.findMany({
    where: { draft_id: (draft as { id: string }).id, user_id: session.user.id },
    take: 5
  });

  return Response.json({
    ok: true,
    versions: (versions as Record<string, unknown>[]).map(normalizeVersion)
  });
}
