# Cosmic-distance formatting

Date: 2026-07-25

Issue: [#304](https://github.com/chmurson/space-web-game/issues/304)

Shipit state:
`.codex/shipit-workflows/automation/issue-304-cosmic-distance-formatting.md`

## What changed

- The shared game distance formatter now limits both kilometer and megameter
  values to two significant digits.
- Significant-digit boundaries use explicit `Math.round` behavior before
  locale-aware number rendering.
- Reach-the-Moon orbit-altitude text delegates to the shared distance
  formatter instead of maintaining a kilometer-only implementation.
- Reach-the-Moon notices keep their compact shared-unit form when apoapsis and
  periapsis use the same unit, while mixed-unit values retain both units.

## Why

Dynamic cosmic distances were not using one precision policy. Most game UI
used the shared formatter, but Reach-the-Moon scoring and result text rounded
to whole kilometers independently and never switched to megameters. Large
values could also show more precision than was useful to the player.

## Ownership boundaries

- `src/ui/formatters.ts` owns dynamic player-facing cosmic-distance unit
  selection, significant-digit rounding, locale separators, and trailing-zero
  behavior.
- `src/scenario/specific-scenarios/reachMoonScore.ts` owns Reach-the-Moon
  missing/invalid altitude copy and nonnegative input normalization, then
  delegates valid distances.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` only composes
  apoapsis/periapsis notice text and removes a repeated unit when both
  formatted values share it.

## Implementation decisions

- The existing `1,000,000 m` threshold remains unchanged: values at or above
  it use `Mm`; smaller values use `km`.
- Rounding happens after conversion to the selected display unit so two
  significant digits apply consistently to both units.
- The rounding helper remains private to the formatter module. No test-only or
  generalized measurement API was added.
- Native locale formatting remains responsible for separators and suppressing
  unnecessary trailing zeroes.
- Speed formatting, static authored examples, and the standalone devtools
  formatter remain unchanged.

## Validation

- Focused Vitest — 3 files and 72 tests passed, covering formatter values,
  rounding boundaries, the unit threshold, Reach-the-Moon score text, and
  Reach-the-Moon scenario notices.
- Full `npm test` — 69 Vitest files with 676 tests, 16 automation-claim tests,
  and 4 automation-workflow tests passed.
- `npm run build` — configuration validation, TypeScript compilation, and the
  release Vite build passed.
- Changed-file Biome and `git diff --check` passed.
- GUI screenshots were not run because this change does not alter CSS, layout,
  interaction, or responsive behavior; focused presentation tests assert the
  affected player-facing strings directly.

## Follow-ups and known gaps

- No follow-up implementation is currently required for issue #304.
