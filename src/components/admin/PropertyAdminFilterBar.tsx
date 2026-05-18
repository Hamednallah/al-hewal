import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import {
  ADMIN_PROPERTY_STATUSES,
  ADMIN_PROPERTY_TYPES,
  type AdminPropertyFilters,
} from '@/lib/data/admin-properties';

interface PropertyAdminFilterBarProps {
  locale: Locale;
  filters: AdminPropertyFilters;
  cities: string[];
}

/**
 * URL-driven filter bar above the admin properties table.
 *
 * Same pattern as the public catalog FilterBar (PR 2.3): native
 * `method="GET"` so the browser encodes the inputs into the URL and
 * the server re-renders the table. No client JS, no hydration cost,
 * full URL shareability (admin can DM a filtered URL to a teammate).
 *
 * "Clear" resets to the bare `/admin/properties` URL.
 */
export async function PropertyAdminFilterBar({
  locale,
  filters,
  cities,
}: PropertyAdminFilterBarProps) {
  const t = await getTranslations({ locale, namespace: 'admin.properties.filter' });
  const tType = await getTranslations({ locale, namespace: 'admin.properties.type' });
  const tStatus = await getTranslations({ locale, namespace: 'admin.properties.status' });
  const action = `/${locale}/admin/properties`;

  return (
    <section className="bg-canvas-raised border-outline-variant/30 border-b">
      <form
        method="GET"
        action={action}
        className="mx-auto flex flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:gap-3 md:px-10"
        role="search"
        aria-label={t('formAriaLabel')}
      >
        <FilterInput
          id="admin-properties-search"
          label={t('searchLabel')}
          name="q"
          type="search"
          maxLength={100}
          defaultValue={filters.query ?? ''}
          placeholder={t('searchPlaceholder')}
          className="md:flex-1"
        />

        <FilterSelect
          id="admin-properties-status"
          label={t('status')}
          name="status"
          defaultValue={filters.status ?? ''}
          options={[
            { value: '', label: t('any') },
            ...ADMIN_PROPERTY_STATUSES.map((value) => ({ value, label: tStatus(value) })),
          ]}
        />

        <FilterSelect
          id="admin-properties-type"
          label={t('type')}
          name="type"
          defaultValue={filters.type ?? ''}
          options={[
            { value: '', label: t('any') },
            ...ADMIN_PROPERTY_TYPES.map((value) => ({ value, label: tType(value) })),
          ]}
        />

        <FilterSelect
          id="admin-properties-city"
          label={t('city')}
          name="city"
          defaultValue={filters.city ?? ''}
          options={[
            { value: '', label: t('any') },
            ...cities.map((city) => ({ value: city, label: city })),
          ]}
        />

        <FilterSelect
          id="admin-properties-featured"
          label={t('featured')}
          name="featured"
          defaultValue={filters.featured === undefined ? '' : String(filters.featured)}
          options={[
            { value: '', label: t('any') },
            { value: 'true', label: t('featuredYes') },
            { value: 'false', label: t('featuredNo') },
          ]}
        />

        <label className="text-charcoal flex items-center gap-2 text-sm font-medium md:mb-2">
          <input
            type="checkbox"
            name="archived"
            value="true"
            defaultChecked={filters.includeArchived ?? false}
            className="accent-teal-forest-700 h-4 w-4"
          />
          {t('includeArchived')}
        </label>

        <div className="flex items-center gap-3 md:mb-1">
          <Button type="submit" variant="primary" size="sm">
            {t('apply')}
          </Button>
          {/* Clear uses Button asChild → plain <a> (not next/link).
              Clearing filters is a hard URL reset, and a Next
              client-side push inside the form with hydrated
              `defaultValue` inputs raced with form submission in CI. */}
          <Button asChild variant="outline" size="sm">
            <Link href={action} prefetch={false}>
              {t('clear')}
            </Link>
          </Button>
        </div>
      </form>
    </section>
  );
}

interface FilterInputProps {
  id: string;
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

function FilterInput({
  id,
  label,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  maxLength,
  className,
}: FilterInputProps) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <label
        htmlFor={id}
        className="text-charcoal-muted text-xs font-semibold tracking-[0.18em] uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className="bg-canvas border-outline-variant focus:border-teal-forest-500 border-b px-1 py-2 text-base focus:outline-none"
      />
    </div>
  );
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
        className="text-charcoal-muted text-xs font-semibold tracking-[0.18em] uppercase"
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
