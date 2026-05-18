'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface AdminMobileMenuProps {
  openLabel: string;
  closeLabel: string;
  title: string;
  /** The server-rendered `<AdminSidebarContent>` tree. */
  children: ReactNode;
}

/**
 * Mobile drawer for the admin sidebar. Mirrors `src/components/public/
 * MobileDrawer.tsx` (Radix Dialog, slide-in from the inline-end edge,
 * focus trap, Esc to close) so admins get the same chrome behaviour as
 * visitors — see [[feedback_admin_ui_parity]].
 *
 * The trigger is a hamburger button that renders only `<md`. The drawer
 * panel auto-closes when the route changes (the user just clicked a
 * nav link) so the next page renders without the overlay lingering.
 *
 * Server-side admin nav tree is passed in via `children` — this keeps
 * the per-tier filtering + `getTranslations` lookups on the server.
 */
export function AdminMobileMenu({ openLabel, closeLabel, title, children }: AdminMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close on navigation — clicking a nav link inside the drawer
  // pushes a new route, the path changes, drawer dismisses.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={openLabel}
          className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-charcoal inline-flex h-10 w-10 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:hidden"
        >
          <HamburgerIcon />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'bg-teal-forest-900/60 fixed inset-0 z-40 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 start-0 z-50 flex w-72 max-w-[80vw] flex-col shadow-2xl',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-start',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-start',
            'focus:outline-none',
          )}
        >
          <div className="bg-charcoal flex items-center justify-between px-4 py-3">
            <Dialog.Title className="text-brass text-xs tracking-[0.18em] uppercase">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={closeLabel}
                className="text-canvas hover:text-brass-400 -me-2 inline-flex h-10 w-10 items-center justify-center transition-colors"
              >
                <CloseIcon />
              </button>
            </Dialog.Close>
          </div>
          <div className="bg-charcoal flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Same inline SVG icons used by the public MobileDrawer — kept inline
// so no icon font is loaded for the admin shell.
function HamburgerIcon() {
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <line x1="0" y1="1" x2="20" y2="1" />
      <line x1="0" y1="7" x2="20" y2="7" />
      <line x1="0" y1="13" x2="20" y2="13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="13" y2="13" />
      <line x1="13" y1="1" x2="1" y2="13" />
    </svg>
  );
}
