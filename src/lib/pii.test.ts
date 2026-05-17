import { describe, expect, it } from 'vitest';

import { scrubPii } from './pii';

describe('scrubPii — strings', () => {
  it('masks email addresses', () => {
    expect(scrubPii('email me at jane@example.com please')).toBe('email me at [email] please');
  });

  it('masks IPv4 addresses', () => {
    expect(scrubPii('failed for 203.0.113.5')).toBe('failed for [ip]');
  });

  it('masks phone-shaped digit runs', () => {
    expect(scrubPii('call +966 50 123 4567 now')).toMatch(/call \[phone\] now/);
  });

  it('leaves non-PII strings untouched', () => {
    expect(scrubPii('Hello world, no secrets here')).toBe('Hello world, no secrets here');
  });
});

describe('scrubPii — objects', () => {
  it('redacts sensitive keys by name', () => {
    const out = scrubPii({
      name: 'Jane',
      phone: '+966500000000',
      email: 'jane@example.com',
      ip: '203.0.113.5',
      api_token: 'sk-secret',
    });
    expect(out).toEqual({
      name: 'Jane',
      phone: '[redacted]',
      email: '[redacted]',
      ip: '[redacted]',
      api_token: '[redacted]',
    });
  });

  it('recurses into nested objects', () => {
    const out = scrubPii({
      lead: {
        name: 'Jane',
        contact: {
          phone: '+966500000000',
          email: 'jane@example.com',
        },
      },
    });
    expect(out).toEqual({
      lead: {
        name: 'Jane',
        contact: {
          phone: '[redacted]',
          email: '[redacted]',
        },
      },
    });
  });

  it('recurses into arrays', () => {
    const out = scrubPii({
      contacts: [
        { name: 'A', email: 'a@example.com' },
        { name: 'B', email: 'b@example.com' },
      ],
    });
    expect(out).toEqual({
      contacts: [
        { name: 'A', email: '[redacted]' },
        { name: 'B', email: '[redacted]' },
      ],
    });
  });

  it('scrubs PII inside non-sensitive string values', () => {
    const out = scrubPii({
      note: 'spoke to jane@example.com about the project',
    });
    expect(out).toEqual({
      note: 'spoke to [email] about the project',
    });
  });

  it('returns null / undefined / primitives untouched', () => {
    expect(scrubPii(null)).toBeNull();
    expect(scrubPii(undefined)).toBeUndefined();
    expect(scrubPii(42)).toBe(42);
    expect(scrubPii(true)).toBe(true);
  });
});
