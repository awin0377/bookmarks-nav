import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '书签导航 — Bookmarks Hub',
  description: '1000+ 精选书签，一键直达',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
