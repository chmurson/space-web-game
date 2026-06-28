# Isometric Flight Hint

## What Changed

- Added a normal-gameplay `flight-plane-cue` world-space line marker around the spacecraft.
- The cue is a low-opacity circle with short axis ticks on the simulation plane, so the isometric camera projects it as an angled plane reference.
- The cue follows the spacecraft and scales from the current viewport size to stay readable on desktop and mobile.
- Added a focused scene test that keeps the debug grid hidden while asserting the cue is prepared subtly before presentation sync.

## Why It Changed

The full grid is debug-only, which left normal gameplay with less context that flight controls operate on an isometric plane. The new cue gives that context near the ship without restoring a full playfield grid or adding HUD copy.

## Key Files

- `src/scene/createGameScene.ts` owns cue geometry, material, and scene references.
- `src/presentation/spacecraftPresentation.ts` owns per-frame cue position and viewport-relative scale.
- `tests/scene/createGameScene.test.ts` covers cue setup and debug-grid visibility.

## Decisions

- Kept the hint in WebGL world space instead of DOM UI so it matches the same isometric projection as bodies, trails, and trajectory lines.
- Used one small line cue rather than a grid, tutorial prompt, or HUD panel.
- Kept opacity below `0.3` and disabled depth writes so the cue remains subtle and does not block other gameplay visuals.
- Initialized the cue hidden until `spacecraftPresentation` applies a real spacecraft position and viewport-derived scale.

## Validation

- `npm test` passed: 48 Vitest files / 320 tests, plus 16 automation-claim tests.
- `npm run build` passed, including config validation, TypeScript, and Vite release build. Vite reported the existing large chunk warning.
- Browser/playtest release-preview screenshots passed visual inspection:
  - Desktop: `tmp/isometric-flight-hint/desktop-1280x720.png`
  - Mobile: `tmp/isometric-flight-hint/mobile-390x844.png`
- Canvas pixel checks were nonblank in both screenshots and included cyan samples near the spacecraft cue:
  - Desktop center sample: 7,231 non-dark pixels, 147 cyan-family pixels.
  - Mobile center sample: 9,522 non-dark pixels, 116 cyan-family pixels.
- `npm run test:gui` was not run because this change does not touch HUD, overlay, menu, touch-control, or responsive DOM UI; the canvas-visible browser screenshots are the relevant visual verification.

## Follow-Ups

- None known.
