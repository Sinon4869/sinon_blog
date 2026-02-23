import type { Metadata, Viewport } from 'next';
import './globals.css';

import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sinon.live'),
  title: 'Komorebi',
  description: 'Next.js 现代博客系统',
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
        <Navbar />
        <main className="container-page">{children}</main>
      </body>
    </html>
  );
}
