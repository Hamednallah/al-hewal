import { createNavigation } from 'next-intl/navigation';

import { routing } from '@/i18n/routing';

/**
 * Locale-aware navigation primitives. Always import `Link`, `redirect`,
 * `usePathname`, and `useRouter` from here — never from `next/link` or
 * `next/navigation` directly — so the active locale prefix is preserved
 * across navigations.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
