import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AdminsTable } from '@/components/admin/AdminsTable';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/button';
import { type Locale, routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';
import { listAdmins } from '@/lib/data/admins';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'admin.pages.admins' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Admin Management — super_admin tier only.
 *
 * Replaces the PR #16 placeholder. Lists every admin with tier + status
 * badges and the row actions a super_admin needs to manage them
 * (promote / demote / deactivate / reactivate). The "+ Invite admin"
 * CTA in the topbar jumps to the dedicated invite page.
 *
 * Belt-and-suspenders: the sidebar hides this from standard_admin, the
 * page redirects them on direct navigation, and every action route
 * re-checks the tier server-side. RLS would also block at the data
 * layer but `listAdmins` uses the service-role client (we need to show
 * pending_invite rows that anon RLS would hide).
 */
export default async function AdminAdminsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const admin = await requireAdmin();
  if (admin.tier !== 'super_admin') {
    redirect(`/${locale}/admin`);
  }
  const typedLocale = locale as Locale;
  const basePath = `/${typedLocale}/admin/admins`;

  const [rows, t, tCommon, tEmpty] = await Promise.all([
    listAdmins(),
    getTranslations({ locale, namespace: 'admin.pages.admins' }),
    getTranslations({ locale, namespace: 'admin.common' }),
    getTranslations({ locale, namespace: 'admin.admins.empty' }),
  ]);

  return (
    <>
      <AdminTopbar
        eyebrow={tCommon('superAdminOnly')}
        title={t('title')}
        subtitle={t('subtitleWithCount', { total: rows.length })}
        actions={
          <Button asChild variant="secondary" size="md">
            <Link href={`${basePath}/new`} prefetch={false}>
              + {tCommon('inviteAdmin')}
            </Link>
          </Button>
        }
      />
      <div className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-screen-2xl">
          {rows.length === 0 ? (
            <section
              data-testid="admins-empty"
              className="bg-canvas-raised border-outline-variant/30 flex flex-col items-center gap-4 border p-12 text-center"
            >
              <h2 className="text-teal-forest-700 text-xl font-semibold">{tEmpty('title')}</h2>
              <p className="text-charcoal-muted max-w-md text-sm leading-relaxed">
                {tEmpty('body')}
              </p>
              <Button asChild variant="secondary" size="md" className="mt-2">
                <Link href={`${basePath}/new`} prefetch={false}>
                  + {tEmpty('ctaLabel')}
                </Link>
              </Button>
            </section>
          ) : (
            <AdminsTable locale={typedLocale} rows={rows} selfId={admin.sub} />
          )}
        </div>
      </div>
    </>
  );
}
