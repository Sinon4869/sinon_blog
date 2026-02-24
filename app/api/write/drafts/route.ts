import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  postId: z.string().trim().min(1).optional()
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

function normalizeDraft(draft: Record<string, unknown>) {
  return {
    id: String(draft.id || ''),
    postId: String(draft.post_id || 'new'),
    title: String(draft.title || ''),
    excerpt: String(draft.excerpt || ''),
    content: String(draft.content || ''),
    tags: String(draft.tags || ''),
    coverImage: String(draft.cover_image || ''),
    backgroundImage: String(draft.background_image || ''),
    syncedAt: String(draft.updated_at || '')
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({ postId: sp.get('postId') || undefined });
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

  if (!draft) return Response.json({ ok: true, draft: null });
  return Response.json({ ok: true, draft: normalizeDraft(draft as Record<string, unknown>) });
}

export async function PUT(req: Request) {
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

  const normalized = normalizeDraft(draft as Record<string, unknown>);
  return Response.json({
    ok: true,
    draft: normalized,
    syncedAt: normalized.syncedAt
  });
}
