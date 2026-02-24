import { getCloudflareContext } from '@opennextjs/cloudflare';

type R2ObjectLike = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  etag?: string;
};

type R2BucketLike = {
  get: (key: string) => Promise<R2ObjectLike | null>;
};

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts = [] } = await params;
  const key = keyParts.join('/');
  if (!key) return new Response('Missing key', { status: 400 });
  if (!key.startsWith('uploads/')) return new Response('Invalid key', { status: 400 });

  const ctx = await getCloudflareContext({ async: true });
  const env = (ctx?.env || {}) as Record<string, unknown>;
  const bucket = (env.BLOG_ASSETS || env.R2_BUCKET) as R2BucketLike | undefined;

  if (!bucket?.get) return new Response('Bucket not configured', { status: 500 });

  const obj = await bucket.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const etag = obj.etag || '';
  const inm = req.headers.get('if-none-match') || '';
  if (etag && inm && inm === etag) {
    return new Response(null, {
      status: 304,
      headers: { etag, 'cache-control': 'public, max-age=31536000, immutable' }
    });
  }

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      etag
    }
  });
}
