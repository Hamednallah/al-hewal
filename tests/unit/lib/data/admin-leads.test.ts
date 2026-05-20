import { describe, expect, it } from 'vitest';

import {
  ADMIN_LEADS_MAX_PAGE,
  parseAdminLeadFilters,
  serializeAdminLeadFilters,
} from '@/lib/data/admin-leads';

describe('parseAdminLeadFilters', () => {
  it('returns defaults when the URL has no params', () => {
    expect(parseAdminLeadFilters({})).toEqual({
      propertyId: undefined,
      source: undefined,
      inquiryType: undefined,
      contacted: undefined,
      page: 1,
    });
  });

  it('passes through known enum values', () => {
    const parsed = parseAdminLeadFilters({
      source: 'whatsapp',
      inquiryType: 'maintenance',
      contacted: 'pending',
      propertyId: 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
      page: '3',
    });
    expect(parsed).toEqual({
      propertyId: 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
      source: 'whatsapp',
      inquiryType: 'maintenance',
      contacted: 'pending',
      page: 3,
    });
  });

  it('drops unknown enum values to undefined (defence against URL tampering)', () => {
    const parsed = parseAdminLeadFilters({
      source: 'sms',
      inquiryType: 'urgent',
      contacted: 'maybe',
    });
    expect(parsed.source).toBeUndefined();
    expect(parsed.inquiryType).toBeUndefined();
    expect(parsed.contacted).toBeUndefined();
  });

  it('clamps page to [1, MAX]', () => {
    expect(parseAdminLeadFilters({ page: '0' }).page).toBe(1);
    expect(parseAdminLeadFilters({ page: '-1' }).page).toBe(1);
    expect(parseAdminLeadFilters({ page: 'NaN' }).page).toBe(1);
    expect(parseAdminLeadFilters({ page: String(ADMIN_LEADS_MAX_PAGE + 1) }).page).toBe(1);
  });

  it('handles array search params (takes the first)', () => {
    expect(
      parseAdminLeadFilters({
        source: ['whatsapp', 'contact_form'] as unknown as string,
      }).source,
    ).toBe('whatsapp');
  });
});

describe('serializeAdminLeadFilters', () => {
  it('omits empty values and page=1', () => {
    expect(serializeAdminLeadFilters({ page: 1 }).toString()).toBe('');
  });

  it('round-trips a populated filter set', () => {
    const filters = {
      propertyId: 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
      source: 'whatsapp' as const,
      inquiryType: 'maintenance' as const,
      contacted: 'contacted' as const,
      page: 2,
    };
    const qs = serializeAdminLeadFilters(filters).toString();
    expect(qs).toContain('propertyId=aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa');
    expect(qs).toContain('source=whatsapp');
    expect(qs).toContain('inquiryType=maintenance');
    expect(qs).toContain('contacted=contacted');
    expect(qs).toContain('page=2');
    expect(parseAdminLeadFilters(Object.fromEntries(new URLSearchParams(qs)))).toEqual(filters);
  });
});
