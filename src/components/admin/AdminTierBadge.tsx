import { cn } from '@/lib/utils';
import type { AdminTierValue } from '@/lib/validators/admin';

interface AdminTierBadgeProps {
  tier: AdminTierValue;
  label: string;
}

/**
 * Small visual badge for an admin's tier. Brass-on-teal for super_admin
 * (the high-trust tier), neutral charcoal-on-canvas for standard_admin.
 */
export function AdminTierBadge({ tier, label }: AdminTierBadgeProps) {
  const isSuper = tier === 'super_admin';
  return (
    <span
      data-testid={`admin-tier-${tier}`}
      className={cn(
        'inline-block px-2 py-0.5 text-sm font-semibold tracking-[0.16em] uppercase',
        isSuper
          ? 'bg-teal-forest-700 text-brass-400'
          : 'bg-canvas-sunken text-charcoal-muted border-outline-variant border',
      )}
    >
      {label}
    </span>
  );
}
