import { getServerSession } from 'next-auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { authOptions } from '@/lib/auth';
import { getRequestId, logObs, alertLevel } from '@/lib/obs';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';

type R2BucketLike = {
  put: (key: string, value: ArrayBuffer, options?: Record<string, unknown>) => Promise<unknown>;
};

const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function extFromType(type: string) {
  return EXT_BY_MIME[type] || 'jpg';
}

function fail(code: string, error: string, status = 400) {
  return Response.json({ code, error }, { status });
}

function safeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  const ip = getClientIp(req);
  const limit = enforceRateLimit(`upload:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return fail('UPLOAD_RATE_LIMITED', '上传过于频繁，请稍后再试', 429);
  if (!session?.user) return fail('AUTH_REQUIRED', 'Unauthorized', 401);

  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) return fail('UPLOAD_FILE_MISSING', 'Missing file', 400);
  if (!ALLOWED_MIME.has(file.type)) return fail('UPLOAD_MIME_INVALID', '仅支持 jpg/png/webp/gif', 400);
  if (file.size > MAX_IMAGE_SIZE) return fail('UPLOAD_TOO_LARGE', 'Image too large (max 8MB)', 400);

  const originalExt = (file.name.split('.').pop() || '').toLowerCase();
  const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
  if (originalExt && !allowedExt.has(originalExt)) return fail('UPLOAD_EXT_INVALID', '文件扩展名不被允许', 400);

  const ctx = await getCloudflareContext({ async: true });
  const env = (ctx?.env || {}) as Record<string, unknown>;
  const bucket = (env.BLOG_ASSETS || env.R2_BUCKET) as R2BucketLike | undefined;

  if (!bucket?.put) {
    return fail('R2_BINDING_MISSING', 'R2 bucket binding missing (BLOG_ASSETS)', 500);
  }

  const now = new Date();
  const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ext = extFromType(file.type || '');
  const filename = safeName(file.name || 'image') || 'image';
  const userPart = String(session.user.id || 'anonymous').slice(0, 12);
  const key = `uploads/${ym}/${userPart}/${Date.now()}-${filename}.${ext}`;

  const buf = await file.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      uploadedBy: String(session.user.id || ''),
      originalName: file.name || '',
      source: 'write-editor'
    }
  });

  await prisma.auditLog.create({
    data: {
      actor_user_id: session.user.id,
      action: 'upload_image',
      detail: JSON.stringify({ key, mime: file.type, size: file.size, requestId })
    }
  });

  logObs('upload_image', {
    requestId,
    userId: session.user.id,
    key,
    mime: file.type,
    size: file.size,
    level: alertLevel('upload_image'),
    durationMs: Date.now() - startedAt
  });

  return Response.json({ requestId, key, url: `/api/assets/${key}` });
}
