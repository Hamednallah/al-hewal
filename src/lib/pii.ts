/**
 * PII scrubbing helpers used by every server route before any
 * console.warn / Sentry capture.
 *
 * Two complementary mechanisms:
 *   1. Regex-based masking inside string values (emails, IPv4s, phone-
 *      shaped digit runs). Catches PII that leaked into a log message.
 *   2. Key-name redaction inside objects (`phone`, `email`, `ip`,
 *      `*_token`, `*_secret`, `*_key`). Catches PII stored on a value
 *      whose own contents aren't recognisably formatted (a redacted
 *      token doesn't look like an email).
 *
 * `scrubPii(value)` recurses into arrays + nested objects so a single
 * call at the log boundary is enough — callers don't need to walk
 * their own structures.
 */

// Anchored to a trailing digit so the regex never eats whitespace or
// punctuation that follows the phone number — keeps the scrubbed log
// message readable ("call [phone] now", not "call [phone]now").
const PHONE_REGEX = /\+?\d[\d\s().-]{5,}\d/g;
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const IPV4_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

export function scrubPii<T>(value: T): T {
  return scrub(value) as T;
}

function scrub(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = scrub(v);
      }
    }
    return out;
  }
  return value;
}

function scrubString(s: string): string {
  return s
    .replace(EMAIL_REGEX, '[email]')
    .replace(IPV4_REGEX, '[ip]')
    .replace(PHONE_REGEX, '[phone]');
}

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === 'phone' ||
    k === 'email' ||
    k === 'ip' ||
    k === 'ip_address' ||
    k === 'password' ||
    k === 'token' ||
    k.endsWith('_token') ||
    k.endsWith('_secret') ||
    k.endsWith('_key')
  );
}
