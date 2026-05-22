import 'server-only';

import { env } from '@/lib/env';

/**
 * Build the destination `wa.me/<phone>?text=<message>` URL the
 * conversion tracker 302-redirects to.
 *
 * The pre-filled message is bilingual-aware: the active locale
 * determines the greeting, and an optional `propertyTitle` is
 * embedded inline so the sales agent receiving the chat already
 * knows which listing the prospect tapped on.
 *
 * Phone number comes from `env.NEXT_PUBLIC_WHATSAPP_PHONE` (validated
 * as E.164 digits in env.ts — no leading `+`). The wa.me canonical
 * format is `https://wa.me/<digits>?text=<encoded>`.
 */
type BuildOptions = {
  locale: 'ar' | 'en';
  propertyTitle?: string | null;
  propertyUrl?: string | null;
};

export function buildWhatsappUrl({ locale, propertyTitle, propertyUrl }: BuildOptions): string {
  const phone = env.NEXT_PUBLIC_WHATSAPP_PHONE;
  const message = buildMessage({ locale, propertyTitle, propertyUrl });
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildMessage({ locale, propertyTitle, propertyUrl }: BuildOptions): string {
  // Templates live inline (not in next-intl messages.json) because this
  // function runs in a route handler and can't read the request locale
  // through `getTranslations()` without a request-scope context. The
  // copy is short and stable enough that maintaining it here is fine.
  if (locale === 'ar') {
    if (propertyTitle && propertyUrl) {
      return `السلام عليكم الحوال، أرغب بمزيد من المعلومات عن ${propertyTitle} (${propertyUrl}).`;
    }
    if (propertyTitle) {
      return `السلام عليكم الحوال، أرغب بمزيد من المعلومات عن ${propertyTitle}.`;
    }
    return 'السلام عليكم الحوال، أرغب بالاستفسار عن مشاريعكم العقارية.';
  }
  if (propertyTitle && propertyUrl) {
    return `Hello Al Haual, I'd like more information about ${propertyTitle} (${propertyUrl}).`;
  }
  if (propertyTitle) {
    return `Hello Al Haual, I'd like more information about ${propertyTitle}.`;
  }
  return 'Hello Al Haual, I would like to enquire about your real-estate projects.';
}
