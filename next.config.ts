import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Image optimization — Next handles AVIF/WebP transforms and responsive
  // srcset at request time. Source images live on Vercel Blob; we only
  // allow loading from our own Blob store and (for the favicon) the local
  // origin. Add any future image origin here intentionally.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
    // Cap the device sizes so Next does not generate gigantic variants we
    // never serve. Real-estate cards top out around 1600px.
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Strip Node-only modules from the client bundle and keep server-only
  // markers honoured.
  serverExternalPackages: ['sharp'],

  // Surface ESLint failures during `next build` as errors. The CI pipeline
  // runs `pnpm lint` separately, but this is a belt-and-braces guard.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withNextIntl(nextConfig);
