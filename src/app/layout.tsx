import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MediaMind - Personal Media Intelligence',
  description: 'AI-powered media tracking and analytics',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0B0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Dynamic import to avoid SSR issues
const MediaProvider = dynamic(
  () => import('@/providers/MediaProvider').then((mod) => mod.MediaProvider),
  { ssr: false }
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <MediaProvider>{children}</MediaProvider>
      </body>
    </html>
  );
}
