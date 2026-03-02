type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogPayload = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  'email',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'ip',
  'x-forwarded-for',
  'cf-connecting-ip'
]);

function maskEmail(value: string) {
  const [name, domain] = value.toLowerCase().split('@');
  if (!name || !domain) return '***';
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskToken(value: string) {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function redactValue(key: string, value: unknown): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('email')) return maskEmail(value);
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('token') || lowerKey.includes('password')) return maskToken(value);
    return value;
  }

  if (Array.isArray(value)) return value.map((v) => redactValue(key, v));

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = redactValue(k, v);
    }
    return out;
  }

  return value;
}

function sanitize(payload: LogPayload): LogPayload {
  const out: LogPayload = {};
  for (const [k, v] of Object.entries(payload)) {
    out[k] = redactValue(k, v);
  }
  return out;
}

export function log(level: LogLevel, event: string, payload: LogPayload = {}) {
  const entry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...sanitize(payload)
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}
