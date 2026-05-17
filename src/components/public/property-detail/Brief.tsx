import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';
import type { PropertyDetail } from '@/lib/data/properties';

/**
 * Bilingual project brief: title in the current locale, then the full
 * description from `properties.description_{ar,en}`.
 *
 * Always renders the description in the active locale only — the
 * Stitch mockup shows the AR + EN description side-by-side, but doing
 * that double-renders every property's body copy on every visit. The
 * locale switcher in the chrome handles the language toggle, so the
 * detail page stays focused on the one language the user picked.
 */
type BriefProps = {
  property: PropertyDetail;
  locale: Locale;
};

export async function Brief({ property, locale }: BriefProps) {
  const t = await getTranslations({ locale, namespace: 'public.propertyDetail.brief' });
  const isAr = locale === 'ar';
  const description = isAr ? property.description_ar : property.description_en;

  return (
    <section aria-labelledby="brief-title">
      <h2
        id="brief-title"
        className="text-teal-forest-700 mb-6 text-3xl font-semibold leading-tight md:text-4xl"
      >
        {t('title')}
      </h2>
      <p className="text-charcoal-muted max-w-prose text-base leading-relaxed md:text-lg md:leading-loose">
        {description}
      </p>
    </section>
  );
}
