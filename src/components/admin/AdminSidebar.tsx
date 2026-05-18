import type { Locale } from '@/i18n/routing';
import type { AdminSessionPayload } from '@/lib/auth/session';

import { AdminSidebarContent } from './AdminSidebarContent';

interface AdminSidebarProps {
  locale: Locale;
  admin: AdminSessionPayload;
}

/**
 * Desktop admin sidebar (≥ md viewports). On smaller screens it stays
 * hidden — `AdminMobileMenu` renders the same content inside a Radix
 * Dialog with a hamburger trigger, mirroring the public site's
 * `MobileDrawer` pattern.
 */
export async function AdminSidebar({ locale, admin }: AdminSidebarProps) {
  return (
    <aside
      data-testid="admin-sidebar"
      className="sticky top-0 hidden h-screen w-64 shrink-0 md:flex"
    >
      <AdminSidebarContent locale={locale} admin={admin} />
    </aside>
  );
}
