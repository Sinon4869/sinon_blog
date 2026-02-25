import { prisma } from '@/lib/prisma';
import { ANONYMOUS_USER_EMAIL, SUPER_ADMIN_EMAIL } from '@/lib/constants';

export { SUPER_ADMIN_EMAIL, ANONYMOUS_USER_EMAIL };

export const SETTING_KEYS = {
  siteTitle: 'site_title',
  siteIcon: 'site_icon',
  navCategories: 'nav_categories',
  registrationEnabled: 'registration_enabled',
  anonymousCommentEnabled: 'anonymous_comment_enabled',
  profileName: 'profile_name',
  profileBio: 'profile_bio',
  profileAvatar: 'profile_avatar',
  profileLinks: 'profile_links'
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

export async function getPersonalIntro() {
  const [name, bio, avatar, linksRaw] = await Promise.all([
    prisma.setting.get(SETTING_KEYS.profileName),
    prisma.setting.get(SETTING_KEYS.profileBio),
    prisma.setting.get(SETTING_KEYS.profileAvatar),
    prisma.setting.get(SETTING_KEYS.profileLinks)
  ]);

  let links: Array<{ label: string; url: string }> = [];
  try {
    const parsed = JSON.parse(String(linksRaw?.value || '[]'));
    if (Array.isArray(parsed)) {
      links = parsed
        .map((x) => ({ label: String(x?.label || '').trim(), url: String(x?.url || '').trim() }))
        .filter((x) => x.label && x.url)
        .slice(0, 6);
    }
  } catch {}

  return {
    name: String(name?.value || '').trim(),
    bio: String(bio?.value || '').trim(),
    avatar: String(avatar?.value || '').trim(),
    links
  };
}
