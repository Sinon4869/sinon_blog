const buckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: Request) {
  const h = req.headers;
  return h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const item = buckets.get(key);
  if (!item || now > item.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (item.count >= limit) {
    return { ok: false, retryAfterMs: item.resetAt - now };
  }
  item.count += 1;
  buckets.set(key, item);
  return { ok: true, remaining: limit - item.count };
}
