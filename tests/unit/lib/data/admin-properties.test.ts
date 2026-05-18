import { describe, expect, it } from 'vitest';

import {
  parseAdminPropertyFilters,
  serializeAdminPropertyFilters,
} from '@/lib/data/admin-properties';

describe('parseAdminPropertyFilters', () => {
  it('returns the default filter set for an empty searchParams object', () => {
    const out = parseAdminPropertyFilters({});
    expect(out).toEqual({
      query: undefined,
      type: undefined,
      status: undefined,
      city: undefined,
      featured: undefined,
      includeArchived: false,
      page: 1,
    });
  });

  it('parses every known field from string values', () => {
    const out = parseAdminPropertyFilters({
      q: 'villa',
      type: 'villa',
      status: 'draft',
      city: 'Riyadh',
      featured: 'true',
      archived: 'true',
      page: '3',
    });
    expect(out).toMatchObject({
      query: 'villa',
      type: 'villa',
      status: 'draft',
      city: 'Riyadh',
      featured: true,
      includeArchived: true,
      page: 3,
    });
  });

  it('drops unknown enum values rather than throwing', () => {
    const out = parseAdminPropertyFilters({
      type: 'not-a-real-type',
      status: 'fake',
      featured: 'maybe',
    });
    expect(out.type).toBeUndefined();
    expect(out.status).toBeUndefined();
    expect(out.featured).toBeUndefined();
  });

  it('flattens array-typed searchParams to the first value', () => {
    const out = parseAdminPropertyFilters({
      q: ['villa', 'duplex'],
      type: ['villa', 'apartment'],
    });
    expect(out.query).toBe('villa');
    expect(out.type).toBe('villa');
  });

  it('treats featured=false as an explicit "not featured" filter', () => {
    expect(parseAdminPropertyFilters({ featured: 'false' }).featured).toBe(false);
  });

  it('clamps invalid page numbers back to 1', () => {
    expect(parseAdminPropertyFilters({ page: '-2' }).page).toBe(1);
    expect(parseAdminPropertyFilters({ page: 'banana' }).page).toBe(1);
    expect(parseAdminPropertyFilters({ page: '0' }).page).toBe(1);
  });
});

describe('serializeAdminPropertyFilters', () => {
  it('returns an empty string when no filters are active and page is 1', () => {
    expect(
      serializeAdminPropertyFilters({
        query: undefined,
        type: undefined,
        status: undefined,
        city: undefined,
        featured: undefined,
        includeArchived: false,
        page: 1,
      }),
    ).toBe('');
  });

  it('serialises only the keys that have non-default values', () => {
    const qs = serializeAdminPropertyFilters({
      query: 'villa',
      type: 'villa',
      status: 'draft',
      city: 'Riyadh',
      featured: true,
      includeArchived: true,
      page: 2,
    });
    expect(qs).toContain('q=villa');
    expect(qs).toContain('type=villa');
    expect(qs).toContain('status=draft');
    expect(qs).toContain('city=Riyadh');
    expect(qs).toContain('featured=true');
    expect(qs).toContain('archived=true');
    expect(qs).toContain('page=2');
  });

  it('omits page when page=1', () => {
    expect(
      serializeAdminPropertyFilters({ page: 1, includeArchived: false } as never),
    ).not.toContain('page=');
  });
});
