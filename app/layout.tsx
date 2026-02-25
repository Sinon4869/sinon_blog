import type { Metadata, Viewport } from 'next';
import './globals.css';

import { CommandPalette } from '@/components/command-palette';
import { Navbar } from '@/components/navbar';
import { PageVisitTracker } from '@/components/page-visit-tracker';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';

function resolveMetadataBase() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!raw) return new URL('https://sinon.live');
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return new URL('https://sinon.live');
    }
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: 'Komorebi',
  description: 'Next.js 现代博客系统',
  icons: {
    icon: '/api/site-icon',
    shortcut: '/api/site-icon',
    apple: '/api/site-icon'
  },
  openGraph: {
    title: 'Komorebi',
    description: 'Next.js 现代博客系统',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Komorebi',
    description: 'Next.js 现代博客系统'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fafafa'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="page-shell min-h-screen">
          <WebVitalsReporter />
          <PageVisitTracker />
          <CommandPalette />
          <Navbar />
          <main className="container-page">{children}</main>
        </div>
      </body>
    </html>
  );
}
