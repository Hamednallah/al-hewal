import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Button — Al Hewal design system primitive.
 *
 * Sharp 0px corners (architectural rectangles). Three variants matched
 * to the Stitch mockups:
 *   - `primary`   Solid Forest Teal background with Brass text; the
 *                 default CTA on dark hero overlays.
 *   - `secondary` Solid Brass background with Teal text; reserved for
 *                 the conversion CTAs ("Book Viewing", "WhatsApp"). Per
 *                 CLAUDE.md, brass is never used as body text on light
 *                 backgrounds — this variant works because the button
 *                 is a discrete block, not body copy.
 *   - `ghost`     Transparent with a 2px outline; for tertiary actions
 *                 and over hero photography.
 *
 * Three sizes scale the padding + label size while preserving the
 * label-caps uppercase tracking.
 *
 * `asChild` (via Radix Slot) lets us render the same styles on top of
 * <Link> or <a> elements without losing semantics.
 */
const buttonVariants = cva(
  // Base: sharp rectangle, label-caps typography, motion-safe transitions,
  // visible focus, disabled state. Tracking matches DESIGN.md label-caps.
  'focus-visible:ring-brass-400 focus-visible:ring-offset-canvas inline-flex items-center justify-center gap-2 font-bold tracking-[0.1em] whitespace-nowrap uppercase transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-teal-forest-500 text-brass-400 hover:bg-brass-400 hover:text-teal-forest-700 border-teal-forest-500 hover:border-brass-400 border',
        secondary:
          'bg-brass-400 text-teal-forest-700 hover:bg-brass-600 hover:text-canvas border-brass-400 hover:border-brass-600 border',
        ghost:
          'text-canvas border-canvas/30 hover:bg-canvas/10 hover:border-canvas/60 border-2 bg-transparent',
        outline:
          'text-teal-forest-700 border-teal-forest-700 hover:bg-teal-forest-700 hover:text-canvas border-2 bg-transparent',
      },
      size: {
        sm: 'px-4 py-2 text-xs',
        md: 'px-6 py-3 text-sm',
        lg: 'px-8 py-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
