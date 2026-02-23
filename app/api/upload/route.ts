import { getServerSession } from 'next-auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { authOptions } from '@/lib/auth';

type R2BucketLike = {
  put: (key: string, value: ArrayBuffer, options?: Record<string, unknown>) => Promise<unknown>;
};

const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB

function extFromType(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
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
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) return Response.json({ error: 'Missing file' }, { status: 400 });
  if (!file.type.startsWith('image/')) return Response.json({ error: 'Only image upload is allowed' }, { status: 400 });
  if (file.size > MAX_IMAGE_SIZE) return Response.json({ error: 'Image too large (max 8MB)' }, { status: 400 });

  const ctx = await getCloudflareContext({ async: true });
  const env = (ctx?.env || {}) as Record<string, unknown>;
  const bucket = (env.BLOG_ASSETS || env.R2_BUCKET) as R2BucketLike | undefined;

  if (!bucket?.put) {
    return Response.json({ error: 'R2 bucket binding missing (BLOG_ASSETS)' }, { status: 500 });
  }

  const now = new Date();
  const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ext = extFromType(file.type || '');
  const filename = safeName(file.name || 'image') || 'image';
  const key = `uploads/${ym}/${Date.now()}-${filename}.${ext}`;

  const buf = await file.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      uploadedBy: String(session.user.id || ''),
      originalName: file.name || ''
    }
  });

  return Response.json({ key, url: `/api/assets/${key}` });
}
