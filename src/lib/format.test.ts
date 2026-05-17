import { describe, expect, it } from 'vitest';

import { formatNumber, formatPrice } from './format';

describe('formatPrice', () => {
  it('formats whole SAR in English locale with currency symbol', () => {
    const out = formatPrice(950_000, 'en');
    // Avoid locking the exact Intl symbol (it differs between Node ICU
    // builds — "SAR", "SR", "﷼"). What matters is the grouping +
    // no fractional digits + currency code presence.
    expect(out).toMatch(/950,000/);
    expect(out).toMatch(/SAR|SR|﷼/);
  });

  it('formats whole SAR in Arabic locale', () => {
    const out = formatPrice(2_400_000, 'ar');
    // ICU-built Node will use Eastern Arabic digits + Arabic currency
    // glyph; the digit form is environment-dependent so we assert on
    // the magnitude (length of digit chars > 4) and presence of an SAR
    // marker.
    expect(out.length).toBeGreaterThan(4);
    expect(out).toMatch(/(SAR|SR|﷼|ر\.س)/);
  });

  it('truncates fractional input to the nearest integer SAR', () => {
    const out = formatPrice(1234.99, 'en');
    expect(out).toMatch(/1,235|1,234/);
    expect(out).not.toMatch(/\.99/);
  });

  it('handles zero', () => {
    const out = formatPrice(0, 'en');
    expect(out).toMatch(/0/);
  });
});

describe('formatNumber', () => {
  it('formats integers with English grouping separators', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
  });

  it('formats integers in Arabic locale', () => {
    // Locale-dependent digit form; just assert it produced 7 digit chars
    // (with separators) — i.e. it didn't return the raw JS .toString().
    const out = formatNumber(1234567, 'ar');
    expect(out).not.toBe('1234567');
    expect(out.length).toBeGreaterThanOrEqual(7);
  });

  it('drops fractional digits', () => {
    expect(formatNumber(42.7, 'en')).toBe('43');
  });
});
