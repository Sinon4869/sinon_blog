import type { Metadata, Viewport } from 'next';
import './globals.css';

import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'Komorebi',
  description: 'Next.js 14 现代博客系统'
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
