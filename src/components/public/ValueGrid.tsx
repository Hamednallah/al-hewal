import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';

/**
 * Value-proposition grid.
 *
 * Three columns on desktop, single column on mobile. Each card has a
 * brass numeric marker (01/02/03 in label-caps) above the title,
 * matching the architectural-blueprint feel of the Stitch mockups
 * (technical specifications presented as numbered items).
 *
 * Cards are pure server-rendered divs (no Card primitive yet — Card
 * lives in PR 2.3 where the catalog needs it). YAGNI.
 *
 * The 3 items come straight from the company brief in alhewal.txt:
 * modern engineering, deadline commitment, one-year warranty + post-sale.
 */
type ItemKey = 'engineering' | 'deadlines' | 'maintenance';
const ITEMS: ReadonlyArray<{ key: ItemKey; marker: string }> = [
  { key: 'engineering', marker: '01' },
  { key: 'deadlines', marker: '02' },
  { key: 'maintenance', marker: '03' },
];

export async function ValueGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.home.valueProps' });

  return (
    <section className="bg-canvas py-section">
      <div className="mx-auto max-w-[1440px] px-edge">
        <div className="mb-16 flex max-w-3xl flex-col gap-4">
          <p className="text-teal-forest-500 text-xs uppercase tracking-[0.4em]">
            {t('sectionEyebrow')}
          </p>
          <h2 className="text-charcoal text-balance text-3xl font-bold leading-tight md:text-5xl">
            {t('sectionHeadline')}
          </h2>
        </div>
        <ul className="grid grid-cols-1 gap-px bg-charcoal/10 md:grid-cols-3">
          {ITEMS.map(({ key, marker }) => (
            <li key={key} className="bg-canvas flex flex-col gap-4 p-8 md:p-10">
              <p className="text-brass-500 text-xs font-bold uppercase tracking-[0.3em]">
                {marker}
              </p>
              <h3 className="text-charcoal text-xl font-semibold leading-snug md:text-2xl">
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-charcoal-muted text-base leading-relaxed">
                {t(`items.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
