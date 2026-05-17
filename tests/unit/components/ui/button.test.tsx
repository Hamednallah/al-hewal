import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders a <button> by default with the provided label', () => {
    render(<Button>Book viewing</Button>);
    const btn = screen.getByRole('button', { name: 'Book viewing' });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('fires onClick when activated', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>WhatsApp</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies the primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button');
    // Primary variant uses Forest Teal background; the exact class name
    // is locked to the design system, so tests assert the literal token.
    expect(btn.className).toContain('bg-teal-forest-500');
  });

  it('applies a different variant when requested', () => {
    render(<Button variant="secondary">Brass</Button>);
    expect(screen.getByRole('button').className).toContain('bg-brass-400');
  });

  it('merges user-supplied className without losing variant classes', () => {
    render(
      <Button className="w-full" data-testid="cta">
        Full width
      </Button>,
    );
    const btn = screen.getByTestId('cta');
    expect(btn.className).toContain('w-full');
    expect(btn.className).toContain('bg-teal-forest-500');
  });

  it('respects size variants', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').className).toContain('text-base');
  });

  it('disabled prop disables the element', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders as the child element when asChild is set (Radix Slot)', () => {
    // External href so @next/next/no-html-link-for-pages does not flag
    // the raw <a>. The test is about Slot composition, not navigation.
    render(
      <Button asChild>
        <a href="https://example.com/contact">Contact</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Contact' });
    expect(link.tagName).toBe('A');
    // The styles still apply to the slotted child.
    expect(link.className).toContain('bg-teal-forest-500');
  });
});
