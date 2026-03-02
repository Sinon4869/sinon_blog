import { z } from 'zod';

const envSchema = z.object({
  AUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().min(1).optional(),
  GOOGLE_ID: z.string().min(1).optional(),
  GOOGLE_SECRET: z.string().min(1).optional(),
  ADMIN_EMAILS: z.string().optional(),
  NOTION_TOKEN: z.string().min(1).optional(),
  NOTION_DATABASE_ID: z.string().min(1).optional(),
  NOTION_SYNC_TOKEN: z.string().min(1).optional(),
  NOTION_WEBHOOK_TOKEN: z.string().min(1).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment variables: ${message}`);
}

export const env = parsed.data;

export function getSiteUrl(defaultUrl = 'https://sinon.live') {
  return (env.NEXT_PUBLIC_SITE_URL || '').trim() || defaultUrl;
}

export function getNotionWebhookOrSyncToken() {
  return env.NOTION_WEBHOOK_TOKEN || env.NOTION_SYNC_TOKEN || '';
}
