import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';
import type { PropertyDetail } from '@/lib/data/properties';
import { formatNumber } from '@/lib/format';

/**
 * Quick-specs strip rendered above the brief.
 *
 * Mirrors the Stitch "Quick Specs Bar" but uses inline SVG icons
 * instead of the Material Symbols icon font. Material Symbols would
 * have added ~120 KB of font payload to every detail-page render for
 * five icons — inline SVG keeps the bundle under the 300 KB app-page
 * budget from web/performance.md.
 *
 * Optional fields (plot_number, street_width_m, facade) only render
 * when present, so a property with partial admin data still produces
 * a clean strip rather than empty placeholders.
 */
type SpecsProps = {
  property: PropertyDetail;
  locale: Locale;
};

export async function Specs({ property, locale }: SpecsProps) {
  const t = await getTranslations({ locale, namespace: 'public.propertyDetail.specs' });

  const items: Array<{
    key: string;
    label: string;
    value: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'bedrooms',
      label: t('bedrooms'),
      value: formatNumber(property.bedrooms, locale),
      icon: <BedIcon />,
    },
    {
      key: 'bathrooms',
      label: t('bathrooms'),
      value: formatNumber(property.bathrooms, locale),
      icon: <BathIcon />,
    },
    {
      key: 'area',
      label: t('area'),
      value: t('areaValue', { value: formatNumber(property.area_sqm, locale) }),
      icon: <AreaIcon />,
    },
  ];

  if (property.plot_number) {
    items.push({
      key: 'plot',
      label: t('plot'),
      value: property.plot_number,
      icon: <PlotIcon />,
    });
  }
  if (property.street_width_m != null) {
    items.push({
      key: 'streetWidth',
      label: t('streetWidth'),
      value: t('streetWidthValue', { value: formatNumber(property.street_width_m, locale) }),
      icon: <StreetIcon />,
    });
  }
  if (property.facade) {
    const facadeLabel =
      property.facade === 'north'
        ? t('facadeNorth')
        : property.facade === 'south'
          ? t('facadeSouth')
          : property.facade === 'east'
            ? t('facadeEast')
            : property.facade === 'west'
              ? t('facadeWest')
              : t('facadeCorner');
    items.push({
      key: 'facade',
      label: t('facade'),
      value: facadeLabel,
      icon: <FacadeIcon />,
    });
  }

  return (
    <section aria-labelledby="specs-title">
      <h2 id="specs-title" className="sr-only">
        {t('title')}
      </h2>
      <ul className="border-outline-variant grid grid-cols-2 gap-x-10 gap-y-6 border-y py-6 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3">
            <span className="text-teal-forest-700" aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <p className="text-teal-forest-700 text-xl leading-none font-bold md:text-2xl">
                {item.value}
              </p>
              <p className="text-charcoal-muted mt-1 text-sm tracking-[0.2em] uppercase">
                {item.label}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ICON_SIZE = 28;

function BedIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M3 20 V12 H25 V20" />
      <path d="M3 20 V23" />
      <path d="M25 20 V23" />
      <path d="M7 12 V9 H17 V12" />
      <circle cx="5.5" cy="14.5" r="1.5" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M3 14 H25 V18 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 Z" />
      <path d="M5 14 V6 a2 2 0 0 1 4 0 V8" />
      <path d="M6 20 V24" />
      <path d="M22 20 V24" />
      <path d="M7 8 H11" />
    </svg>
  );
}

function AreaIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M4 4 H24 V24 H4 Z" />
      <path d="M4 9 H9" />
      <path d="M4 14 H9" />
      <path d="M4 19 H9" />
      <path d="M14 24 V19" />
      <path d="M19 24 V19" />
    </svg>
  );
}

function PlotIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M4 6 L14 2 L24 6 V22 L14 26 L4 22 Z" />
      <path d="M14 2 V26" />
      <path d="M4 6 L24 22" />
    </svg>
  );
}

function StreetIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M6 4 V24" />
      <path d="M22 4 V24" />
      <path d="M14 4 V8" />
      <path d="M14 12 V16" />
      <path d="M14 20 V24" />
    </svg>
  );
}

function FacadeIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M4 24 V10 L14 4 L24 10 V24 Z" />
      <path d="M11 24 V16 H17 V24" />
      <path d="M14 4 V2" />
    </svg>
  );
}
