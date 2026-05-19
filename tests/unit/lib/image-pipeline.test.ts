import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_INPUT_MIME_TYPES,
  ImagePipelineError,
  MAX_DIMENSION_PX,
  MAX_INPUT_BYTES,
  processImage,
} from '@/lib/image-pipeline';

const fixturePath = (name: string) => join(process.cwd(), 'tests/fixtures', name);

async function loadSample(): Promise<Buffer> {
  return readFile(fixturePath('sample-400x300.jpg'));
}

describe('processImage — happy path', () => {
  it('produces both AVIF + WebP variants with expected MIME types', async () => {
    const buffer = await loadSample();
    const result = await processImage({ buffer, contentType: 'image/jpeg' });
    expect(result.avif.contentType).toBe('image/avif');
    expect(result.webp.contentType).toBe('image/webp');
    expect(result.avif.body.byteLength).toBeGreaterThan(0);
    expect(result.webp.body.byteLength).toBeGreaterThan(0);
  });

  it('preserves the source aspect ratio and stays within the 2400 px cap', async () => {
    const buffer = await loadSample();
    const result = await processImage({ buffer, contentType: 'image/jpeg' });
    // The fixture is 400x300 — well under the cap, so dimensions are
    // preserved without enlargement.
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    expect(result.width).toBeLessThanOrEqual(MAX_DIMENSION_PX);
    expect(result.height).toBeLessThanOrEqual(MAX_DIMENSION_PX);
  });

  it('emits a non-empty blurhash string', async () => {
    const buffer = await loadSample();
    const result = await processImage({ buffer, contentType: 'image/jpeg' });
    expect(result.blurhash).toMatch(/^[\w!#$%*+,./:;<=>?@[\]^_`{|}~-]+$/);
    expect(result.blurhash.length).toBeGreaterThan(20);
  });

  it('strips EXIF metadata from the encoded variants', async () => {
    const sharp = (await import('sharp')).default;
    const buffer = await loadSample();
    const result = await processImage({ buffer, contentType: 'image/jpeg' });
    const avifMeta = await sharp(result.avif.body).metadata();
    const webpMeta = await sharp(result.webp.body).metadata();
    // The fixture was written with `Make`/`Model` EXIF. After the pipeline
    // both outputs must be EXIF-clean.
    expect(avifMeta.exif).toBeUndefined();
    expect(webpMeta.exif).toBeUndefined();
  });
});

describe('processImage — error handling', () => {
  it('throws ImagePipelineError(input_too_large) when the buffer exceeds the byte cap', async () => {
    // Stub a buffer just over the byte cap. Cheap allocation since the
    // pipeline rejects before any sharp work.
    const oversized = Buffer.alloc(MAX_INPUT_BYTES + 1);
    await expect(processImage({ buffer: oversized, contentType: 'image/jpeg' })).rejects.toThrow(
      ImagePipelineError,
    );
    await expect(
      processImage({ buffer: oversized, contentType: 'image/jpeg' }),
    ).rejects.toMatchObject({
      code: 'input_too_large',
    });
  });

  it('throws ImagePipelineError(unsupported_format) for content types outside the allowlist', async () => {
    const buffer = await loadSample();
    await expect(processImage({ buffer, contentType: 'image/gif' })).rejects.toMatchObject({
      code: 'unsupported_format',
    });
  });

  it('throws ImagePipelineError(decode_failed) for malformed image bytes', async () => {
    const junk = Buffer.from('definitely not an image');
    await expect(processImage({ buffer: junk, contentType: 'image/jpeg' })).rejects.toMatchObject({
      code: 'decode_failed',
    });
  });
});

describe('ACCEPTED_INPUT_MIME_TYPES', () => {
  it('lists exactly the formats the pipeline accepts (defensive snapshot)', () => {
    expect([...ACCEPTED_INPUT_MIME_TYPES].sort()).toEqual(
      ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'].sort(),
    );
  });
});
