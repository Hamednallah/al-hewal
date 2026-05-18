import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import type { Locale } from '@/i18n/routing';
import type { AdminSessionPayload } from '@/lib/auth/session';

import {
  AdminsIcon,
  AnalyticsIcon,
  DashboardIcon,
  LeadsIcon,
  ListingsIcon,
  ProfileIcon,
  SignOutIcon,
} from './AdminIcons';
import { AdminNavLink } from './AdminNavLink';

interface AdminSidebarProps {
  locale: Locale;
  admin: AdminSessionPayload;
}

/**
 * Admin shell sidebar.
 *
 * Tier-driven nav: `standard_admin` sees Dashboard, Listings, Leads,
 * Analytics, Profile. `super_admin` adds "Admin Management" between
 * Analytics and Profile. RLS already enforces the same boundary on the
 * server — this filter is purely UX, not a security check.
 *
 * Sidebar uses the locked palette: charcoal background, brass accents,
 * canvas-tinted text. The active-link left border is brass on a teal
 * inset to match the Stitch mockup at admin_listing_management/screen.png.
 *
 * Server component: reads next-intl messages directly. The only client
 * code is the per-link active-state check inside AdminNavLink.
 */
export async function AdminSidebar({ locale, admin }: AdminSidebarProps) {
  const tNav = await getTranslations({ locale, namespace: 'admin.nav' });
  const tShell = await getTranslations({ locale, namespace: 'admin.shell' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const base = `/${locale}/admin`;
  const navItems = [
    { href: base, label: tNav('dashboard'), icon: <DashboardIcon />, matchSubpaths: false },
    { href: `${base}/properties`, label: tNav('listings'), icon: <ListingsIcon /> },
    { href: `${base}/leads`, label: tNav('leads'), icon: <LeadsIcon /> },
    { href: `${base}/analytics`, label: tNav('analytics'), icon: <AnalyticsIcon /> },
  ];

  if (admin.tier === 'super_admin') {
    navItems.push({
      href: `${base}/admins`,
      label: tNav('admins'),
      icon: <AdminsIcon />,
    });
  }

  navItems.push({
    href: `${base}/profile`,
    label: tNav('profile'),
    icon: <ProfileIcon />,
  });

  const displayName = admin.email.split('@')[0] ?? admin.email;

  return (
    <aside
      data-testid="admin-sidebar"
      className="bg-charcoal text-canvas flex h-screen w-64 shrink-0 flex-col justify-between py-8"
    >
      <div className="space-y-8 px-4">
        <header className="space-y-1 px-4">
          <div
            aria-hidden="true"
            className="bg-canvas/10 text-brass mb-3 flex h-12 w-12 items-center justify-center text-lg font-semibold uppercase"
          >
            {displayName.charAt(0)}
          </div>
          <p className="text-canvas text-base font-semibold">{tShell('title')}</p>
          <p className="text-canvas/60 text-xs tracking-[0.18em] uppercase">{tShell('subtitle')}</p>
        </header>

        <nav aria-label={tShell('navAriaLabel')}>
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <AdminNavLink
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  matchSubpaths={item.matchSubpaths ?? true}
                />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-canvas/15 border-t px-4 pt-6">
        <Link
          href={`/auth/sign-out?next=/${locale}`}
          prefetch={false}
          className="text-canvas/70 hover:bg-canvas/10 hover:text-canvas flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-colors"
        >
          <span className="shrink-0 rtl:scale-x-[-1]">
            <SignOutIcon />
          </span>
          {tCommon('signOut')}
        </Link>
      </div>
    </aside>
  );
}
