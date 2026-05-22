import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import type { KpiSnapshot } from '@/lib/data/admin-analytics';

interface AnalyticsKpiCardsProps {
  locale: Locale;
  snapshot: KpiSnapshot;
}

/**
 * Four KPI cards across the top of the analytics dashboard. Server
 * component — no state, no interactivity. Visual shape mirrors the
 * `SummaryCard` already used on `/admin` (Brass label, Forest Teal
 * value, off-white background with a thin outline-variant border).
 */
export async function AnalyticsKpiCards({ locale, snapshot }: AnalyticsKpiCardsProps) {
  const t = await getTranslations({ locale, namespace: 'admin.analytics.kpi' });

  const topProperty = snapshot.topPropertyByLeads;
  const topLabel = topProperty
    ? locale === 'ar'
      ? topProperty.titleAr
      : topProperty.titleEn
    : null;

  return (
    <section
      aria-labelledby="analytics-kpi-heading"
      className="bg-canvas-raised border-outline-variant/30 border p-6 md:p-8"
    >
      <h2 id="analytics-kpi-heading" className="sr-only">
        {t('heading')}
      </h2>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={t('leadsLast30Days')} value={String(snapshot.leadsLast30Days)} />
        <Card label={t('whatsappLast30Days')} value={String(snapshot.whatsappClicksLast30Days)} />
        <Card label={t('publishedProperties')} value={String(snapshot.publishedProperties)} />
        <Card
          label={t('topProperty')}
          value={topLabel ?? t('topPropertyEmpty')}
          subtitle={topProperty ? t('leadsBadge', { count: topProperty.leadCount }) : null}
        />
      </dl>
    </section>
  );
}

interface CardProps {
  label: string;
  value: string;
  subtitle?: string | null;
}

function Card({ label, value, subtitle = null }: CardProps) {
  return (
    <div className="border-outline-variant/40 flex flex-col gap-2 border p-4">
      <dt className="text-brass-700 text-sm font-semibold tracking-[0.2em] uppercase">{label}</dt>
      <dd className="text-teal-forest-700 text-2xl font-semibold break-words md:text-3xl">
        {value}
      </dd>
      {subtitle ? <p className="text-charcoal-muted text-xs">{subtitle}</p> : null}
    </div>
  );
}
