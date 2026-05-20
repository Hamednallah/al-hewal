import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/routing';
import type { AdminLeadRow } from '@/lib/data/admin-leads';

import { LeadRowActions } from './LeadRowActions';

// Server-rendered date/time string. Uses the request locale's region
// (ar-SA / en-GB) so each card reads naturally without dragging
// next-intl date-format config through the component tree.
function formatReceivedAt(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface LeadsTableProps {
  locale: Locale;
  leads: AdminLeadRow[];
}

/**
 * Server-rendered Leads Journal — one card per inbound contact attempt,
 * newest first.
 *
 * The component name is retained for import-stability (mirrors the
 * PropertyTable → cards rewrite in the ux-papercuts PR); the markup is
 * the change. Each card stacks: header (name + status badge) → data
 * row (received · project · source · inquiry) → contact block (phone /
 * email LTR + the full inbound message) → action row (copy phone /
 * WhatsApp / mark contacted / inline notes editor) along the bottom.
 *
 * Per-row interactive controls live in the `LeadRowActions` client
 * island.
 */
export async function LeadsTable({ locale, leads }: LeadsTableProps) {
  const t = await getTranslations({ locale, namespace: 'admin.leads.table' });
  const tSource = await getTranslations({ locale, namespace: 'admin.leads.source' });
  const tInquiry = await getTranslations({ locale, namespace: 'admin.leads.inquiryType' });
  const tState = await getTranslations({ locale, namespace: 'admin.leads.contactedState' });

  return (
    <ul data-testid="admin-leads-cards" className="flex flex-col gap-3">
      {leads.map((lead) => {
        const propertyTitle = lead.property_id
          ? locale === 'ar'
            ? lead.property_title_ar
            : lead.property_title_en
          : null;
        const propertyHref = lead.property_slug
          ? `/${locale}/properties/${lead.property_slug}`
          : null;
        const isContacted = lead.contacted_at !== null;
        const name = lead.name?.trim() || t('anonymous');

        return (
          <li
            key={lead.id}
            data-testid={`admin-lead-card-${lead.id}`}
            className="bg-canvas-raised border-outline-variant/30 hover:border-teal-forest-700/40 flex flex-col gap-4 border p-4 transition-colors md:p-5"
          >
            {/* Header — name + received-at + status */}
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-teal-forest-700 truncate text-base font-semibold">{name}</p>
                <p className="text-charcoal-muted text-xs">
                  {formatReceivedAt(lead.created_at, locale)}
                </p>
              </div>
              <span
                aria-label={t('status')}
                className={
                  isContacted
                    ? 'bg-teal-forest-700/10 text-teal-forest-700 border-teal-forest-700/40 inline-flex items-center border px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.16em] uppercase'
                    : 'bg-brass/15 text-brass-700 border-brass/40 inline-flex items-center border px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.16em] uppercase'
                }
              >
                {tState(isContacted ? 'contacted' : 'pending')}
              </span>
            </header>

            {/* Data row — project · source · inquiry */}
            <dl className="text-charcoal grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
              <CardField
                label={t('project')}
                value={
                  propertyTitle && propertyHref ? (
                    <a
                      href={propertyHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-forest-700 hover:underline"
                    >
                      {propertyTitle}
                    </a>
                  ) : (
                    <span className="text-charcoal-muted">{t('noProject')}</span>
                  )
                }
              />
              <CardField label={t('source')} value={tSource(lead.source)} />
              <CardField label={t('inquiryType')} value={tInquiry(lead.inquiry_type)} />
            </dl>

            {/* Contact block — phone / email LTR + message body */}
            <div className="border-outline-variant/30 flex flex-col gap-1 border-t pt-3">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                <CardField
                  label={t('contact')}
                  value={
                    <span dir="ltr" className={lead.phone ? '' : 'text-charcoal-muted italic'}>
                      {lead.phone ?? t('noPhone')}
                    </span>
                  }
                />
                <CardField
                  label={t('contact')}
                  ariaHideLabel
                  value={
                    <span dir="ltr" className={lead.email ? '' : 'text-charcoal-muted italic'}>
                      {lead.email ?? t('noEmail')}
                    </span>
                  }
                />
              </dl>
              {lead.message ? (
                <div className="flex flex-col gap-1 pt-2">
                  <p className="text-charcoal-muted text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
                    {t('message')}
                  </p>
                  <p className="text-charcoal text-sm leading-relaxed whitespace-pre-wrap">
                    {lead.message}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Actions row — full width below */}
            <div className="border-outline-variant/30 border-t pt-3">
              <LeadRowActions
                leadId={lead.id}
                phone={lead.phone}
                initialContactedAt={lead.contacted_at}
                initialNotes={lead.notes}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface CardFieldProps {
  label: string;
  value: ReactNode;
  /**
   * When two adjacent fields share a label (e.g. phone + email both
   * under "Contact"), the second renders its label visually hidden so
   * screen readers don't duplicate the announcement.
   */
  ariaHideLabel?: boolean;
}

function CardField({ label, value, ariaHideLabel }: CardFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt
        className={
          ariaHideLabel
            ? 'sr-only'
            : 'text-charcoal-muted text-[0.65rem] font-semibold tracking-[0.16em] uppercase'
        }
      >
        {label}
      </dt>
      <dd className="text-charcoal text-sm">{value}</dd>
    </div>
  );
}
