import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';
import type { PropertyAmenity } from '@/lib/data/properties';

import { AmenityIcon } from './AmenityIcon';

/**
 * Amenities grouped by category, rendered as a flat icon + label grid
 * (no bordered cards). Uses `amenities.icon` from the database via
 * `AmenityIcon` so each item gets its own pictogram instead of every
 * row repeating the same checkmark.
 *
 * Visual choices:
 *   - No card chrome — the page already has heavy structure (gallery,
 *     contact card, map); amenities sit as a quiet checklist.
 *   - Brass icon, charcoal label — same colour pairing as `Specs.tsx`.
 *   - Compact rows (no large vertical padding) so the list reads as a
 *     dense feature inventory rather than a series of buttons.
 *   - 1 column on mobile, 2 on small tablet, 3 on desktop.
 *
 * Returns `null` when no amenities are linked, so the section header
 * never renders empty.
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
        className="text-teal-forest-700 mb-8 text-2xl leading-tight font-semibold md:text-3xl"
      >
        {t('title')}
      </h2>
      <div className="flex flex-col gap-10">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat}>
              {/* Category eyebrow — teal-forest on canvas (brass fails
                  AA contrast for text on the off-white background). */}
              <h3 className="text-teal-forest-700/70 border-outline-variant/40 mb-4 border-b pb-2 text-sm font-semibold tracking-[0.32em] uppercase">
                {t(`category.${cat}`)}
              </h3>
              <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((amenity) => (
                  <li
                    key={amenity.key}
                    className="text-charcoal flex items-center gap-3 text-[15px] leading-tight"
                  >
                    <span className="text-brass-700 flex-shrink-0">
                      <AmenityIcon icon={amenity.icon} />
                    </span>
                    <span>{isAr ? amenity.label_ar : amenity.label_en}</span>
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
