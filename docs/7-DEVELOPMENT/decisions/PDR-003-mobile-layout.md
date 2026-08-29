# PDR-003: Mobile-capable layout by default; desktop (lg and up) is the reference experience

- **Status**: Accepted
- **Date**: 2026-08
- **Related**: [code-standards.md](../code-standards.md) (Responsive & Mobile), [frontend/AGENTS.md](../../../frontend/AGENTS.md), [ADR-003](ADR-003-streamlit-to-nextjs.md)

## Context

Open Notebook is used on laptops and desktops first, but a growing share of readers and operators reach it from phones and tablets — reviewing podcasts, reading sources, and light note-taking are the natural mobile uses. The existing UI was built desktop-first and never audited for small screens, so real defects accumulated: fixed pixel widths that force horizontal scroll (`min-w-[920px]` sources table, 500px-tall wizards), hover-only controls invisible on touch, `vh`-based heights that ignore mobile URL bars, and dialogs whose footers were clipped below the fold.

Fixing this case-by-case without a shared standard would just drift: every new page would re-decide what "mobile" means.

## Decision

The frontend is **mobile-capable by default**: every screen must be usable at 320–430px width without horizontal scrolling, without hover, and without clipped controls. Desktop (viewport `lg`/1024px and up) remains the reference experience; mobile gets a *reduced but complete* layout, not a separate product.

Concretely, the shared conventions (normative, in [code-standards.md](../code-standards.md)):

- **One desktop threshold**: `lg` (1024px), consistent with `useIsDesktop()`. Below it is the mobile/tablet experience.
- **`dvh`, not `vh`**, for viewport-relative heights.
- **No hover-only affordances** — touch must reach every control (`.touch-reveal`, `pointer-coarse:`).
- **Overflow discipline**: `truncate`/`min-w-0` for text, `flex-wrap` for action rows, columns hidden (with matching `<col>`/`th`/`td`) rather than squashed.
- **Dialogs** bound with `max-h-*` and internal content scrolling, so headers/footers stay reachable.

The mobile shell (P1 of this effort) is a **drawer + top bar**: below `lg` the sidebar is hidden and re-opened as an overlay drawer from a persistent 48px top bar, with an in-top-bar "create" menu. No new dependency — a hand-rolled `fixed` panel + backdrop, matching the project's lightweight UI approach.

This is a *directional constraint* like [PDR-001](PDR-001-single-user-first.md): it does not make mobile the primary target, it makes "usable on a phone" a permanent requirement that new features must not break.

## Alternatives considered

- **Desktop-only, document it** — cheapest now, but rejects legitimate use (podcasts, reading) and accumulates one-off patches as users report breakage.
- **Mobile-first rebuild / separate mobile app** — disproportionate for the current posture (basics-first, single-user); would also fork the codebase.
- **Adopt a drawer component library (e.g. Radix Drawer)** — pulls in a dependency for a 30-line panel + backdrop; rejected in favor of the existing hand-rolled overlay pattern.

## Consequences

- New UI work must pass the small-screen bar (no hover-only, no horizontal scroll, no clipped footers); review should check it.
- Slight CSS overhead on desktop for the responsive variants.
- The `lg` threshold is now load-bearing: `useIsDesktop()` and CSS breakpoints must not diverge.
- If the product ever pivots to mobile-primary, this PDR is superseded; the conventions above remain valid as the floor.
