import { cn } from '@/lib/utils';
import type { AdminStatusValue } from '@/lib/validators/admin';

interface AdminStatusBadgeProps {
  status: AdminStatusValue;
  label: string;
}

/**
 * Small visual badge for an admin's status. Three tones:
 *   - active           → green-leaning teal (live + healthy)
 *   - deactivated      → muted charcoal (deliberately switched off)
 *   - pending_invite   → brass (mid-flight, awaiting acceptance)
 */
export function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  const tone = {
    active: 'bg-[#e3f0ec] text-[#15573e] border border-[#15573e]/30',
    deactivated: 'bg-canvas-sunken text-charcoal-muted border-outline-variant border',
    pending_invite: 'bg-brass-400/15 text-brass-700 border-brass-400/40 border',
  } as const;
  return (
    <span
      data-testid={`admin-status-${status}`}
      className={cn(
        'inline-block px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.16em] uppercase',
        tone[status],
      )}
    >
      {label}
    </span>
  );
}
