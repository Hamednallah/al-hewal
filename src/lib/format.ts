import { type Locale } from '@/i18n/routing';

/**
 * SAR currency formatter shared by the property card, the property
 * detail page, and the JSON-LD schema emitter.
 *
 * Returns the Intl-formatted string for the locale's number system.
 * Arabic uses Eastern-Arabic digits + Arabic currency symbol; English
 * uses Western digits + "SAR". Both pass at most-zero fraction digits
 * (property prices are always whole SAR — the schema in 0001_init.sql
 * enforces `price_sar numeric(12,2) check (price_sar >= 0)` but the
 * mockups never show fractional riyals).
 *
 * Symmetrical helpers (formatArea, formatNumber) live alongside so
 * future surfaces don't accidentally hand-roll a slightly different
 * Intl options object.
 */
export function formatPrice(price: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Plain integer formatter for figures that already have a unit suffix
 * applied via i18n (e.g. "{value} m²"). Keeps grouping separators
 * locale-correct without dragging in a currency symbol.
 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}
