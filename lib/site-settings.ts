import { prisma } from '@/lib/prisma';
import { ANONYMOUS_USER_EMAIL, SUPER_ADMIN_EMAIL } from '@/lib/constants';

export { SUPER_ADMIN_EMAIL, ANONYMOUS_USER_EMAIL };

export const SETTING_KEYS = {
  siteTitle: 'site_title',
  navCategories: 'nav_categories',
  registrationEnabled: 'registration_enabled',
  anonymousCommentEnabled: 'anonymous_comment_enabled'
} as const;

function parseBool(value: string | null | undefined, fallback: boolean) {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export async function isRegistrationEnabled() {
  const setting = await prisma.setting.get(SETTING_KEYS.registrationEnabled);
  return parseBool(setting?.value, true);
}

export async function isAnonymousCommentEnabled() {
  const setting = await prisma.setting.get(SETTING_KEYS.anonymousCommentEnabled);
  return parseBool(setting?.value, false);
}
