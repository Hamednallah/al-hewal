import { describe, expect, it } from 'vitest';

import { createPropertySchema, slugifyTitle } from '@/lib/validators/property';

describe('slugifyTitle', () => {
  it('lowercases + hyphenates an English phrase', () => {
    expect(slugifyTitle('The Onyx Residence')).toBe('the-onyx-residence');
  });

  it('strips diacritics and non-alphanumerics', () => {
    // NFKD decomposes "ô" into "o" + combining ̂; the regex strips combining marks.
    expect(slugifyTitle('Villa La Côte!!')).toBe('villa-la-cote');
  });

  it('collapses whitespace and trims hyphens from both ends', () => {
    expect(slugifyTitle('  Hello   World  ')).toBe('hello-world');
  });

  it('caps the result at 80 characters', () => {
    const long = 'word '.repeat(40);
    expect(slugifyTitle(long).length).toBeLessThanOrEqual(80);
  });
});

describe('createPropertySchema', () => {
  const validBody = {
    title_ar: 'فيلا',
    title_en: 'Villa',
    description_ar: 'وصف',
    description_en: 'Description',
    type: 'villa',
    status: 'draft',
    price_sar: 2_500_000,
    area_sqm: 400,
    bedrooms: 4,
    bathrooms: 3,
    city: 'Riyadh',
  };

  it('accepts a minimal valid payload', () => {
    const parsed = createPropertySchema.safeParse(validBody);
    expect(parsed.success).toBe(true);
  });

  it('rejects an oversized title', () => {
    const parsed = createPropertySchema.safeParse({
      ...validBody,
      title_en: 'x'.repeat(300),
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects negative prices', () => {
    const parsed = createPropertySchema.safeParse({ ...validBody, price_sar: -1 });
    expect(parsed.success).toBe(false);
  });

  it('rejects an invalid property type', () => {
    const parsed = createPropertySchema.safeParse({ ...validBody, type: 'not-a-type' });
    expect(parsed.success).toBe(false);
  });

  it('coerces numeric strings (the form posts them as strings via JSON)', () => {
    const parsed = createPropertySchema.safeParse({
      ...validBody,
      price_sar: '3000000',
      bedrooms: '5',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.price_sar).toBe(3000000);
      expect(parsed.data.bedrooms).toBe(5);
    }
  });

  it('accepts an explicit valid slug', () => {
    const parsed = createPropertySchema.safeParse({ ...validBody, slug: 'al-dana-21' });
    expect(parsed.success).toBe(true);
  });

  it('rejects a slug with capitals or spaces', () => {
    const parsed = createPropertySchema.safeParse({ ...validBody, slug: 'Al Dana 21' });
    expect(parsed.success).toBe(false);
  });
});
