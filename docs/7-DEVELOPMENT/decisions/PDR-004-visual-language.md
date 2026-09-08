# PDR-004: Visual language v2 — neutral surfaces, one accent, typography-led hierarchy

- **Status**: Accepted
- **Date**: 2026-09
- **Related**: [PDR-003](PDR-003-mobile-layout.md), [frontend/AGENTS.md](../../../frontend/AGENTS.md), `frontend/src/app/globals.css` (canonical tokens), `frontend/src/app/dev/design/page.tsx` (living styleguide)

## Context

The original "Quiet Green" foundation leaned on a multi-hue palette (fern/sage/gold/teal/plum/mauve/slate/violet/clay) for navigation icons, status chips, section labels, and a three-color logo mark, plus 4–6px squared corners and a `zoom: 0.8` "compact canvas". Individually defensible, together the interface reads as a decorated admin dashboard rather than a mature SaaS/AI product: too many competing colors, ~11px effective body text on desktop (14px under 0.8 zoom), and dense, low-contrast surfaces.

The goal: the UI should feel designed, not decorated — calm, professional, and legible at a glance, with color reserved for meaning.

## Decision

The visual system is rebuilt around **neutral surfaces + one accent**, stated as rules new UI must follow:

- **One accent (indigo)** for actions, active states, focus, and the AI voice. It is the only decorative color allowed.
- **Semantics only**: red = destructive/failed, amber = pending/warned. Content-type indicators (video/pdf/web/…) are monochrome — icons, not color, carry the distinction. Citation and context states use the accent for the primary class and neutral steps for the rest.
- **Hierarchy by typography, not color**: one typeface (Instrument Sans) at 400/600/700 with a clear size scale (22px page title → 15px section → 14px body → 12px metadata); mono (Spline Sans Mono) for data only.
- **Structure over cards**: whitespace, section headers, and hairline dividers separate content; cards are lightweight (10px radius, weak border, no default shadow) and used sparingly.
- **Geometry & depth**: radii 6/8/10/12px (not everything rounded); hairlines separate, only popovers/dialogs own real shadows.
- **Density**: `zoom: 0.8` is removed — the app renders at standard scale (14px body on desktop), which also fixes sub-44px effective touch targets and iOS focus-zoom risk.
- **Motion**: fast (120–250ms), opacity/small-travel only; nothing animates for its own sake.

The token contract in `globals.css` is the single source of truth: legacy hue variables (fern, teal, gold, …) are remapped onto the new system so existing components migrate without edits. The `/dev/design` styleguide documents the new laws.

## Alternatives considered

- **Keep Quiet Green and tune it** — the hue proliferation *is* the problem; retuning nine hues still leaves a multi-color UI.
- **Adopt a component-library theme (shadcn preset, MUI, Chakra)** — the app is hand-rolled on Radix primitives with an i18n/zoom/SSR history; swapping the theme engine is a larger risk than re-specing the ~40 custom properties it already routes through.
- **Black primary + accent (Linear/Vercel style)** — workable, but the product brief calls for one accent that carries actions; a colored primary is simpler to keep consistent across buttons, active nav, and the AI voice.
- **Keep `zoom: 0.8`** — it is a density hack that costs legibility and touch-target size to save nothing structural; standard scale with 14px body is the comfortable density.

## Consequences

- Any new component that wants a color must justify it against the rules above (accent/semantic/neutral); review should reject decorative color.
- Contrast in dark mode now rests on the split between `--primary` (fills, white text) and `--primary-ink` (accent text, lighter step); both must stay WCAG-compliant when adjusted.
- Removing the zoom changes perceived sizes (~+25%); layouts sized in `dvh` needed a one-time `125dvh → 100dvh` fix (done in `globals.css`).
- The legacy hue utilities (`text-teal`, `bg-fern-tint`, …) now render accent/neutral — grep for them when auditing a screen, and prefer the semantic names (`primary`, `danger`, `warn`, `muted`) in new code.
- Superseding this requires a new PDR; the token-architecture and rules above remain the bar for UI work either way.
