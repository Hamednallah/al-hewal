import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * ESLint 9 flat config.
 *
 * `eslint-config-next` v15 is a legacy (eslintrc) preset, so it is loaded
 * through `@eslint/eslintrc`'s FlatCompat shim. When Next 16 ships a
 * native flat-config export and we bump our pinned Next, replace this
 * with a direct import.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'next-env.d.ts',
      'src/lib/supabase/database.types.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/supabase/admin', '@/lib/supabase/admin'],
              message:
                'Do not import the service-role Supabase client. Use the server or browser client instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Files that LEGITIMATELY need the service-role client:
    //  - admin.ts itself defines/exports it
    //  - API route handlers under src/app/api/** perform server-side
    //    writes (analytics, lead inserts, audit) that bypass RLS
    //  - src/lib/audit.ts writes admin_audit_log entries via the
    //    service-role client; same rationale as the route handlers
    //  - src/lib/data/admin-*.ts admin-only data readers need the
    //    service-role client to see drafts + archived rows that anon
    //    RLS hides. Each consumer is gated by `requireAdmin()` at the
    //    page boundary; the file naming convention prevents accidental
    //    drift into public surfaces.
    files: [
      'src/lib/supabase/admin.ts',
      'src/lib/audit.ts',
      'src/app/api/**/*.ts',
      'src/app/**/route.ts',
      'src/lib/data/admin-*.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: { 'no-console': 'off' },
  },
];

export default config;