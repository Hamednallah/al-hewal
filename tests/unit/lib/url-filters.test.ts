import { describe, expect, it } from 'vitest';

import {
  hasActiveFilters,
  MAX_PAGE,
  MAX_QUERY_LENGTH,
  parseCatalogFilters,
  serializeCatalogFilters,
} from '@/lib/url-filters';

describe('parseCatalogFilters', () => {
  it('returns sensible defaults for an empty searchParams object', () => {
    expect(parseCatalogFilters({})).toEqual({
      type: null,
      city: null,
      minPrice: null,
      maxPrice: null,
      query: null,
      page: 1,
    });
  });

  it('parses a fully-populated query string', () => {
    const filters = parseCatalogFilters({
      type: 'villa',
      city: 'Riyadh',
      minPrice: '500000',
      maxPrice: '2000000',
      q: 'al-dana',
      page: '3',
    });
    expect(filters.type).toBe('villa');
    expect(filters.city).toBe('Riyadh');
    expect(filters.minPrice).toBe(500000);
    expect(filters.maxPrice).toBe(2000000);
    expect(filters.query).toBe('al-dana');
    expect(filters.page).toBe(3);
  });

  it('drops unknown property types', () => {
    expect(parseCatalogFilters({ type: 'castle' }).type).toBeNull();
  });

  it('drops malformed prices (NaN, negative)', () => {
    expect(parseCatalogFilters({ minPrice: 'abc' }).minPrice).toBeNull();
    expect(parseCatalogFilters({ maxPrice: '-1000' }).maxPrice).toBeNull();
  });

  it('clamps page to the [1, MAX_PAGE] range', () => {
    expect(parseCatalogFilters({ page: '0' }).page).toBe(1);
    expect(parseCatalogFilters({ page: '-5' }).page).toBe(1);
    expect(parseCatalogFilters({ page: '9999' }).page).toBe(MAX_PAGE);
    expect(parseCatalogFilters({ page: 'abc' }).page).toBe(1);
  });

  it('caps the search query at MAX_QUERY_LENGTH chars', () => {
    const longQuery = 'a'.repeat(MAX_QUERY_LENGTH + 50);
    expect(parseCatalogFilters({ q: longQuery }).query?.length).toBe(MAX_QUERY_LENGTH);
  });

  it('trims whitespace-only query to null', () => {
    expect(parseCatalogFilters({ q: '   ' }).query).toBeNull();
  });

  it('rejects an overly long city name', () => {
    expect(parseCatalogFilters({ city: 'x'.repeat(100) }).city).toBeNull();
  });

  it('picks the first value when a key is duplicated as an array', () => {
    expect(parseCatalogFilters({ type: ['villa', 'duplex'] }).type).toBe('villa');
  });
});

describe('serializeCatalogFilters', () => {
  it('returns an empty string when no filter is set', () => {
    expect(
      serializeCatalogFilters({
        type: null,
        city: null,
        minPrice: null,
        maxPrice: null,
        query: null,
        page: 1,
      }),
    ).toBe('');
  });

  it('serialises every set filter and skips page=1', () => {
    const qs = serializeCatalogFilters({
      type: 'villa',
      city: 'Riyadh',
      minPrice: 500000,
      maxPrice: 2000000,
      query: 'al-dana',
      page: 1,
    });
    expect(qs).toContain('type=villa');
    expect(qs).toContain('city=Riyadh');
    expect(qs).toContain('minPrice=500000');
    expect(qs).toContain('maxPrice=2000000');
    expect(qs).toContain('q=al-dana');
    expect(qs).not.toContain('page=');
  });

  it('serialises page when > 1', () => {
    expect(serializeCatalogFilters({ page: 3 })).toBe('page=3');
  });

  it('skips a zero minPrice / maxPrice (treats as unset)', () => {
    expect(serializeCatalogFilters({ minPrice: 0, maxPrice: 0 })).toBe('');
  });
});

describe('hasActiveFilters', () => {
  it('returns false for the default filter state', () => {
    expect(
      hasActiveFilters({
        type: null,
        city: null,
        minPrice: null,
        maxPrice: null,
        query: null,
        page: 1,
      }),
    ).toBe(false);
  });

  it('returns false when only page > 1 is set (page is not a "filter")', () => {
    expect(
      hasActiveFilters({
        type: null,
        city: null,
        minPrice: null,
        maxPrice: null,
        query: null,
        page: 5,
      }),
    ).toBe(false);
  });

  it('returns true when any real filter is set', () => {
    expect(
      hasActiveFilters({
        type: 'villa',
        city: null,
        minPrice: null,
        maxPrice: null,
        query: null,
        page: 1,
      }),
    ).toBe(true);
  });
});
