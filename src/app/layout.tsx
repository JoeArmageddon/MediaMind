import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';
import { ClerkProvider } from '@clerk/nextjs';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MediaMind - Personal Media Intelligence',
  description: 'AI-powered media tracking and analytics',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    // Safari doesn't reliably render SVG apple-touch-icons - needs a real PNG.
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
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
const AuthSync = dynamic(
  () => import('@/providers/AuthSync').then((mod) => mod.AuthSync),
  { ssr: false }
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#7C5CFF',
          colorBackground: '#111118',
          colorInputBackground: '#0B0B0F',
          colorText: '#ffffff',
          borderRadius: '0.75rem',
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={inter.className}>
          <AuthSync />
          <MediaProvider>{children}</MediaProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
