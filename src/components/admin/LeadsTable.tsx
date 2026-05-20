import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import type { AdminLeadRow } from '@/lib/data/admin-leads';

import { LeadRowActions } from './LeadRowActions';

// Server-rendered date/time string. Uses the request locale so AR and
// EN tables read naturally without dragging next-intl date-format
// configuration through the component tree.
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
 * Server-rendered timeline of leads — newest first, one row per
 * inbound contact attempt. Per-row interactive controls live in the
 * `LeadRowActions` client island.
 */
export async function LeadsTable({ locale, leads }: LeadsTableProps) {
  const t = await getTranslations({ locale, namespace: 'admin.leads.table' });
  const tSource = await getTranslations({ locale, namespace: 'admin.leads.source' });
  const tInquiry = await getTranslations({ locale, namespace: 'admin.leads.inquiryType' });
  const tState = await getTranslations({ locale, namespace: 'admin.leads.contactedState' });

  return (
    <div className="overflow-x-auto">
      <table className="bg-canvas-raised border-outline-variant/30 w-full min-w-[1000px] border-collapse border">
        <thead className="bg-canvas-sunken/40">
          <tr className="text-charcoal-muted text-start text-xs font-semibold tracking-[0.18em] uppercase">
            <th className="border-outline-variant/30 border px-3 py-2 text-start">
              {t('received')}
            </th>
            <th className="border-outline-variant/30 border px-3 py-2 text-start">
              {t('project')}
            </th>
            <th className="border-outline-variant/30 border px-3 py-2 text-start">{t('name')}</th>
            <th className="border-outline-variant/30 border px-3 py-2 text-start">
              {t('contact')}
            </th>
            <th className="border-outline-variant/30 border px-3 py-2 text-start">{t('source')}</th>
            <th className="border-outline-variant/30 border px-3 py-2 text-start">
              {t('inquiryType')}
            </th>
            <th className="border-outline-variant/30 border px-3 py-2 text-start">{t('status')}</th>
            <th className="border-outline-variant/30 border px-3 py-2 text-start">
              {t('actions')}
            </th>
          </tr>
        </thead>
        <tbody className="text-charcoal text-sm">
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
            return (
              <tr key={lead.id} className="hover:bg-canvas-sunken/30">
                <td className="border-outline-variant/30 border px-3 py-3 align-top whitespace-nowrap">
                  {formatReceivedAt(lead.created_at, locale)}
                </td>
                <td className="border-outline-variant/30 border px-3 py-3 align-top">
                  {propertyTitle && propertyHref ? (
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
                  )}
                </td>
                <td className="border-outline-variant/30 border px-3 py-3 align-top">
                  {lead.name ?? <span className="text-charcoal-muted">{t('anonymous')}</span>}
                </td>
                <td className="border-outline-variant/30 border px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span
                      dir="ltr"
                      className={lead.phone ? 'text-charcoal' : 'text-charcoal-muted text-xs'}
                    >
                      {lead.phone ?? t('noPhone')}
                    </span>
                    <span
                      dir="ltr"
                      className={
                        lead.email
                          ? 'text-charcoal-muted text-xs'
                          : 'text-charcoal-muted text-xs italic'
                      }
                    >
                      {lead.email ?? t('noEmail')}
                    </span>
                  </div>
                  {lead.message ? (
                    <p className="text-charcoal-muted mt-2 text-xs leading-relaxed whitespace-pre-wrap">
                      {lead.message}
                    </p>
                  ) : null}
                </td>
                <td className="border-outline-variant/30 border px-3 py-3 align-top whitespace-nowrap">
                  {tSource(lead.source)}
                </td>
                <td className="border-outline-variant/30 border px-3 py-3 align-top whitespace-nowrap">
                  {tInquiry(lead.inquiry_type)}
                </td>
                <td className="border-outline-variant/30 border px-3 py-3 align-top whitespace-nowrap">
                  <span
                    className={
                      isContacted
                        ? 'text-teal-forest-700 text-xs font-medium'
                        : 'text-brass text-xs font-medium'
                    }
                  >
                    {tState(isContacted ? 'contacted' : 'pending')}
                  </span>
                </td>
                <td className="border-outline-variant/30 border px-3 py-3 align-top">
                  <LeadRowActions
                    leadId={lead.id}
                    phone={lead.phone}
                    initialContactedAt={lead.contacted_at}
                    initialNotes={lead.notes}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
