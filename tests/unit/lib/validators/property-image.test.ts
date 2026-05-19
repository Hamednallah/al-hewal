import { describe, expect, it } from 'vitest';

import { uploadRequestSchema } from '@/lib/validators/property-image';

const VALID = {
  propertyId: '11111111-1111-7111-8111-111111111111',
  alt_ar: 'صورة فيلا',
  alt_en: 'Villa photo',
  position: 0,
  filename: 'villa-hero.jpg',
  contentType: 'image/jpeg' as const,
};

describe('uploadRequestSchema', () => {
  it('accepts a well-formed upload request', () => {
    const out = uploadRequestSchema.safeParse(VALID);
    expect(out.success).toBe(true);
  });

  it('coerces a string `position` to a number', () => {
    const out = uploadRequestSchema.safeParse({ ...VALID, position: '3' });
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.position).toBe(3);
  });

  it('rejects a malformed property id (not a UUID)', () => {
    const out = uploadRequestSchema.safeParse({ ...VALID, propertyId: 'not-a-uuid' });
    expect(out.success).toBe(false);
  });

  it('rejects empty alt text (both languages required, non-blank)', () => {
    expect(uploadRequestSchema.safeParse({ ...VALID, alt_ar: '' }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...VALID, alt_en: '' }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...VALID, alt_ar: '   ' }).success).toBe(false);
  });

  it('rejects out-of-range position', () => {
    expect(uploadRequestSchema.safeParse({ ...VALID, position: -1 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...VALID, position: 100 }).success).toBe(false);
  });

  it('rejects content types outside the accepted MIME list (defence in depth on top of the pipeline)', () => {
    expect(uploadRequestSchema.safeParse({ ...VALID, contentType: 'image/gif' }).success).toBe(
      false,
    );
    expect(
      uploadRequestSchema.safeParse({ ...VALID, contentType: 'application/pdf' }).success,
    ).toBe(false);
  });

  it('rejects an oversized filename', () => {
    const long = 'x'.repeat(256);
    expect(uploadRequestSchema.safeParse({ ...VALID, filename: long }).success).toBe(false);
  });
});
