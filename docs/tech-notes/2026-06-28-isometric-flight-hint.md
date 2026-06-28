# Isometric Flight Hint

## What Changed

- Changed the isometric hint to use the existing heading target turn slice instead of a standalone ring around the spacecraft.
- The turn slice is now generated from points on the simulation plane and projected through the current camera, so the wedge reads as an angled plane cue while the ship turns.
- Removed the extra `flight-plane-cue` Three.js scene object, geometry, and per-frame sync.
- Added a focused presentation test that keeps the debug grid hidden and verifies the turn slice is no longer a flat screen-space circle.

## Why It Changed

The full grid is debug-only, which left normal gameplay with less context that flight controls operate on an isometric plane. PR owner feedback preferred applying the cue to the existing turning animation, which also matches issue #67's suggested disc-slice/turn-arc approach.

## Key Files

- `src/presentation/spacecraftPresentation.ts` owns the projected heading target turn-slice path.
- `src/scene/createGameScene.ts` keeps the debug grid hidden and no longer owns a separate flight cue object.
- `tests/presentation/spacecraftPresentation.test.ts` covers the projected turn-slice behavior and debug-grid visibility.

## Decisions

- Kept the hint on the existing turn feedback instead of adding another persistent playfield element.
- Kept the debug grid debug-only and avoided HUD or tutorial copy.
- Used the current camera projection for the SVG path rather than approximating the plane with CSS transforms.
- Left the existing cyan turn-slice styling in place so this stays visually aligned with the current heading feedback.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/spacecraftPresentation.test.ts` passed: 1 file / 1 test.
- `npm test` passed: 48 Vitest files / 320 tests, plus 16 automation-claim tests.
- `npx biome check src/presentation/spacecraftPresentation.ts src/scene/createGameScene.ts tests/presentation/spacecraftPresentation.test.ts` passed.
- `git diff --check` passed.
- `npm run build` passed, including config validation, TypeScript, and Vite release build. Vite reported the existing large chunk warning.
- `npm run test:gui` passed: 25 Playwright tests. Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; it matched the expected mobile debug replay state with visible canvas, grid, trail detail, debug panel, and touch controls.
- Targeted browser screenshots passed visual inspection with the heading turn slice visible as the isometric flight-plane cue:
  - Desktop: `tmp/isometric-flight-hint-turn-slice/desktop-1280x720-turn-slice.png`
  - Mobile: `tmp/isometric-flight-hint-turn-slice/mobile-390x844-turn-slice.png`
- PNG brightness checks were nonzero in both full screenshots and spacecraft/turn-slice crops:
  - Desktop full mean `0.0042918`; turn-slice crop mean `0.016386`.
  - Mobile full mean `0.00843784`; turn-slice crop mean `0.0180075`.
- `coderabbit --base main --agent` completed with 0 findings.

## Follow-Ups

- None known.
