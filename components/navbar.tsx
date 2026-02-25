/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NavbarClient } from '@/components/navbar-client';

type NavTag = { id: string; name: string; slug: string };


export async function Navbar() {
  let session: any = null;
  let tags: NavTag[] = [];
  let siteTitle = 'Komorebi';
  let siteIcon = '木';
  let siteIconUrl = '';

  try {
    const [rawSession, rawTags, titleSetting, iconSetting, iconUrlSetting] = await Promise.all([
      getServerSession(authOptions),
      prisma.tag.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { sort_order: 'asc' },
        take: 12
      }),
      prisma.setting.get('site_title'),
      prisma.setting.get('site_icon'),
      prisma.setting.get('site_icon_url')
    ]);
    session = rawSession;
    tags = (rawTags as Array<Record<string, unknown>>).map((t) => ({
      id: String(t.id || ''),
      name: String(t.name || ''),
      slug: String(t.slug || '')
    }));
    siteTitle = String(titleSetting?.value || '').trim() || 'Komorebi';
    siteIcon = String(iconSetting?.value || '').trim() || '木';
    siteIconUrl = String(iconUrlSetting?.value || '').trim();
  } catch {
    session = null;
    tags = [];
    siteTitle = 'Komorebi';
    siteIcon = '木';
    siteIconUrl = '';
  }

  const sessionData = session?.user
    ? {
        id: String(session.user.id || ''),
        role: String(session.user.role || 'USER')
      }
    : null;

  return <NavbarClient siteTitle={siteTitle} siteIcon={siteIcon} siteIconUrl={siteIconUrl} tags={tags} session={sessionData} />;
}

