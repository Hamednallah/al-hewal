import { describe, expect, it } from 'vitest';

import { validateUploadCandidate } from '@/lib/client-image-validation';
import { ACCEPTED_INPUT_MIME_TYPES, MAX_INPUT_BYTES } from '@/lib/image-constants';

describe('validateUploadCandidate — accept path', () => {
  it.each(ACCEPTED_INPUT_MIME_TYPES.map((mime) => [mime] as const))(
    'accepts %s under the byte cap',
    (mime) => {
      const out = validateUploadCandidate({ type: mime, size: 1024 });
      expect(out.ok).toBe(true);
      if (out.ok) expect(out.mime).toBe(mime);
    },
  );

  it('lowercases the candidate MIME before checking the allowlist', () => {
    const out = validateUploadCandidate({ type: 'IMAGE/JPEG', size: 1024 });
    expect(out.ok).toBe(true);
  });
});

describe('validateUploadCandidate — reject path', () => {
  it('rejects MIME types outside the allowlist', () => {
    const out = validateUploadCandidate({ type: 'image/gif', size: 1024 });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('unsupported_format');
      expect(out.error).toMatchObject({ mime: 'image/gif' });
    }
  });

  it('rejects PDFs and other non-image MIMEs', () => {
    const out = validateUploadCandidate({ type: 'application/pdf', size: 1024 });
    expect(out.ok).toBe(false);
  });

  it('rejects oversized files even when the MIME is allowed', () => {
    const out = validateUploadCandidate({ type: 'image/jpeg', size: MAX_INPUT_BYTES + 1 });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('input_too_large');
      expect(out.error).toMatchObject({ bytes: MAX_INPUT_BYTES + 1 });
    }
  });

  it('treats empty MIME string as unsupported (matches server pipeline)', () => {
    const out = validateUploadCandidate({ type: '', size: 1024 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('unsupported_format');
  });
});
