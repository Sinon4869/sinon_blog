/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { NavbarClient } from '@/components/navbar-client';

type NavTag = { id: string; name: string; slug: string };

function parseConfiguredCategories(value: string) {
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 20);
    }
  } catch {
    // fallback for legacy values
  }
  return raw
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function Navbar() {
  let session: any = null;
  let tags: NavTag[] = [];
  let siteTitle = 'Komorebi';
  let siteIcon = '木';

  try {
    const [rawSession, rawTags, titleSetting, iconSetting, categoriesSetting] = await Promise.all([
      getServerSession(authOptions),
      prisma.tag.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
        take: 8
      }),
      prisma.setting.get('site_title'),
      prisma.setting.get('site_icon'),
      prisma.setting.get('nav_categories')
    ]);
    session = rawSession;
    const dbTags = (rawTags as Array<Record<string, unknown>>).map((t) => ({
      id: String(t.id || ''),
      name: String(t.name || ''),
      slug: String(t.slug || '')
    }));
    const configuredNames = parseConfiguredCategories(String(categoriesSetting?.value || ''));
    tags =
      configuredNames.length > 0
        ? configuredNames.map((name, i) => ({ id: `cfg-${i}`, name, slug: slugify(name) || name }))
        : dbTags;
    siteTitle = String(titleSetting?.value || '').trim() || 'Komorebi';
    siteIcon = String(iconSetting?.value || '').trim() || '木';
  } catch {
    session = null;
    tags = [];
    siteTitle = 'Komorebi';
    siteIcon = '木';
  }

  const sessionData = session?.user
    ? {
        id: String(session.user.id || ''),
        role: String(session.user.role || 'USER')
      }
    : null;

  return <NavbarClient siteTitle={siteTitle} siteIcon={siteIcon} tags={tags} session={sessionData} />;
}

