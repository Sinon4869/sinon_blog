import { getSiteUrl } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { buildPostPath } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = getSiteUrl('http://localhost:3000');
  const posts = await prisma.post.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' }, take: 30 });

  const items = posts
    .map((p) => {
      const image = (p as { cover_image?: string; background_image?: string }).cover_image || (p as { cover_image?: string; background_image?: string }).background_image;
      return `<item>
  <title><![CDATA[${p.title}]]></title>
  <link>${base}${buildPostPath(p)}</link>
  <guid>${p.id}</guid>
  <pubDate>${(p.publishedAt || p.createdAt).toUTCString()}</pubDate>
  <description><![CDATA[${p.excerpt || ''}]]></description>
  ${image ? `<enclosure url="${image}" type="image/jpeg" />` : ''}
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"><channel>
<title>Komorebi RSS</title>
<link>${base}</link>
<description>Komorebi Feed</description>
${items}
</channel></rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
