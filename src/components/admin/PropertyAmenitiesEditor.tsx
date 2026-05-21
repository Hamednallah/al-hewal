'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';

import type { AdminAmenity, AmenityCategory } from '@/lib/data/admin-amenities';
import type { Locale } from '@/i18n/routing';

interface PropertyAmenitiesEditorProps {
  propertyId: string;
  locale: Locale;
  catalog: AdminAmenity[];
  initialSelectedIds: number[];
}

const CATEGORY_ORDER: Array<AmenityCategory | 'other'> = [
  'interior',
  'exterior',
  'safety',
  'smart',
  'other',
];

/**
 * Checkbox-grid editor for a property's amenities. Renders the seeded
 * catalog grouped by category, with each item bilingually labelled
 * via `labelAr` / `labelEn`. Toggles are optimistic: the local set
 * updates immediately, then PATCH /api/properties/[id]/amenities
 * persists the new full set. On server error the toggle reverts.
 *
 * This closes the gap left by PR 3.4: the admin form was specced
 * with an amenities step that was deferred and never came back.
 * Before this component, amenities could only be set via raw SQL
 * (the public detail page renders them via `AmenitiesList`).
 */
export function PropertyAmenitiesEditor({
  propertyId,
  locale,
  catalog,
  initialSelectedIds,
}: PropertyAmenitiesEditorProps) {
  const t = useTranslations('admin.properties.amenities');
  const tCat = useTranslations('admin.properties.amenities.categories');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(initialSelectedIds));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const buckets = new Map<AmenityCategory | 'other', AdminAmenity[]>();
    for (const a of catalog) {
      const key = (a.category ?? 'other') as AmenityCategory | 'other';
      const arr = buckets.get(key) ?? [];
      arr.push(a);
      buckets.set(key, arr);
    }
    return buckets;
  }, [catalog]);

  function persist(nextSet: Set<number>) {
    const previousSnapshot = new Set(selectedIds);
    setSelectedIds(nextSet);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/properties/${propertyId}/amenities`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amenityIds: [...nextSet] }),
        });
        if (!res.ok) {
          setSelectedIds(previousSnapshot);
          setError(t('saveFailed'));
        }
      } catch {
        setSelectedIds(previousSnapshot);
        setError(t('saveFailed'));
      }
    });
  }

  function toggle(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persist(next);
  }

  return (
    <section
      aria-labelledby="property-amenities-heading"
      data-testid="property-amenities-editor"
      className="bg-canvas-raised border-outline-variant/30 flex flex-col gap-4 border p-5 md:p-6"
    >
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2
            id="property-amenities-heading"
            className="text-teal-forest-700 text-sm font-semibold tracking-[0.2em] uppercase"
          >
            {t('heading')}
          </h2>
          <p className="text-charcoal-muted mt-1 text-xs">{t('hint')}</p>
        </div>
        <span
          className="text-brass-700 text-xs font-semibold tracking-[0.15em] uppercase"
          aria-live="polite"
        >
          {pending ? t('saving') : t('savedBadge', { count: selectedIds.size })}
        </span>
      </header>

      {error ? (
        <p
          role="alert"
          data-testid="property-amenities-error"
          className="border-s-4 border-[#b00020] bg-[#fceaea] p-3 text-sm leading-relaxed text-[#7d1c1c]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        {CATEGORY_ORDER.map((category) => {
          const items = grouped.get(category);
          if (!items || items.length === 0) return null;
          return (
            <div key={category} className="flex flex-col gap-2">
              <h3 className="text-charcoal text-xs font-semibold tracking-[0.18em] uppercase">
                {tCat(category)}
              </h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => {
                  const checked = selectedIds.has(a.id);
                  const label = locale === 'ar' ? a.labelAr : a.labelEn;
                  return (
                    <li key={a.id}>
                      <label
                        className={
                          'flex cursor-pointer items-center gap-3 border p-3 transition-colors ' +
                          (checked
                            ? 'border-brass-400 bg-canvas'
                            : 'border-outline-variant/40 hover:border-brass-400/60')
                        }
                      >
                        <input
                          type="checkbox"
                          className="accent-teal-forest-700 h-4 w-4 shrink-0"
                          checked={checked}
                          onChange={() => toggle(a.id)}
                          disabled={pending}
                          data-testid={`amenity-${a.key}`}
                        />
                        <span className="text-charcoal text-sm">{label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
