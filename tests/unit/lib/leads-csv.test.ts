import { describe, expect, it } from 'vitest';

import type { AdminLeadRow } from '@/lib/data/admin-leads';
import { buildCsvLabels, leadsToCsv } from '@/lib/leads-csv';

function makeLead(overrides: Partial<AdminLeadRow> = {}): AdminLeadRow {
  return {
    id: '11111111-1111-7111-8111-111111111111',
    property_id: '22222222-2222-7222-8222-222222222222',
    property_slug: 'villa-al-dana',
    property_title_ar: 'فيلا الضانة',
    property_title_en: 'Villa Al Dana',
    source: 'whatsapp',
    inquiry_type: 'general',
    name: 'Ahmed Test',
    phone: '+966500000000',
    email: 'ahmed@example.com',
    message: 'I would like a viewing.',
    locale: 'en',
    contacted_at: null,
    notes: null,
    created_at: '2026-05-20T10:00:00Z',
    ...overrides,
  };
}

describe('leadsToCsv', () => {
  it('emits a UTF-8 BOM and CRLF line endings', () => {
    const csv = leadsToCsv([], 'en');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    // Header-only export: BOM + 1 header line + trailing CRLF.
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('uses English headers + enum labels when locale=en', () => {
    const csv = leadsToCsv([makeLead()], 'en');
    expect(csv).toContain('Received at,Name,Phone,Email,Project,Source,Inquiry type,Status');
    // WhatsApp source + General inquiry + Pending status (no contacted_at).
    expect(csv).toContain('WhatsApp');
    expect(csv).toContain('General');
    expect(csv).toContain('Pending');
    expect(csv).toContain('Villa Al Dana');
  });

  it('uses Arabic headers + enum labels when locale=ar', () => {
    const csv = leadsToCsv([makeLead({ locale: 'ar' })], 'ar');
    expect(csv).toContain('تاريخ الاستلام');
    expect(csv).toContain('الاسم');
    expect(csv).toContain('واتساب');
    expect(csv).toContain('استفسار عام');
    expect(csv).toContain('بانتظار المتابعة');
    // AR locale uses the AR property title.
    expect(csv).toContain('فيلا الضانة');
  });

  it('marks contacted rows correctly', () => {
    const csv = leadsToCsv([makeLead({ contacted_at: '2026-05-21T08:00:00Z' })], 'en');
    expect(csv).toContain('Contacted');
    expect(csv).not.toContain(',Pending,');
  });

  it('quotes fields containing commas, quotes, and newlines per RFC 4180', () => {
    const csv = leadsToCsv(
      [
        makeLead({
          name: 'Smith, John',
          message: 'Said "hi"\nwith a newline.',
        }),
      ],
      'en',
    );
    expect(csv).toContain('"Smith, John"');
    expect(csv).toContain('"Said ""hi""\nwith a newline."');
  });

  it('emits empty strings for null fields rather than the literal "null"', () => {
    const csv = leadsToCsv(
      [
        makeLead({
          name: null,
          phone: null,
          email: null,
          message: null,
          notes: null,
          property_id: null,
          property_slug: null,
          property_title_ar: null,
          property_title_en: null,
        }),
      ],
      'en',
    );
    expect(csv).not.toMatch(/,null,/);
    // The leading "received_at" + 8 empty fields + source + inquiry + status (Pending) + empty contacted_at + 2 empty fields + locale
    // (12 columns total). Easier just to check the data row starts correctly.
    const lines = csv.split('\r\n');
    const dataRow = lines[1];
    // Received-at then 3 empty (name/phone/email) then empty project then "WhatsApp"...
    expect(dataRow).toMatch(/^2026-05-20T10:00:00Z,,,,,WhatsApp,General,Pending,,,,en$/);
  });
});

describe('buildCsvLabels', () => {
  it('has the same key shape for AR and EN', () => {
    const en = buildCsvLabels('en');
    const ar = buildCsvLabels('ar');
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
  });
});
