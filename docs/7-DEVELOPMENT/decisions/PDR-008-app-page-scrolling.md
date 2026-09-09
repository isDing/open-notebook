# PDR-008: App pages own their scrolling — the document must never be a second scroll container

- **Status**: Accepted
- **Date**: 2026-09
- **Related**: [PDR-003](PDR-003-mobile-layout.md) (dvh convention, overflow discipline), `frontend/src/app/globals.css` (`.app-shell` rules), `frontend/src/components/layout/AppShell.tsx`

## Context

App pages render inside a fixed-height shell (`h-dvh` + `overflow-hidden`) with exactly one internal scroller per pane. In practice the settings page (and, once content was long enough, other pages) showed **two** vertical scrollbars: the page's own scroller *and* a document-level one.

Root cause: `body.app-body { min-height: 100dvh }` plus `html { overflow-x: hidden }` (which makes the document's computed `overflow-y` `auto` per spec). Whenever `100dvh` exceeds the layout viewport — the normal state of mobile browsers with a dynamic URL bar — the document itself overflows and becomes a second, page-level scroll container. `overscroll-contain` on the inner scrollers only stops scroll *chaining* into that container; it cannot remove the container's own scrollbar.

## Decision

- **`html:has(.app-shell) { overflow: hidden }`** in `globals.css`: on every page that renders the app shell, the document is not a scroll container. The shell still fills the visible viewport exactly (`100dvh`), and the page's internal scroller remains the only one. Non-shell pages (e.g. `/login`, whose form legitimately grows past the viewport) keep document scrolling unchanged — the rule is scoped by `:has(.app-shell)` and no body class is involved.
- **`overscroll-contain` on every page-level scroller** (settings, notebooks, notes, podcasts, transformations, advanced, search, api-keys, source detail, notebook context columns) so reaching a scroller boundary never chains a gesture into an ancestor — the same pattern the sources list, sidebar, and dialogs already use.
- Page scrollers that were missing `min-h-0` in a flex column (podcasts, transformations, search) gained it; without it the flex item cannot shrink below its content and the shell clips the tail of the page.

## Alternatives considered

- **`overscroll-contain` alone** — stops chaining but leaves the document scrollbar visible; that is exactly what was reported as still broken.
- **Global `html, body { overflow: hidden }`** — also kills `/login`'s ability to scroll when its form is taller than the viewport (small phones, on-screen keyboard).
- **Dropping `body { min-height: 100dvh }`** — exists to give non-shell pages a full-height canvas; removing it regresses them for the sake of shell pages.

## Consequences

- App pages can no longer produce a page-level scrollbar in any viewport; only their declared scrollers move content.
- `:has()` is required (Chrome 105+, Safari 15.4+, Firefox 121+) — consistent with the project's modern-browser baseline and PDR-003's dvh floor.
- New pages must keep the invariant: render inside `AppShell` with a `flex-1 min-h-0 overflow-y-auto overscroll-contain` scroller; never rely on document scrolling inside the shell.
