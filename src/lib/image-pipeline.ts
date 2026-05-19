import 'server-only';

import { encode as encodeBlurhash } from 'blurhash';
import sharp from 'sharp';

import {
  ACCEPTED_INPUT_MIME_TYPES,
  type AcceptedInputMimeType,
  MAX_DIMENSION_PX,
  MAX_INPUT_BYTES,
  MAX_INPUT_PIXELS,
} from '@/lib/image-constants';

export {
  ACCEPTED_INPUT_MIME_TYPES,
  type AcceptedInputMimeType,
  MAX_DIMENSION_PX,
  MAX_INPUT_BYTES,
  MAX_INPUT_PIXELS,
};

/**
 * Server-side image processing pipeline (PR 3.5a).
 *
 * Takes a raw uploaded image (any format `sharp` can read) and produces:
 *   - A normalised AVIF variant (modern compression, ~30% smaller than
 *     WebP for the same visual quality).
 *   - A normalised WebP fallback (every relevant browser supports it;
 *     used as the `<picture>` fallback for the small slice of clients
 *     that still don't decode AVIF).
 *   - A 32-component blurhash for inline LQIP — embedded in the
 *     `property_images` row and rendered as a CSS background while the
 *     real image streams in.
 *   - The final on-disk dimensions, so Next/Image can render with the
 *     correct width/height and avoid CLS.
 *
 * All variants are EXIF-stripped (sharp's default — no metadata is
 * carried into the output) and capped at a 2400 px longest edge so a
 * 6000 px DSLR source doesn't bloat the public catalog. The aspect
 * ratio of the original is preserved.
 *
 * Hard caps:
 *   - Input bytes: 25 MB (rejected before sharp touches it).
 *   - Decoded pixel count: 50 MP (sharp limit; safety net against
 *     pixel-bomb inputs even when the byte count is small).
 *
 * Pricing note: each upload produces 2 stored variants. On Vercel
 * Blob's Hobby plan (5 GB included) that lets us host ~5000 photos
 * at ~500 KB combined per source. Comfortable for Phase 3 launch.
 */

export interface ProcessedVariant {
  /** MIME type for the `<source type="…">` and Blob `contentType` header. */
  contentType: 'image/avif' | 'image/webp';
  /** Encoded bytes ready to upload to Vercel Blob. */
  body: Buffer;
  /** Bytes (== body.byteLength). Persisted on `property_images.bytes` for the primary variant. */
  bytes: number;
}

export interface ProcessImageResult {
  /** AVIF variant — primary URL stored on `property_images.blob_url`. */
  avif: ProcessedVariant;
  /** WebP variant — fallback URL stored under a sibling pathname. */
  webp: ProcessedVariant;
  /** Final pixel dimensions, after the 2400 px longest-edge cap. */
  width: number;
  height: number;
  /** 32-component blurhash (`encode(pixels, w, h, 4, 4)`). */
  blurhash: string;
}

export class ImagePipelineError extends Error {
  constructor(
    public readonly code:
      | 'input_too_large'
      | 'unsupported_format'
      | 'decode_failed'
      | 'pixel_limit_exceeded',
    message: string,
  ) {
    super(message);
    this.name = 'ImagePipelineError';
  }
}

/**
 * Run the full pipeline against a single buffered upload. Throws
 * `ImagePipelineError` on bad input so the route handler can map error
 * codes to user-facing translations. Any other thrown error is a real
 * server bug and should surface as 500.
 */
export async function processImage(input: {
  buffer: Buffer;
  contentType: string;
}): Promise<ProcessImageResult> {
  if (input.buffer.byteLength > MAX_INPUT_BYTES) {
    throw new ImagePipelineError(
      'input_too_large',
      `Upload exceeded the ${Math.round(MAX_INPUT_BYTES / 1024 / 1024)} MB byte cap.`,
    );
  }
  if (!ACCEPTED_INPUT_MIME_TYPES.includes(input.contentType as AcceptedInputMimeType)) {
    throw new ImagePipelineError(
      'unsupported_format',
      `Unsupported content type: ${input.contentType}.`,
    );
  }

  const pipeline = sharp(input.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'truncated' });

  let metadata: sharp.Metadata;
  try {
    metadata = await pipeline.metadata();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes('pixel')) {
      throw new ImagePipelineError('pixel_limit_exceeded', message);
    }
    throw new ImagePipelineError('decode_failed', message);
  }

  if (!metadata.width || !metadata.height) {
    throw new ImagePipelineError('decode_failed', 'Missing width/height in image metadata.');
  }

  // Two sharp pipelines run in parallel — one per output variant. Each
  // starts from a fresh `sharp(input.buffer)` to avoid the documented
  // pitfall of reusing a stream after it's been consumed.
  const [avifBody, webpBody, blurhash, finalDims] = await Promise.all([
    encodeVariant(input.buffer, 'avif'),
    encodeVariant(input.buffer, 'webp'),
    computeBlurhash(input.buffer),
    measureFinalDimensions(input.buffer),
  ]);

  return {
    avif: { contentType: 'image/avif', body: avifBody, bytes: avifBody.byteLength },
    webp: { contentType: 'image/webp', body: webpBody, bytes: webpBody.byteLength },
    width: finalDims.width,
    height: finalDims.height,
    blurhash,
  };
}

async function encodeVariant(buffer: Buffer, format: 'avif' | 'webp'): Promise<Buffer> {
  const pipeline = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // Apply EXIF orientation, then drop EXIF below via the format options.
    .resize({
      width: MAX_DIMENSION_PX,
      height: MAX_DIMENSION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    });
  // `withMetadata` is NOT called → EXIF is stripped (sharp's default).
  if (format === 'avif') {
    return pipeline.avif({ quality: 65, effort: 4 }).toBuffer();
  }
  return pipeline.webp({ quality: 80, effort: 4 }).toBuffer();
}

async function measureFinalDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  // Re-measure after the resize so we persist the on-disk dimensions
  // (not the source's). Cheap — sharp doesn't decode the full image to
  // compute final metadata from a chained pipeline.
  const meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({
      width: MAX_DIMENSION_PX,
      height: MAX_DIMENSION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer({ resolveWithObject: true });
  return { width: meta.info.width, height: meta.info.height };
}

async function computeBlurhash(buffer: Buffer): Promise<string> {
  // Blurhash works on raw RGBA at a small fixed size. 32x32 is the
  // sweet spot — large enough that the encode catches significant
  // edges, small enough that encode/decode are fast (< 1 ms each).
  const BLURHASH_DIM = 32;
  const { data, info } = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(BLURHASH_DIM, BLURHASH_DIM, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encodeBlurhash(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    4, // X components
    4, // Y components — `4x4` is the de-facto standard, ~30 chars output
  );
}
