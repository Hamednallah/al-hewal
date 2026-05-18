---
name: feedback-admin-ui-parity
description: "Admin UI must match the public website's look + chrome behaviour. Reuse public components (Button, MobileDrawer, Pagination patterns, form fields) instead of building parallel admin versions. The admin sidebar must be collapsible on mobile the same way the public Nav uses MobileDrawer."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

The admin surface (Phase 3) must look and behave like the public website (Phase 2), not feel like a separate app.

**Why:** the owner reviews the admin alongside the public site and asked explicitly: "make sure the UI is consistent with the public website, and the side menu must be closable as the public website. Try to reuse existing components, and don't reinvent the wheel." Parallel-tracking the design (one set of buttons for public, another for admin) wastes effort and drifts the visual language. The Stitch mockups for the admin (`admin_*` folders) are a _target_, not an excuse to invent new primitives.

**How to apply** — before writing a new admin component, ALWAYS check:

1. **Public Button** (`src/components/ui/button.tsx` — re-themed shadcn) covers primary / outline / ghost variants. Use it for every admin button instead of bespoke `<button className="bg-teal-forest-700 ...">`.
2. **MobileDrawer** (`src/components/public/MobileDrawer.tsx` — Radix Dialog wrapper) is the canonical mobile drawer. The admin sidebar must open/close via the same pattern on `<md` viewports — hamburger trigger in the topbar opens a drawer containing the sidebar content.
3. **Pagination** (`src/components/public/Pagination.tsx`) and **FilterBar** patterns are already proven. If the admin equivalent diverges visually, push back on the diff before merging.
4. **Field / FieldTextarea** patterns in `src/components/public/ContactForm.tsx` (the inline `Field` helpers) are the canonical form-field style. Admin forms should mirror them so the visual rhythm matches.
5. **Nav** (`src/components/public/Nav.tsx`) sets the topbar shape (logo on one side, controls on the other). Admin topbar should follow the same horizontal layout.

When a public component genuinely doesn't fit (e.g. the admin sidebar's tier-driven nav doesn't exist in the public Nav), extract the shared piece into `src/components/ui/*` rather than duplicating. The goal is one design system, two audiences.

See also: [[feedback_pushback_on_reviews]] — defend the reuse decision in the PR description when a reviewer asks why a component looks "the same" between public and admin (that's the point).
