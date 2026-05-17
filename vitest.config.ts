import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration.
 *
 * - happy-dom is used over jsdom for speed (~3x faster) and is sufficient
 *   for React Testing Library queries.
 * - `server-only` is aliased to a no-op stub because vitest runs in a
 *   plain Node environment, not a React Server Component context — the
 *   real package throws on import outside of an RSC.
 * - Coverage gate is 80% across statements/branches/functions/lines, matching
 *   the project rule. Coverage focuses on files that contain real logic;
 *   thin wrappers around third-party libraries (next-intl middleware,
 *   supabase clients, font loaders) are exercised by integration / e2e
 *   tests rather than unit tests, so excluding them here keeps the gate
 *   meaningful instead of forcing trivial assertions.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/__mocks__/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/lib/supabase/database.types.ts',
        'src/**/*.config.{ts,mjs}',
        'src/i18n/messages/**',
        'src/lib/fonts.ts',
        'src/middleware.ts',
        'src/i18n/navigation.ts',
        'src/i18n/request.ts',
        'src/lib/supabase/server.ts',
        'src/lib/supabase/client.ts',
        'src/lib/supabase/admin.ts',
        'src/app/**/{layout,page,not-found,error,global-error,opengraph-image,sitemap,robots,manifest}.{ts,tsx}',
        'src/app/**/route.{ts,tsx}',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
