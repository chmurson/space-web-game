# Fine-pointer HUD layout at narrow widths

Date: 2026-07-24

Issue: [#297](https://github.com/chmurson/space-web-game/issues/297)

Shipit state:
`.codex/shipit-workflows/automation/issue-297-fine-pointer-hud-layout.md`

## What changed

- The existing Normal desktop HUD scale of 1.25 now follows fine-pointer
  capability instead of requiring a viewport wider than 720 CSS pixels.
- The desktop Target button and popover now use the same fine-pointer
  capability rule, so target selection remains reachable in the compact
  narrow-width arrangement.
- The existing width-based compact rules still reduce spacing and hide the
  target name below the breakpoint. Touch controls remain tied to
  touch/coarse capability.
- Focused browser coverage exercises 800×450 and 640×360 fine-pointer
  viewports, including a zoom-equivalent effective-width crossing, target
  selection, popover bounds, computed scale, and touch-control absence.

## Why

Browser page zoom changes the CSS viewport width without changing the player's
mouse or trackpad. Coupling desktop scale and Target availability to the 720px
responsive breakpoint made the HUD abruptly smaller and removed the only
fine-pointer target-selection entry point as the effective width crossed that
line.

## Ownership and decisions

- `src/style.css` owns the shared desktop HUD scale and width-based compact
  density. The scale media query now describes capability; the 720px media
  block remains layout-only.
- `src/ui/createDesktopTargetSelector.ts` owns Target button/popover
  availability and uses one `MediaQueryList` for fine-pointer capability and
  capability-change cleanup.
- `src/ui/overlayUI/overlayUIStyles.css` keeps the controls-popover height
  compensation aligned with the 1.25 fine-pointer HUD scale at every width.
- The existing target-control component and popover anchoring are reused. No
  setting, persisted value, renderer DPR behavior, world scaling, or
  simulation/rendering behavior was introduced.

## Validation

- Focused Target-selector Playwright coverage passed 3 of 3, including
  800×450 and 640×360 fine-pointer states plus the touch/coarse regression.
- Product Vitest passed 649 of 649, automation claim tests passed 16 of 16, and
  automation workflow tests passed 4 of 4.
- Release config validation, TypeScript, and Vite build passed.
- The full GUI suite passed 82 of 83. The unchanged precise-yaw case still
  observes `-0.25` while expecting `-1/49`; it reproduced in isolation and
  this branch has no diff in that test or its input/runtime ownership.
- Changed-file Biome and `git diff --check` passed. Biome reports three
  pre-existing `!important` warnings elsewhere in `src/style.css`.
- The generated 800×450, 640×360, and standard desktop Target-selector PNGs
  were inspected at original size. The scale, compact narrow target text,
  visible selector button, and popover placement matched the expected states.
- Live browser playtesting at 800×450 and 640×360 confirmed scale `1.25`,
  width-driven compact text, hidden touch controls, an in-bounds popover, and
  functional Moon pinning. No browser console warnings or errors were present.

## Follow-ups and known gaps

- Issue #299 owns the downstream UI-size preference and final
  `--ui-size-scale` token.
- Renderer DPR synchronization, world scaling, and real-world dimension or
  browser-zoom countermeasures remain intentionally out of scope.
