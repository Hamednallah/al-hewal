import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import {
  type AdminLeadFilters,
  type AdminLeadPropertyOption,
  LEAD_CONTACTED_FILTERS,
  LEAD_INQUIRY_TYPES,
  LEAD_SOURCES,
  serializeAdminLeadFilters,
} from '@/lib/data/admin-leads';

interface LeadsFilterBarProps {
  locale: Locale;
  filters: AdminLeadFilters;
  properties: AdminLeadPropertyOption[];
}

/**
 * URL-driven filter bar above the Leads Journal table.
 *
 * Same `<form method="GET">` pattern as `PropertyAdminFilterBar` —
 * native form submit hydrates the URL, the server re-renders the
 * table, no client JS needed.
 */
export async function LeadsFilterBar({ locale, filters, properties }: LeadsFilterBarProps) {
  const t = await getTranslations({ locale, namespace: 'admin.leads.filter' });
  const tSource = await getTranslations({ locale, namespace: 'admin.leads.source' });
  const tInquiry = await getTranslations({ locale, namespace: 'admin.leads.inquiryType' });
  const tState = await getTranslations({ locale, namespace: 'admin.leads.contactedState' });
  const action = `/${locale}/admin/leads`;

  return (
    <section className="bg-canvas-raised border-outline-variant/30 border-b">
      <form
        method="GET"
        action={action}
        className="mx-auto flex flex-col gap-4 px-6 py-5 md:flex-row md:flex-wrap md:items-end md:gap-3 md:px-10"
        role="search"
        aria-label={t('formAriaLabel')}
      >
        <FilterSelect
          id="admin-leads-property"
          label={t('property')}
          name="propertyId"
          defaultValue={filters.propertyId ?? ''}
          options={[
            { value: '', label: t('any') },
            ...properties.map((p) => ({
              value: p.id,
              label: locale === 'ar' ? p.title_ar : p.title_en,
            })),
          ]}
        />
        <FilterSelect
          id="admin-leads-source"
          label={t('source')}
          name="source"
          defaultValue={filters.source ?? ''}
          options={[
            { value: '', label: t('any') },
            ...LEAD_SOURCES.map((value) => ({ value, label: tSource(value) })),
          ]}
        />
        <FilterSelect
          id="admin-leads-inquiry"
          label={t('inquiryType')}
          name="inquiryType"
          defaultValue={filters.inquiryType ?? ''}
          options={[
            { value: '', label: t('any') },
            ...LEAD_INQUIRY_TYPES.map((value) => ({ value, label: tInquiry(value) })),
          ]}
        />
        <FilterSelect
          id="admin-leads-contacted"
          label={t('contactedState')}
          name="contacted"
          defaultValue={filters.contacted ?? ''}
          options={[
            { value: '', label: t('any') },
            ...LEAD_CONTACTED_FILTERS.map((value) => ({ value, label: tState(value) })),
          ]}
        />
        <div className="flex items-center gap-3 md:mb-1">
          <Button type="submit" variant="primary" size="sm">
            {t('apply')}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={action}>{t('clear')}</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={buildExportHref(locale, filters)}
              aria-label={t('exportCsvAria')}
              data-testid="leads-export-csv"
            >
              {t('exportCsv')}
            </a>
          </Button>
        </div>
      </form>
    </section>
  );
}

function buildExportHref(locale: Locale, filters: AdminLeadFilters): string {
  const qs = serializeAdminLeadFilters(filters);
  // The export route shares the same filter shape as the page; just
  // add the locale so the CSV header + enum labels match what the
  // admin sees on screen.
  qs.set('locale', locale);
  return `/api/leads/export?${qs.toString()}`;
}

interface FilterSelectProps {
  id: string;
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}

function FilterSelect({ id, label, name, defaultValue, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-charcoal-muted text-sm font-semibold tracking-[0.18em] uppercase"
      >
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="bg-canvas border-outline-variant focus:border-teal-forest-500 border-b px-1 py-2 text-base focus:outline-none"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value || 'any'}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
