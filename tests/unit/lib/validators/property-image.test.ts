import { describe, expect, it } from 'vitest';

import { uploadMetadataSchema } from '@/lib/validators/property-image';

const VALID = {
  propertyId: '11111111-1111-7111-8111-111111111111',
  alt_ar: 'صورة فيلا',
  alt_en: 'Villa photo',
  position: 0,
};

describe('uploadMetadataSchema (PR 3.5d server-side multipart)', () => {
  it('accepts a well-formed metadata payload', () => {
    const out = uploadMetadataSchema.safeParse(VALID);
    expect(out.success).toBe(true);
  });

  it('coerces a string `position` (FormData values arrive as strings)', () => {
    const out = uploadMetadataSchema.safeParse({ ...VALID, position: '3' });
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.position).toBe(3);
  });

  it('defaults `position` to 0 when missing', () => {
    const { position: _drop, ...withoutPosition } = VALID;
    const out = uploadMetadataSchema.safeParse(withoutPosition);
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.position).toBe(0);
  });

  it('rejects a malformed property id (not a UUID)', () => {
    const out = uploadMetadataSchema.safeParse({ ...VALID, propertyId: 'not-a-uuid' });
    expect(out.success).toBe(false);
  });

  it('rejects empty alt text (both languages required, non-blank)', () => {
    expect(uploadMetadataSchema.safeParse({ ...VALID, alt_ar: '' }).success).toBe(false);
    expect(uploadMetadataSchema.safeParse({ ...VALID, alt_en: '' }).success).toBe(false);
    expect(uploadMetadataSchema.safeParse({ ...VALID, alt_ar: '   ' }).success).toBe(false);
  });

  it('rejects out-of-range position', () => {
    expect(uploadMetadataSchema.safeParse({ ...VALID, position: -1 }).success).toBe(false);
    expect(uploadMetadataSchema.safeParse({ ...VALID, position: 100 }).success).toBe(false);
  });
});
