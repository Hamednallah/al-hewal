import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { PROPERTY_TYPES, type CatalogFilters } from '@/lib/url-filters';

/**
 * Sticky filter bar above the catalog grid.
 *
 * Server-rendered. The form uses native `method="GET"` so the browser
 * itself encodes the inputs into searchParams and navigates to
 * `/<locale>/properties?...`. No client-side fetch or JavaScript
 * required — keeps the catalog page server-only and free-tier-friendly.
 *
 * "Clear" is a plain locale-aware link to the bare catalog URL.
 *
 * NOTE: this form does not currently include a `<input type="hidden"
 * name="locale">` because next-intl's middleware reads the locale from
 * the URL path, not the form body. The action target is the same path
 * so it stays on the active locale automatically.
 */
type FilterBarProps = {
  locale: Locale;
  filters: CatalogFilters;
  cities: string[];
};

export async function FilterBar({ locale, filters, cities }: FilterBarProps) {
  const t = await getTranslations({ locale, namespace: 'public.catalog.filter' });
  const tType = await getTranslations({ locale, namespace: 'public.property.type' });

  return (
    <section className="bg-canvas-raised border-outline-variant text-charcoal sticky top-16 z-20 border-y md:top-20">
      <form
        method="GET"
        action={`/${locale}/properties`}
        className="mx-auto flex max-w-[1440px] flex-col gap-4 px-edge py-4 md:py-6"
        role="search"
        aria-label={t('searchLabel')}
      >
        {/* Top row: search input + apply button */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
          <div className="flex flex-grow flex-col gap-1">
            <label
              htmlFor="catalog-search"
              className="text-charcoal-muted text-xs font-bold uppercase tracking-[0.2em]"
            >
              {t('searchLabel')}
            </label>
            <input
              id="catalog-search"
              type="search"
              name="q"
              defaultValue={filters.query ?? ''}
              maxLength={100}
              placeholder={t('searchPlaceholder')}
              className="bg-canvas border-outline-variant focus-visible:border-teal-forest-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass-400 border-b px-1 py-2 text-base"
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="primary" size="md">
              {t('apply')}
            </Button>
            <Button asChild variant="ghost" size="md">
              <Link href="/properties" prefetch={false}>
                {t('clear')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Bottom row: structured filters */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <FilterSelect
            label={t('type')}
            name="type"
            value={filters.type ?? ''}
            options={[
              { value: '', label: t('anyType') },
              ...PROPERTY_TYPES.map((type) => ({
                value: type,
                label: tType(type),
              })),
            ]}
          />
          <FilterSelect
            label={t('city')}
            name="city"
            value={filters.city ?? ''}
            options={[
              { value: '', label: t('anyCity') },
              ...cities.map((city) => ({ value: city, label: city })),
            ]}
          />
          <FilterNumber
            label={t('minPrice')}
            name="minPrice"
            value={filters.minPrice}
          />
          <FilterNumber
            label={t('maxPrice')}
            name="maxPrice"
            value={filters.maxPrice}
          />
        </div>
      </form>
    </section>
  );
}

type SelectProps = {
  label: string;
  name: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
};

function FilterSelect({ label, name, value, options }: SelectProps) {
  const id = `catalog-filter-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-charcoal-muted text-xs font-bold uppercase tracking-[0.2em]">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        className="bg-canvas border-outline-variant focus-visible:border-teal-forest-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass-400 border-b py-2 text-sm md:text-base"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type NumberProps = {
  label: string;
  name: string;
  value: number | null;
};

function FilterNumber({ label, name, value }: NumberProps) {
  const id = `catalog-filter-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-charcoal-muted text-xs font-bold uppercase tracking-[0.2em]">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        dir="ltr"
        min={0}
        step={50000}
        name={name}
        defaultValue={value ?? ''}
        className="bg-canvas border-outline-variant focus-visible:border-teal-forest-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass-400 border-b px-1 py-2 text-sm md:text-base"
      />
    </div>
  );
}
