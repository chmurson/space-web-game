# Offscreen Camera Drag Panning

## What Changed

- Desktop pointer input now cancels an invalid target-heading plan without returning early from camera-pan handling.
- Mobile touch input now starts a camera-pan session when a one-finger touch cannot start target-heading planning because the spacecraft is offscreen.
- Added focused Playwright regression coverage for desktop pointer panning, mobile touch panning, and visible-spacecraft target-heading planning.

## Why

Issue #208 reported that the offscreen spacecraft guard from persistent turn-planning input blocked the same initial gesture used for camera panning. The intended behavior is narrower: offscreen spacecraft should prevent target-heading planning, but it should not prevent camera drag panning.

## Key Files

- `src/input/pointerCameraInput.ts` owns desktop pointer camera pan and target-heading planning coordination.
- `src/ui/touchControls/createTouchControls.ts` owns mobile one-finger camera pan and target-heading planning coordination.
- `tests/gui/cameraDragInputRegression.spec.ts` covers the regression through real browser pointer/touch events.

## Decisions

- Kept the fix in the existing input handlers instead of adding a shared gesture abstraction.
- Preserved visible-spacecraft hold-to-plan behavior and did not change camera unlock thresholds, pinch zoom, or touch-control reveal gestures.

## Validation

- `npx playwright test --config playwright.config.ts tests/gui/cameraDragInputRegression.spec.ts`
- `npm run build`
- `npx biome check src/input/pointerCameraInput.ts src/ui/touchControls/createTouchControls.ts tests/gui/cameraDragInputRegression.spec.ts`
- `git diff --check`
- `npm test`
- `npm run test:gui`

## Follow-Ups

- None.
