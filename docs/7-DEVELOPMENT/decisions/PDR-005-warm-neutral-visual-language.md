# PDR-005: Visual language v3 — warm neutral palette, dark neutral primary, no saturated color

- **Status**: Accepted
- **Date**: 2026-09
- **Supersedes**: [PDR-004](PDR-004-visual-language.md) (the one-accent rule; its structural rules — token architecture, typography-led hierarchy, density, motion — remain in force)
- **Related**: [PDR-003](PDR-003-mobile-layout.md), [frontend/AGENTS.md](../../../frontend/AGENTS.md), `frontend/src/app/globals.css` (canonical tokens), `frontend/src/app/dev/design/page.tsx` (living styleguide)

## Context

PDR-004 removed the multi-hue palette but kept one saturated accent (indigo) for actions, active navigation, focus, and the AI voice. In use the interface still reads as a colored admin dashboard: the indigo logo tile, buttons, active nav, status chips, and AI markers are the first things the eye lands on. The product brief calls for a modern minimalist SaaS look — warm neutral palette, high whitespace, soft borders, subtle shadows, restrained color and font weight — with the primary action expressed as a dark neutral rather than a hue.

## Decision

Re-tokenize the existing CSS-variable contract in `globals.css`. No new styling mechanism, no component rewrites, no business-logic or IA changes:

- **Palette (light)**: `--bg #FAFAF9` · `--surface #FFFFFF` · `--text #1C1B19` · `--text-secondary #6F6D68` · `--text-muted #9A9892` · `--border #E8E6E1` · `--hover #F5F4F1` · `--selected #EEECE7` · `--primary #29261F`. The spec names are now the raw tokens; the legacy `ink-*`/`line-*`/`surface-*` raws alias onto them, so every existing utility class re-resolves unchanged.
- **Primary is a dark neutral** in light mode (inverted to a light neutral `#ECEAE5` in dark mode). It carries buttons, active nav, focus rings, progress, checkboxes, and the AI voice. No saturated hue is used for interface chrome.
- **Dark mode** mirrors the same warm ramp on `#191817` (canvas) / `#201F1D` (surface) with warm gray text steps and `#34332E` borders.
- **Semantic colors only**: red = destructive, amber = warn — the only remaining hues.
- **Legacy hue aliases** (`teal`/`fern`, previously the indigo accent) re-map onto the primary family so existing status chips render neutral; the other legacy hues map onto warm gray steps.
- **Geometry**: radius scale 8/12/14/16px — 12px for controls (buttons, inputs), 16px for cards and dialogs.
- **Depth**: shadow scale re-centered on `0 4px 20px rgba(0,0,0,0.04)`; borders stay 1px soft neutral; the sidebar separates sections with whitespace instead of divider lines.
- **Weight**: display headings step down from 700 to 600; active nav and create buttons drop from semibold to medium; body stays 400.

Targeted component edits follow the tokens: `Card` moves to 16px radius, the sidebar loses its section separators and heavier weights, the logo tile uses the 12px control radius, viewport/web-manifest theme colors move to `#FAFAF9`/`#191817`, and the `/dev/design` styleguide documents the v3 spec.

## Alternatives considered

- **Keep the indigo accent and desaturate it** — any hue keeps the "colored admin panel" read; the brief explicitly asks for neutral chrome and a dark neutral primary.
- **Introduce a muted green/terracotta for the AI voice** — adds a hue back into a system that should have none; the AI voice already has icons, labels, and context to carry it.
- **Rewrite components for the new palette** — unnecessary: the token contract already routes every color, so re-tokenizing `globals.css` is sufficient and keeps the diff auditable.

## Consequences

- The "one accent" rule in PDR-004 is replaced: review now rejects *any* saturated hue in the UI outside red/amber semantics.
- `--primary` inverts in dark mode (dark fill → light fill); components must keep using `--on-primary`/`--primary-foreground` for text on primary fills (they already do).
- Status chips that used `teal`/`fern` (new/queued/running/completed, AI markers) now read neutral; state is carried by icon + label, with red/amber reserved for failed/warned.
- `logo.svg` and the PWA icon PNGs are brand assets, not part of the UI token system, and are out of scope.
- Superseding this requires a new PDR; the token architecture, semantic-color rule, density, and motion rules remain the bar for UI work either way.
