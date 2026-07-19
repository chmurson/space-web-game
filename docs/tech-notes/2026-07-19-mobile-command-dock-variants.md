# Mobile Command Dock and Flight Panel Variants

Issue: [#264](https://github.com/chmurson/space-web-game/issues/264)

Shipit state: `.codex/shipit-workflows/agent/issue-264-mobile-command-dock.md`

## What changed

- Added a coarse-pointer-only mobile command dock with a Flight item and a collapsible panel.
- Added tap-to-toggle and Escape-to-close behavior with matching `aria-expanded`, panel visibility, and focus restoration.
- Added four component-local visual-treatment axes for repeatable comparison:
  - `mobileDockDensity=compact|spacious`
  - `mobileFlightPanel=glass|sheet`
  - `mobileDockEmphasis=subtle|strong`
  - `mobileDockSafeArea=standard|roomy`
- Added the review-only `mobileDockItems=flight|full` axis. `full` shows Flight,
  Nav, Mission, Ship, and Settings together while the default remains
  Flight-only.
- Added bottom-safe-area positioning and reserved HUD space so notices and the in-game menu move above the open panel.
- Added collapsed-dock clearance for the existing in-game controls popover and
  full-width comparison bar, plus sheet-only clearance for existing edge-reveal
  tabs.
- Added focused interaction, variant, safe-area screenshot, and desktop-visibility GUI coverage.

## Why

The mobile controls redesign needs a stable command-dock shell before RCS yaw
or Main Thrust can move into it. Keeping all requested visual treatments
available at once lets GUI review compare concrete combinations without making
the final design selection in this issue.

## Ownership boundaries

- `src/ui/touchControls/mobileCommandDock.tsx` owns Flight panel state,
  accessibility, Escape handling, and URL variant selection.
- `src/ui/touchControls/mobileCommandDock.css` owns all dock variants,
  safe-area layout, non-modal hit testing, bottom-HUD collision offsets, and
  the sheet-only edge-tab clearance.
- `src/ui/touchControls/createTouchControls.ts` only mounts the dock and excludes
  dock-owned touches from camera/heading gesture startup.
- `tests/gui/mobileCommandDock.spec.ts` owns the focused browser behavior and
  repeatable comparison screenshots.
- `docs/gui-screenshot-tests.md` documents the feature-flag matrix for manual or
  automated GUI review.

## Decisions

- The dock is visible only for coarse/no-hover input, so fine-pointer desktop
  HUD and controls keep their existing layout.
- Both safe-area modes include the platform inset. `roomy` adds evaluation
  space outside it; it never replaces or ignores the actual safe area.
- The panel uses no backdrop and the dock root has `pointer-events: none` while
  its owned controls opt back in. Existing full-playfield touch handling remains
  active outside those controls.
- The panel contains a concise pointer to the existing RCS and Burn edge tabs.
  No flight-control behavior or ownership moved in this issue.
- The URL selectors are intentionally local to this component; no generic flag
  registry, panel router, or future-panel abstraction was added.
- Nav, Mission, Ship, and Settings are disabled geometry-review buttons in the
  opt-in full state. They do not mount panels, route actions, or change feature
  ownership.
- The Flight item reuses the existing `addTapSafeButtonHandler` so touch
  activation and compatibility-click suppression do not duplicate gesture code.

## Validation

- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build. The existing large-chunk advisory remained.
- `npm test` passed: 62 Vitest files / 552 tests, 16 automation-claim tests,
  and 3 automation-workflow tests.
- `npm run test:gui` passed all 71 Playwright checks on the final code,
  including eight focused command-dock checks and all existing mobile HUD,
  touch-control, zoom-suppression, and turn-planning regressions.
- Browser touch smoke coverage confirmed that a dock-owned touch starts no
  camera pan or heading plan, while an equivalent touch outside the dock still
  pans the game camera.
- Visually inspected the generated comparison artifacts:
  - `tmp/playwright-results/mobileCommandDock-captures-03a71-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-compact-collapsed-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-03a71-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-glass-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-03a71-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-sheet-open-roomy-safe-area-430.png`
  - `tmp/playwright-results/mobileCommandDock-captures-17f71-five-item-comparison-states-mobile-chromium/mobile-command-dock-full-compact-collapsed-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-17f71-five-item-comparison-states-mobile-chromium/mobile-command-dock-full-spacious-selected-430.png`
- Also inspected the existing
  `mobile-in-game-controls-menu.png`, `mobile-thrust-control.png`, and
  `mobile-active-thrust-speed-pill.png` artifacts. The dock, notices, popover,
  and edge controls remained readable and non-overlapping after the final
  spacing fixes.

## Follow-ups and known gaps

- Issue #238 owns mounting RCS yaw and Main Thrust into the selected Flight
  panel treatment.
- Product/GUI review still needs to choose the final combination. The current
  defaults are only a repeatable starting point.
- The five-item comparison state does not authorize shipping empty future tabs;
  it remains available only through `mobileDockItems=full` and GUI fixtures.
