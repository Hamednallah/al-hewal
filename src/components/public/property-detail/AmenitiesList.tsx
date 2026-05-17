import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';
import type { PropertyAmenity } from '@/lib/data/properties';

/**
 * Amenities grouped by category (interior / exterior / smart / safety).
 * Renders a single bilingual checklist; uses an inline checkmark glyph
 * for each item rather than loading the Material Symbols font.
 *
 * If `amenities` is empty (property still being edited in admin),
 * returns null so the page doesn't render an empty section header.
 */
type AmenitiesListProps = {
  amenities: PropertyAmenity[];
  locale: Locale;
};

type CategoryKey = 'interior' | 'exterior' | 'smart' | 'safety' | 'other';
const CATEGORY_ORDER: CategoryKey[] = ['interior', 'exterior', 'smart', 'safety', 'other'];

export async function AmenitiesList({ amenities, locale }: AmenitiesListProps) {
  if (amenities.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'public.propertyDetail.amenities' });
  const isAr = locale === 'ar';
  const grouped = groupByCategory(amenities);

  return (
    <section aria-labelledby="amenities-title">
      <h2
        id="amenities-title"
        className="text-teal-forest-700 mb-6 text-2xl font-semibold leading-tight md:text-3xl"
      >
        {t('title')}
      </h2>
      <div className="flex flex-col gap-8">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat}>
              {/* Category headings sit on bg-canvas — brass fails AA
                  contrast there. Use teal-forest-700 (17:1) instead. */}
              <h3 className="text-teal-forest-700 mb-3 text-[11px] tracking-[0.3em] uppercase">
                {t(`category.${cat}`)}
              </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((amenity) => (
                  <li
                    key={amenity.key}
                    className="border-outline-variant bg-canvas-raised text-charcoal flex items-center gap-3 border p-4"
                  >
                    <span
                      aria-hidden="true"
                      className="text-brass-600 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center"
                    >
                      <CheckIcon />
                    </span>
                    <span className="text-base">{isAr ? amenity.label_ar : amenity.label_en}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function groupByCategory(amenities: PropertyAmenity[]): Record<CategoryKey, PropertyAmenity[]> {
  const out: Record<CategoryKey, PropertyAmenity[]> = {
    interior: [],
    exterior: [],
    smart: [],
    safety: [],
    other: [],
  };
  for (const amenity of amenities) {
    const cat = (amenity.category ?? 'other') as CategoryKey;
    if (cat in out) {
      out[cat].push(amenity);
    } else {
      out.other.push(amenity);
    }
  }
  return out;
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M2 8 L7 13 L14 4" />
    </svg>
  );
}
