# PDR-006: Palette retune — neutral ramp matched to the reference screenshot

- **Status**: Superseded by PDR-007
- **Date**: 2026-09
- **Related**: [PDR-005](PDR-005-warm-neutral-visual-language.md) (amends its palette values; all structural rules remain in force), `frontend/src/app/globals.css` (canonical tokens), `ui.png` (reference screenshot)

## Context

PDR-005 established the v3 token contract (dark neutral primary, no saturated chrome, warm gray steps). Against the approved reference screenshot (`ui.png`), the shipped values read slightly too warm and too light: the canvas was near-white `#FAFAF9`, cards were pure white, and the gray steps carried a yellow-brown bias. The screenshot's target is a cooler, more neutral ramp with an off-white card surface and a slightly browner dark primary button.

## Decision

Re-tokenize the raw values in `globals.css` (light and dark) to match the reference. Same tokens, same aliases, same component rules — no layout, geometry, or mechanism changes:

- **Light**: `--bg #F7F7F5` · `--surface #FAF9F8` · `--text #1A1A1A` · `--text-secondary #5C5C5E` · `--text-muted #8F8F91` · `--border #E6E5E1` · `--hover #F1F0ED` · `--selected #EBE8E3` · `--primary #342F2A` (hover `#48423A`).
- **Gray steps** (legacy hue aliases, type hues, cite steps, charts) shift from the `#9A9892`/`#6F6D68` warm ramp to the neutral `#8F8F91`/`#5C5C5E` ramp.
- **Dark**: `--bg #1A1A19` · `--surface #212120` · `--text #EDEDEB` · `--primary #EDEDEB` · `--border #353430`, with the same neutral gray steps (`#A4A39F`/`#C8C7C3`).
- **Semantic colors** (red destructive, amber warn) and geometry/motion rules are unchanged.
- Viewport theme-colors in `layout.tsx` and `manifest.webmanifest` follow the new `--bg` value; `ThemeProvider` already syncs the meta tag from `--bg` at runtime.

## Alternatives considered

- **Keep the v3 warm values** — the reference screenshot is the approved look; the warm bias was the gap.
- **Introduce a new accent hue** — rejected; PDR-005's no-hue rule is exactly what the reference shows.
- **Rewrite the token architecture** — unnecessary; the alias layer re-resolves everything, so a value retune is the whole change.

## Consequences

- Every existing utility class and component re-renders in the new ramp with zero code changes; the `/dev/design` styleguide picks up the values via tokens.
- PDR-005's palette line is superseded by this record; its structural rules (dark neutral primary, semantic colors only, geometry, depth, weight) remain the bar.
- Any future palette change follows the same path: retune raws in `:root`/`.dark`, leave the alias layer and components untouched.
