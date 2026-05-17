import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins plain class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('omits falsy entries', () => {
    expect(cn('px-2', false, null, undefined, '')).toBe('px-2');
  });

  it('honours conditional shorthand', () => {
    const active = true;
    const disabled = false;
    expect(cn('btn', active && 'btn-active', disabled && 'btn-disabled')).toBe('btn btn-active');
  });

  it('resolves Tailwind class conflicts (last write wins)', () => {
    // Without twMerge the result would be 'px-2 px-4' and the cascade
    // would pick whichever class appears later in the generated
    // stylesheet — unpredictable. twMerge keeps only `px-4`.
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('accepts arrays and object shorthand from clsx', () => {
    expect(cn(['foo', 'bar'], { baz: true, qux: false })).toBe('foo bar baz');
  });
});
