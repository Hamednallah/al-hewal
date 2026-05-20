import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { AnalyticsBarChart, type AnalyticsBarDatum } from '@/components/admin/AnalyticsBarChart';
import { AnalyticsKpiCards } from '@/components/admin/AnalyticsKpiCards';
import { AnalyticsLineChart } from '@/components/admin/AnalyticsLineChart';
import { routing, type Locale } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';
import {
  getKpiSnapshot,
  getLeadsBySource,
  getLeadsPerDay,
  getTopCities,
} from '@/lib/data/admin-analytics';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'admin.pages.analytics' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Strategic Analytics dashboard. Server component that fans out four
 * Supabase reads in parallel (KPI snapshot + the three chart series)
 * and hands the resulting plain arrays to the chart client
 * components. No client-side fetching — everything renders server-
 * side first paint, then the chart components hydrate to enable
 * tooltips + responsive sizing.
 */
export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await requireAdmin();
  const typedLocale = locale as Locale;

  const [snapshot, leadsPerDay, leadsBySource, topCities] = await Promise.all([
    getKpiSnapshot(),
    getLeadsPerDay(),
    getLeadsBySource(),
    getTopCities(),
  ]);

  const [t, tCommon, tCharts, tSources] = await Promise.all([
    getTranslations({ locale: typedLocale, namespace: 'admin.pages.analytics' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.analytics.charts' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.analytics.sources' }),
  ]);

  const dir = typedLocale === 'ar' ? 'rtl' : 'ltr';

  const sourceData: AnalyticsBarDatum[] = leadsBySource.map((row) => ({
    label: tSources(row.source),
    value: row.leadCount,
  }));
  const citiesData: AnalyticsBarDatum[] = topCities.map((row) => ({
    label: row.city,
    value: row.leadCount,
  }));

  return (
    <>
      <AdminTopbar eyebrow={tCommon('section')} title={t('title')} subtitle={t('subtitle')} />
      <div className="mx-auto mt-6 mb-12 flex w-full max-w-6xl flex-col gap-6 px-4 md:px-0">
        <AnalyticsKpiCards locale={typedLocale} snapshot={snapshot} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title={tCharts('leadsPerDayTitle')}>
            <AnalyticsLineChart
              data={leadsPerDay}
              axisDateLabel={tCharts('axisDate')}
              axisLeadCountLabel={tCharts('axisLeadCount')}
              emptyMessage={tCharts('emptyMessage')}
              dir={dir}
            />
          </ChartCard>
          <ChartCard title={tCharts('leadsBySourceTitle')}>
            <AnalyticsBarChart
              data={sourceData}
              ariaLabel={tCharts('leadsBySourceTitle')}
              emptyMessage={tCharts('emptyMessage')}
              dir={dir}
            />
          </ChartCard>
        </div>

        <ChartCard title={tCharts('topCitiesTitle')}>
          <AnalyticsBarChart
            data={citiesData}
            ariaLabel={tCharts('topCitiesTitle')}
            emptyMessage={tCharts('emptyMessage')}
            dir={dir}
          />
        </ChartCard>
      </div>
    </>
  );
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <section className="bg-canvas-raised border-outline-variant/30 flex flex-col gap-3 border p-5 md:p-6">
      <h2 className="text-teal-forest-700 text-sm font-semibold tracking-[0.2em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
