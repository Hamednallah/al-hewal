'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface AdminNavLinkProps {
  href: string;
  label: string;
  icon: ReactNode;
  /**
   * When true, the link is treated as a "section root" and matches active
   * for `pathname === href` OR `pathname.startsWith(href + '/')`. The
   * Dashboard link (`/<locale>/admin`) sets this to FALSE so the catch-all
   * doesn't light up Dashboard on every admin sub-route.
   */
  matchSubpaths?: boolean;
}

/**
 * Sidebar nav link. Client component because it reads `usePathname()` to
 * compute the active state — that's the only client-side bit; the parent
 * sidebar stays a server component.
 *
 * RTL: when the layout flips, the active-state left border becomes the
 * right border via the logical `border-s-4` (start-side border).
 */
export function AdminNavLink({ href, label, icon, matchSubpaths = true }: AdminNavLinkProps) {
  const pathname = usePathname();
  const isActive = matchSubpaths
    ? pathname === href || pathname.startsWith(`${href}/`)
    : pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      prefetch={false}
      className={cn(
        'flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-colors',
        isActive
          ? 'bg-teal-forest-700 border-brass text-canvas border-s-4'
          : 'text-canvas/70 hover:bg-canvas/10 hover:text-canvas',
      )}
    >
      <span className="shrink-0 rtl:scale-x-[-1]">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
