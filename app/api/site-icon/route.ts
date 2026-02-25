import { prisma } from '@/lib/prisma';
import { SETTING_KEYS } from '@/lib/site-settings';

export const runtime = 'nodejs';

function esc(input: string) {
  return input.replace(/[&<>'"]/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case "'":
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return ch;
    }
  });
}

export async function GET() {
  const iconUrl = String((await prisma.setting.get(SETTING_KEYS.siteIconUrl))?.value || '').trim();
  if (iconUrl) {
    if (iconUrl.startsWith('/')) {
      return new Response(null, { status: 302, headers: { Location: iconUrl } });
    }
    try {
      const u = new URL(iconUrl);
      if (['http:', 'https:'].includes(u.protocol)) {
        return Response.redirect(u.toString(), 302);
      }
    } catch {}
  }

  const iconRaw = String((await prisma.setting.get(SETTING_KEYS.siteIcon))?.value || '').trim();
  const icon = (iconRaw || '木').slice(0, 2);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#e7e5dd" stroke="#cfcabf"/>
  <text x="32" y="40" text-anchor="middle" font-size="30" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${esc(icon)}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
