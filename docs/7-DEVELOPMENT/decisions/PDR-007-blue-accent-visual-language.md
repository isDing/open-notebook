# PDR-007: Palette v4 — cool slate canvas with one blue accent

- **Status**: Accepted
- **Date**: 2026-09
- **Supersedes**: [PDR-006](PDR-006-palette-retune-neutral.md) (the neutral ramp; all structural rules — token architecture, geometry, depth, motion, density — remain in force)
- **Related**: [PDR-005](PDR-005-warm-neutral-visual-language.md) (structural rules remain; its "no hue in chrome" rule is amended), `frontend/src/app/globals.css` (canonical tokens), `ui_blue.png` (reference screenshot)

## Context

The approved reference (`ui_blue.png`) is not the warm-neutral ramp of PDR-005/PDR-006: the canvas is a cool slate off-white, cards carry a faint blue tint, the logo and active navigation are a solid blue accent, primary buttons are a dark slate (not a hue), and content tiles wear teal/violet/amber. The interface must read "blue SaaS", not "beige editorial", while keeping the v3 token contract and component rules.

## Decision

Re-tokenize the raw values in `globals.css` (light and dark) plus minimal color-class swaps on the affected chrome:

- **Light**: `--bg #FAFBFD` · `--surface #F7FAFD` · `--text #0F172A` · `--text-secondary #5D6A84` · `--text-muted #7D889F` · `--border #E2E8F0` · `--hover #EEF2F8` · `--selected #E8EEF7` · `--primary #343D4C` (dark slate buttons).
- **One blue accent**: `--primary-ink #1349C0` (active nav, links, AI voice) on `--primary-tint #ECF2FC` wash; new `--accent-solid #4F8CEE` carries the logo tile; `--ring #2563EB`. The shadcn `accent` hover slots re-map to the blue wash/ink.
- **Content hues restored**: `teal`/`fern`/`sage` → `#0E7E7B`, `plum`/`mauve`/`violet` → `#4A4FD2`, `gold`/`clay` → `#B45309`; type tokens (`--type-*`) and their `-soft` washes use these four hues (blue reserved for AI), so source tiles and dots render colored as in the reference.
- **Dark**: navy slate ramp on `#0F1219` / `#161B26` with `#E6EAF2` text, blue accent steps `#7EA6F5`/`#60A5FA`, lifted content hues (`#34C0B4`, `#8B90F0`, `#FBBF24`).
- **Component color swaps** (no layout change): `LogoMark` uses `bg-accent-solid` with white marks; `NotebookCard`'s icon tile uses `bg-primary-tint`/`text-primary-ink`; `SourceTile`'s icon tile uses the per-type soft wash + hue.
- **Semantic colors** (red destructive, amber warn) unchanged. Viewport/manifest theme-colors follow the new `--bg`.

## Alternatives considered

- **Make `--primary` the blue and accept blue buttons** — the reference shows a dark slate "创建笔记本" button; a blue primary button would deviate from the approved look.
- **Keep the PDR-006 neutral ramp** — the reference is explicitly a blue-accent design; the gap is the whole point of the change.
- **Per-item rainbow tiles for notebooks** — the reference tiles vary per card, but that needs deterministic color assignment (a feature), not a palette; the notebook tile uses the blue accent instead.

## Consequences

- PDR-005's "no saturated hue in chrome" rule is amended: one blue accent is sanctioned for brand/active/link states; content hues are sanctioned for type dots and tiles; red/amber semantics untouched.
- Every `--primary-ink` consumer (links, badges, active nav, markdown links) now renders blue with zero component edits; `accent-solid` is the only new token.
- Status chips that used `teal`/`fern` (new/queued/running/completed) read teal again — matching the reference's colored state vocabulary.
- Superseding this requires a new PDR; the token architecture, geometry, depth, and motion rules remain the bar for UI work.
