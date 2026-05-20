import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { LeadsFilterBar } from '@/components/admin/LeadsFilterBar';
import { LeadsPagination } from '@/components/admin/LeadsPagination';
import { LeadsTable } from '@/components/admin/LeadsTable';
import { type Locale, routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';
import {
  getLeadsDistinctProperties,
  listLeads,
  parseAdminLeadFilters,
} from '@/lib/data/admin-leads';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'admin.pages.leads' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Admin Leads Journal (PR 3.6).
 *
 * Chronological timeline of every inbound contact attempt — WhatsApp
 * taps (POST /api/whatsapp/track), contact-form submissions
 * (POST /api/leads), and call clicks — with per-row mark-contacted
 * toggle, inline notes editor, copy-phone, and a WhatsApp shortcut.
 *
 * The bilingual PDF export and the cross-property "Send to my email"
 * shortcuts are queued for a follow-up PR. The data layer + PATCH
 * route are already in place and ready to feed them.
 */
export default async function AdminLeadsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await requireAdmin();
  const typedLocale = locale as Locale;
  const basePath = `/${typedLocale}/admin/leads`;

  const raw = await searchParams;
  const filters = parseAdminLeadFilters(raw);

  const [{ items, total, totalPages }, properties, t, tCommon, tEmpty] = await Promise.all([
    listLeads(filters),
    getLeadsDistinctProperties(),
    getTranslations({ locale: typedLocale, namespace: 'admin.pages.leads' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.leads.empty' }),
  ]);

  const hasActiveFilter = Boolean(
    filters.propertyId || filters.source || filters.inquiryType || filters.contacted,
  );
  const subtitle = total > 0 ? t('subtitleWithCount', { total }) : t('subtitle');

  return (
    <>
      <AdminTopbar eyebrow={tCommon('section')} title={t('title')} subtitle={subtitle} />
      <LeadsFilterBar locale={typedLocale} filters={filters} properties={properties} />
      <div className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-screen-2xl">
          {items.length === 0 ? (
            <EmptyState
              title={tEmpty('title')}
              body={hasActiveFilter ? tEmpty('filtered') : tEmpty('body')}
            />
          ) : (
            <LeadsTable locale={typedLocale} leads={items} />
          )}
          <LeadsPagination
            locale={typedLocale}
            filters={filters}
            totalPages={totalPages}
            totalRows={total}
            basePath={basePath}
          />
        </div>
      </div>
    </>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
}

function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <section
      data-testid="admin-leads-empty"
      className="bg-canvas-raised border-outline-variant/30 flex flex-col items-center gap-4 border p-12 text-center"
    >
      <h2 className="text-teal-forest-700 text-xl font-semibold">{title}</h2>
      <p className="text-charcoal-muted max-w-md text-sm leading-relaxed">{body}</p>
    </section>
  );
}
