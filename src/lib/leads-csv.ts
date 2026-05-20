import type { AdminLeadRow } from '@/lib/data/admin-leads';

/**
 * RFC 4180 CSV escaping. A field is quoted when it contains a comma,
 * a newline, or a double-quote. Internal double quotes are doubled.
 * Empty / null fields are emitted as the empty string.
 */
function escapeField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const needsQuoting = /[",\n\r]/.test(value);
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export type LeadsCsvLocale = 'ar' | 'en';

interface CsvHeaderLabels {
  received_at: string;
  name: string;
  phone: string;
  email: string;
  property: string;
  source: string;
  inquiry_type: string;
  status: string;
  contacted_at: string;
  message: string;
  notes: string;
  locale: string;
  contacted: string;
  pending: string;
  whatsapp: string;
  contact_form: string;
  call_click: string;
  general: string;
  maintenance: string;
}

/**
 * Build the localised header + enum labels the CSV body will use. The
 * caller passes pre-resolved translations so this helper stays
 * synchronous + unit-testable without dragging next-intl into the
 * route handler tests.
 */
export function buildCsvLabels(locale: LeadsCsvLocale): CsvHeaderLabels {
  if (locale === 'ar') {
    return {
      received_at: 'تاريخ الاستلام',
      name: 'الاسم',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      property: 'المشروع',
      source: 'المصدر',
      inquiry_type: 'نوع الاستفسار',
      status: 'الحالة',
      contacted_at: 'تاريخ التواصل',
      message: 'الرسالة',
      notes: 'ملاحظات',
      locale: 'لغة الزائر',
      contacted: 'تم التواصل',
      pending: 'بانتظار المتابعة',
      whatsapp: 'واتساب',
      contact_form: 'نموذج التواصل',
      call_click: 'اتصال هاتفي',
      general: 'استفسار عام',
      maintenance: 'طلب صيانة',
    };
  }
  return {
    received_at: 'Received at',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    property: 'Project',
    source: 'Source',
    inquiry_type: 'Inquiry type',
    status: 'Status',
    contacted_at: 'Contacted at',
    message: 'Message',
    notes: 'Notes',
    locale: 'Visitor locale',
    contacted: 'Contacted',
    pending: 'Pending',
    whatsapp: 'WhatsApp',
    contact_form: 'Contact form',
    call_click: 'Call',
    general: 'General',
    maintenance: 'Maintenance',
  };
}

/**
 * Serialise `leads` to a CSV string. The first row is the localised
 * header. Source + inquiry_type + status are localised to match the
 * UI; timestamps are emitted as raw ISO-8601 (admins doing follow-up
 * arithmetic in Excel want the underlying timestamp, not a formatted
 * string).
 *
 * Output is BOM-prefixed (UTF-8 ﻿) so Excel on Windows opens
 * Arabic text correctly out of the box without forcing the user to
 * change the file's encoding manually.
 */
export function leadsToCsv(leads: AdminLeadRow[], locale: LeadsCsvLocale): string {
  const labels = buildCsvLabels(locale);
  const sourceLabel: Record<AdminLeadRow['source'], string> = {
    whatsapp: labels.whatsapp,
    contact_form: labels.contact_form,
    call_click: labels.call_click,
  };
  const inquiryLabel: Record<AdminLeadRow['inquiry_type'], string> = {
    general: labels.general,
    maintenance: labels.maintenance,
  };

  const header = [
    labels.received_at,
    labels.name,
    labels.phone,
    labels.email,
    labels.property,
    labels.source,
    labels.inquiry_type,
    labels.status,
    labels.contacted_at,
    labels.message,
    labels.notes,
    labels.locale,
  ];

  const lines: string[] = [header.map(escapeField).join(',')];

  for (const lead of leads) {
    const propertyTitle = lead.property_id
      ? locale === 'ar'
        ? lead.property_title_ar
        : lead.property_title_en
      : null;
    lines.push(
      [
        lead.created_at,
        lead.name,
        lead.phone,
        lead.email,
        propertyTitle,
        sourceLabel[lead.source],
        inquiryLabel[lead.inquiry_type],
        lead.contacted_at ? labels.contacted : labels.pending,
        lead.contacted_at,
        lead.message,
        lead.notes,
        lead.locale,
      ]
        .map(escapeField)
        .join(','),
    );
  }

  // BOM + CRLF line endings — RFC 4180 says CRLF, and Excel on Windows
  // is the consumer most likely to hit edge cases with bare LF.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
