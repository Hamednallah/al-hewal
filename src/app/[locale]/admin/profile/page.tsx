import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { ProfileEmailForm } from '@/components/admin/ProfileEmailForm';
import { ProfilePasswordForm } from '@/components/admin/ProfilePasswordForm';
import { type Locale, routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';
import { getAdminById } from '@/lib/data/admins';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'admin.pages.profile' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Admin My Profile page. Replaces the Phase 3 placeholder. Surfaces:
 *
 *   1. Identity block — email, tier, status, last sign-in, member since.
 *      Last-login + member-since come from `public.admins` (not the
 *      session cookie, which only carries the four short-lived fields).
 *   2. Change-email form — POSTs to the `changeEmail` server action.
 *      Supabase emails a confirmation to the new address; sign-in
 *      stays on the old address until that link is clicked.
 *   3. Change-password form — POSTs to the `changePassword` server
 *      action. Mirrors `/auth/reset-password`'s flow; the user stays
 *      signed in on this device.
 */
export default async function AdminProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const admin = await requireAdmin();
  const typedLocale = locale as Locale;

  const [adminRow, tPage, tCommon, tIdentity, tAdmins] = await Promise.all([
    getAdminById(admin.sub),
    getTranslations({ locale: typedLocale, namespace: 'admin.pages.profile' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.profile.identity' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.admins' }),
  ]);

  // Format dates in the page locale. Falls back to ISO if the date
  // is unparseable (defence against weird server-clock states).
  const formatDate = (iso: string | null): string => {
    if (!iso) return tIdentity('lastLoginNever');
    try {
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return iso;
      return new Intl.DateTimeFormat(typedLocale === 'ar' ? 'ar-SA' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(dt);
    } catch {
      return iso;
    }
  };

  return (
    <>
      <AdminTopbar
        eyebrow={tCommon('section')}
        title={tPage('title')}
        subtitle={tPage('subtitle')}
      />

      <div className="mx-auto mt-6 mb-12 flex w-full max-w-3xl flex-col gap-6 px-4 md:px-0">
        <section
          aria-labelledby="profile-identity-heading"
          data-testid="profile-identity"
          className="bg-canvas-raised border-outline-variant/30 border p-5 md:p-6"
        >
          <h2
            id="profile-identity-heading"
            className="text-teal-forest-700 text-sm font-semibold tracking-[0.2em] uppercase"
          >
            {tIdentity('heading')}
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <IdentityField label={tIdentity('emailLabel')} value={admin.email} dir="ltr" />
            <IdentityField label={tIdentity('tierLabel')} value={tAdmins(`tier.${admin.tier}`)} />
            <IdentityField
              label={tIdentity('statusLabel')}
              value={tAdmins(`status.${admin.status}`)}
            />
            <IdentityField
              label={tIdentity('lastLoginLabel')}
              value={formatDate(adminRow?.last_login_at ?? null)}
            />
            <IdentityField
              label={tIdentity('memberSinceLabel')}
              value={formatDate(adminRow?.created_at ?? null)}
            />
          </dl>
        </section>

        <ProfileEmailForm currentEmail={admin.email} />
        <ProfilePasswordForm />
      </div>
    </>
  );
}

interface IdentityFieldProps {
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
}

function IdentityField({ label, value, dir }: IdentityFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-brass-700 text-xs font-semibold tracking-[0.2em] uppercase">{label}</dt>
      <dd className="text-charcoal text-base break-words" dir={dir}>
        {value}
      </dd>
    </div>
  );
}
