import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from '@/i18n/routing';

/**
 * Per-request i18n config for next-intl. Resolves the active locale from
 * the URL segment and loads the matching message catalog. Falls back to
 * the default locale when the segment is missing or invalid (next-intl
 * middleware should already prevent this in production).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = (await import(`./messages/${locale}.json`)).default as Record<string, unknown>;

  return {
    locale,
    messages,
    timeZone: 'Asia/Riyadh',
    now: new Date(),
  };
});
