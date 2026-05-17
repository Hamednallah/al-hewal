import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { PropertySummary } from '@/lib/data/properties';

/**
 * Property summary card used by both the home featured carousel and the
 * catalog grid (PR 2.3).
 *
 * Layout matches the Stitch mockup:
 *   - Top: hero image (4:3 aspect, sharp corners, status badge overlay
 *     in the top inline-end corner)
 *   - Body: title in `title-md`, location subtitle, price in brass
 *   - Footer: thin specs bar with bed / bath / area
 *
 * The whole card is wrapped in a Link to the property detail. Hover
 * lifts the image slightly via a group-hover transform on the inner
 * <Image>, signalling interactivity without rounding any corners.
 */
type PropertyCardProps = {
  property: PropertySummary;
  className?: string;
  priority?: boolean;
};

export async function PropertyCard({ property, className, priority = false }: PropertyCardProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('public.property');
  const isAr = locale === 'ar';
  const title = isAr ? property.title_ar : property.title_en;
  const alt = property.hero_image
    ? isAr
      ? property.hero_image.alt_ar
      : property.hero_image.alt_en
    : '';
  const districtLabel = property.district ?? property.city;
  const fullLocation = property.district ? `${property.district}، ${property.city}` : property.city;

  return (
    <article
      className={cn(
        'group bg-canvas-raised border-outline-variant text-charcoal flex flex-col border transition-colors duration-300',
        'hover:border-teal-forest-500',
        className,
      )}
    >
      <Link
        href={`/properties/${property.slug}`}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas flex h-full flex-col"
        aria-label={`${title} — ${fullLocation}`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-charcoal/10">
          {property.hero_image ? (
            <Image
              src={property.hero_image.blob_url}
              alt={alt}
              width={property.hero_image.width}
              height={property.hero_image.height}
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="bg-charcoal/5 flex h-full w-full items-center justify-center">
              <span className="text-charcoal-muted text-xs uppercase tracking-[0.2em]">
                {t('noImage')}
              </span>
            </div>
          )}
          <StatusBadge status={property.status} t={t} />
        </div>
        <div className="flex flex-grow flex-col gap-3 p-6">
          <p className="text-charcoal-muted text-xs uppercase tracking-[0.25em]">
            {t(`type.${property.type}`)} · {districtLabel}
          </p>
          <h3 className="text-charcoal text-xl font-semibold leading-tight md:text-2xl">{title}</h3>
          <p className="text-brass-600 text-base font-bold">
            {t('priceFrom', { price: formatPrice(property.price_sar, locale) })}
          </p>
          <SpecsBar
            bedrooms={property.bedrooms}
            bathrooms={property.bathrooms}
            sqm={property.area_sqm}
            t={t}
          />
        </div>
      </Link>
    </article>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations<'public.property'>>>;

function StatusBadge({ status, t }: { status: PropertySummary['status']; t: Translator }) {
  const palette: Record<PropertySummary['status'], string> = {
    available: 'bg-brass-400 text-teal-forest-700',
    starting_soon: 'bg-teal-forest-500 text-canvas',
    reserved: 'bg-charcoal text-canvas',
    sold: 'bg-charcoal text-canvas/80',
  };
  return (
    <span
      className={cn(
        'absolute end-4 top-4 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em]',
        palette[status],
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function SpecsBar({
  bedrooms,
  bathrooms,
  sqm,
  t,
}: {
  bedrooms: number;
  bathrooms: number;
  sqm: number;
  t: Translator;
}) {
  return (
    <ul className="border-outline-variant text-charcoal-muted mt-auto flex items-center gap-6 border-t pt-4 text-sm">
      <li>
        <span className="font-semibold">{bedrooms}</span> {t('specs.bedrooms')}
      </li>
      <li>
        <span className="font-semibold">{bathrooms}</span> {t('specs.bathrooms')}
      </li>
      <li>
        <span className="font-semibold">{sqm}</span> {t('specs.sqm')}
      </li>
    </ul>
  );
}

function formatPrice(price: number, locale: Locale): string {
  // SAR formatting with the locale's number system. Arabic locale uses
  // Eastern Arabic numerals by default in many fonts; we keep Western
  // digits in tables/specs (per CLAUDE.md) but allow the locale Intl
  // formatter to pick its preferred grouping separator.
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0,
  }).format(price);
}
