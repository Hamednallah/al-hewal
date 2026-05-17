import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names with conflict resolution.
 *
 * `cn('px-2 py-1', condition && 'px-4')` -> `'py-1 px-4'`
 *
 * `clsx` handles conditional / array / object inputs; `twMerge` resolves
 * conflicts so the last Tailwind utility wins (otherwise both classes ship
 * to the DOM and the cascade picks whichever appears later in the
 * generated stylesheet, which is unpredictable).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
