import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const posts = await prisma.post.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' }, take: 20 });

  const items = posts
    .map(
      (p) => `<item>
  <title><![CDATA[${p.title}]]></title>
  <link>${base}/posts/${p.slug}</link>
  <guid>${p.id}</guid>
  <pubDate>${(p.publishedAt || p.createdAt).toUTCString()}</pubDate>
  <description><![CDATA[${p.excerpt || ''}]]></description>
</item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"><channel>
<title>Modern Blog RSS</title>
<link>${base}</link>
<description>Modern Blog Feed</description>
${items}
</channel></rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
