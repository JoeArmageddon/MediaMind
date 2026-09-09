const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'image.tmdb.org',
      'cdn.myanimelist.net',
      'media.rawg.io',
      'books.google.com',
      'lh3.googleusercontent.com',
      'images.igdb.com',
      'upload.wikimedia.org',
      'i.imgur.com',
      'images.justwatch.com',
    ],
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // MIME-sniffing protection - a response served as e.g. text/plain
          // (a user-supplied title, a JSON API response) never gets
          // reinterpreted by the browser as HTML/JS.
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Clickjacking protection - nothing else is allowed to frame this
          // app. SAMEORIGIN rather than DENY only because it's the more
          // conservative choice for an app that doesn't need to be framed
          // by anyone, including itself - functionally equivalent here.
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // Don't leak the full URL (which can carry invite codes, media
          // titles, etc. in the path) to third-party sites a user clicks
          // through to - still sends the origin, which is enough for
          // normal referrer-based analytics.
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // This app never needs camera/mic/geolocation/payment access -
          // explicitly denying them means an XSS or a compromised
          // dependency can't silently prompt for one.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
    ];
    // A full Content-Security-Policy is deliberately not added here yet -
    // this app's real external surface (Clerk's auth flow/scripts,
    // Supabase's REST + realtime websocket, direct client-side calls to
    // TMDB/RAWG/Jikan/Google Books/Gemini/Groq, several image CDNs) needs
    // a carefully built script-src/connect-src/img-src allowlist, and
    // getting it wrong silently breaks sign-in or search rather than
    // failing loudly - not something to ship without a live, signed-in
    // test pass. Worth a dedicated follow-up, not bundled into this one.
  },
};

module.exports = withPWA(nextConfig);
