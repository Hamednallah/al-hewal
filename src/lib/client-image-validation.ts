import {
  ACCEPTED_INPUT_MIME_TYPES,
  type AcceptedInputMimeType,
  MAX_INPUT_BYTES,
} from '@/lib/image-constants';

/**
 * Client-side mirror of the server's `image-pipeline` accept rules.
 *
 * Runs in the browser BEFORE the upload kicks off so admins get
 * instant feedback ("that .gif isn't supported", "12 GB raw is too
 * big") instead of waiting for the round-trip + Blob upload to fail.
 * The server still re-validates the same caps as the authoritative
 * source — see `processImage` in `lib/image-pipeline.ts`.
 *
 * Imported by both the client uploader component and the unit tests.
 * Lives outside `image-pipeline.ts` because `image-pipeline.ts` is
 * `server-only` (it pulls in `sharp`).
 */

export type ValidationError =
  | { code: 'unsupported_format'; mime: string }
  | { code: 'input_too_large'; bytes: number };

export function validateUploadCandidate(file: {
  type: string;
  size: number;
}): { ok: true; mime: AcceptedInputMimeType } | { ok: false; error: ValidationError } {
  const candidateMime = file.type.toLowerCase();
  if (!ACCEPTED_INPUT_MIME_TYPES.includes(candidateMime as AcceptedInputMimeType)) {
    return { ok: false, error: { code: 'unsupported_format', mime: candidateMime } };
  }
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, error: { code: 'input_too_large', bytes: file.size } };
  }
  return { ok: true, mime: candidateMime as AcceptedInputMimeType };
}

export { ACCEPTED_INPUT_MIME_TYPES, MAX_INPUT_BYTES } from '@/lib/image-constants';
