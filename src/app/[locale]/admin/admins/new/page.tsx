import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { InviteAdminForm } from '@/components/admin/InviteAdminForm';
import { type Locale, routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'admin.admins.invite' });
  return { title: t('pageTitle'), robots: { index: false, follow: false } };
}

/**
 * Invite-new-admin page (PR phase-3-admin-management-ui).
 *
 * Super_admin only. The form posts to /api/admins which issues a
 * Supabase Auth invite + inserts the matching public.admins row with
 * status='pending_invite'. The invitee clicks the email link and is
 * sent to /<locale>/auth/reset-password, which is the same page that
 * handles password recovery (the invite link shape and the recovery
 * link shape are identical — both carry `?code=…`).
 */
export default async function AdminAdminsNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const admin = await requireAdmin();
  if (admin.tier !== 'super_admin') {
    redirect(`/${locale}/admin`);
  }
  const typedLocale = locale as Locale;
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: 'admin.admins.invite' }),
    getTranslations({ locale, namespace: 'admin.common' }),
  ]);

  return (
    <>
      <AdminTopbar
        eyebrow={tCommon('superAdminOnly')}
        title={t('pageTitle')}
        subtitle={t('subtitle')}
      />
      <div className="flex-1 px-6 py-8 md:px-10">
        <div className="bg-canvas-raised border-outline-variant/30 mx-auto max-w-3xl border">
          <InviteAdminForm locale={typedLocale} />
        </div>
      </div>
    </>
  );
}
