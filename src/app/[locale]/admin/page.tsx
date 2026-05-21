import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';
import { getKpiSnapshot } from '@/lib/data/admin-analytics';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return { robots: { index: false, follow: false } };
  }
  const t = await getTranslations({ locale, namespace: 'admin.pages.dashboard' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

/**
 * Admin dashboard root. Used to be a placeholder paragraph; this
 * rewrite (PR 5-A polish) gives every admin a useful landing page:
 *
 *   1. Identity strip — Forest Teal cards showing who's signed in.
 *   2. KPI strip (last 30 days) — reuses `getKpiSnapshot` from the
 *      analytics dashboard. Empty-state shows zeros gracefully when
 *      production has no data yet.
 *   3. Quick-action tiles — links to the four major admin surfaces
 *      (+ Admin Management for super_admin, + My Profile for
 *      everyone).
 *
 * Force-dynamic because the KPIs are live counts. Sub-millisecond
 * at Al Hewal's scale; we're already inside the admin route group
 * which is force-dynamic by default.
 */
export default async function AdminDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const admin = await requireAdmin();
  const typedLocale = locale as Locale;

  const [snapshot, t, tCommon, tAdmins, tKpi] = await Promise.all([
    getKpiSnapshot(),
    getTranslations({ locale: typedLocale, namespace: 'admin.pages.dashboard' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.admins' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.analytics.kpi' }),
  ]);

  const isSuperAdmin = admin.tier === 'super_admin';
  const topProperty = snapshot.topPropertyByLeads;
  const topLabel = topProperty
    ? typedLocale === 'ar'
      ? topProperty.titleAr
      : topProperty.titleEn
    : null;

  return (
    <>
      <AdminTopbar eyebrow={tCommon('overview')} title={t('title')} subtitle={t('subtitle')} />

      <div className="mx-auto mt-6 mb-12 flex w-full max-w-5xl flex-col gap-6 px-4 md:px-0">
        {/* Identity strip — who am I, what tier, what status. */}
        <section
          aria-label={t('welcomeLabel')}
          className="bg-canvas-raised border-outline-variant/30 grid w-full gap-6 border p-6 md:grid-cols-3 md:p-8"
        >
          <SummaryCard label={t('welcomeLabel')} value={admin.email} dir="ltr" />
          <SummaryCard label={t('tierLabel')} value={tAdmins(`tier.${admin.tier}`)} />
          <SummaryCard label={t('statusLabel')} value={tAdmins(`status.${admin.status}`)} />
        </section>

        {/* KPI strip — last 30 days. Same data as /admin/analytics. */}
        <section
          aria-labelledby="dashboard-kpi-heading"
          className="bg-canvas-raised border-outline-variant/30 flex flex-col gap-4 border p-6 md:p-8"
        >
          <div className="flex items-center justify-between gap-4">
            <h2
              id="dashboard-kpi-heading"
              className="text-teal-forest-700 text-sm font-semibold tracking-[0.2em] uppercase"
            >
              {t('kpiHeading')}
            </h2>
            <Link
              href="/admin/analytics"
              className="text-brass-700 hover:text-teal-forest-700 text-xs font-semibold tracking-[0.15em] uppercase underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {t('kpiViewAll')}
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiTile label={tKpi('leadsLast30Days')} value={String(snapshot.leadsLast30Days)} />
            <KpiTile
              label={tKpi('whatsappLast30Days')}
              value={String(snapshot.whatsappClicksLast30Days)}
            />
            <KpiTile
              label={tKpi('publishedProperties')}
              value={String(snapshot.publishedProperties)}
            />
            <KpiTile
              label={tKpi('topProperty')}
              value={topLabel ?? tKpi('topPropertyEmpty')}
              subtitle={topProperty ? tKpi('leadsBadge', { count: topProperty.leadCount }) : null}
            />
          </dl>
        </section>

        {/* Quick actions — tile grid linking to the major surfaces. */}
        <section
          aria-labelledby="dashboard-actions-heading"
          className="bg-canvas-raised border-outline-variant/30 flex flex-col gap-4 border p-6 md:p-8"
        >
          <h2
            id="dashboard-actions-heading"
            className="text-teal-forest-700 text-sm font-semibold tracking-[0.2em] uppercase"
          >
            {t('quickActionsHeading')}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ActionTile
              href="/admin/properties"
              title={t('quickActions.properties.title')}
              description={t('quickActions.properties.description')}
            />
            <ActionTile
              href="/admin/leads"
              title={t('quickActions.leads.title')}
              description={t('quickActions.leads.description')}
            />
            <ActionTile
              href="/admin/analytics"
              title={t('quickActions.analytics.title')}
              description={t('quickActions.analytics.description')}
            />
            {isSuperAdmin ? (
              <ActionTile
                href="/admin/admins"
                title={t('quickActions.admins.title')}
                description={t('quickActions.admins.description')}
              />
            ) : null}
            <ActionTile
              href="/admin/profile"
              title={t('quickActions.profile.title')}
              description={t('quickActions.profile.description')}
            />
          </div>
        </section>
      </div>
    </>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
}

function SummaryCard({ label, value, dir }: SummaryCardProps) {
  return (
    <div className="border-outline-variant/40 flex flex-col gap-2 border p-4">
      <p className="text-brass-700 text-xs font-semibold tracking-[0.2em] uppercase">{label}</p>
      <p className="text-teal-forest-700 text-base font-semibold break-words" dir={dir}>
        {value.replace('_', ' ')}
      </p>
    </div>
  );
}

interface KpiTileProps {
  label: string;
  value: string;
  subtitle?: string | null;
}

function KpiTile({ label, value, subtitle = null }: KpiTileProps) {
  return (
    <div className="border-outline-variant/40 flex flex-col gap-1 border p-3">
      <dt className="text-brass-700 text-xs font-semibold tracking-[0.15em] uppercase">{label}</dt>
      <dd className="text-teal-forest-700 text-xl font-semibold break-words md:text-2xl">
        {value}
      </dd>
      {subtitle ? <p className="text-charcoal-muted text-xs">{subtitle}</p> : null}
    </div>
  );
}

interface ActionTileProps {
  href: string;
  title: string;
  description: string;
}

function ActionTile({ href, title, description }: ActionTileProps) {
  return (
    <Link
      href={href}
      className="border-outline-variant/40 hover:border-brass-400 hover:bg-canvas focus-visible:border-brass-400 group flex flex-col gap-1 border p-4 transition-colors focus-visible:outline-none"
    >
      <p className="text-teal-forest-700 group-hover:text-brass-700 text-sm font-semibold">
        {title}
      </p>
      <p className="text-charcoal-muted text-xs leading-relaxed">{description}</p>
    </Link>
  );
}
