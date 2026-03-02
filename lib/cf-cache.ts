const VERSION_KEY = 'cache:version:content';

type KvLike = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
};

type CloudflareContextLike = { env?: { CACHE_KV?: KvLike } };

async function getKv(): Promise<KvLike | null> {
  try {
    const mod = (await import('@opennextjs/cloudflare')) as {
      getCloudflareContext?: (opts: { async: boolean }) => Promise<CloudflareContextLike>;
    };
    const fn = mod.getCloudflareContext;
    if (!fn) return null;
    const ctx = await fn({ async: true });
    return ctx?.env?.CACHE_KV || null;
  } catch {
    return null;
  }
}

export async function getCacheVersion() {
  const kv = await getKv();
  if (!kv) return 'v1';
  return (await kv.get(VERSION_KEY)) || 'v1';
}

export async function bumpCacheVersion() {
  const kv = await getKv();
  if (!kv) return;
  const next = `v${Date.now()}`;
  await kv.put(VERSION_KEY, next, { expirationTtl: 60 * 60 * 24 * 30 });
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const kv = await getKv();
  if (!kv) return null;
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson<T>(key: string, value: T, ttlSec: number) {
  const kv = await getKv();
  if (!kv) return;
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSec });
}

export function buildCacheKey(scope: string, parts: Record<string, string | number | boolean | undefined>) {
  const qp = Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');
  return `cache:${scope}:${qp}`;
}
