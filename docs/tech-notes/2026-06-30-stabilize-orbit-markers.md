# Stabilize Orbit Point Markers

Issue: https://github.com/chmurson/space-web-game/issues/142
Branch: `codex/142-stabilize-orbit-markers`

## What Changed

- Replaced the Pe/Ap marker display stability check with an altitude-only change threshold.
- Added one tuning constant in trajectory presentation: marker candidate altitude must change by more than `0.0025` of the accepted/current marker altitude scale before replacing the displayed marker.
- Cleared accepted marker state when trajectory visuals hide, prediction target/session context changes, or a marker kind disappears.
- Removed trajectory presentation's old time-warp-based marker threshold input.
- Added trajectory prediction sampling details to the DevTools Simulation section so output sample step, max integration step, refresh interval, and target sample count are visible while debugging marker precision.
- Tightened coast prediction integration from `8s` to `2s` only when the ship starts a bound coast prediction within `3x` the active target radius.

## Why

The sampled trajectory predictor can choose slightly different closest/farthest sample points frame to frame. Small sampled point movement should not immediately shift the displayed Pe/Ap marker when the orbit altitude is effectively unchanged, but meaningful altitude changes still need to move the marker promptly.

## Key Files

- `src/presentation/trajectoryPresentation.ts` owns marker acceptance, reset behavior, and rendering.
- `src/prediction/trajectoryPrediction.ts` owns the close-bound precision cap used by coast prediction and DevTools reporting.
- `src/app/createAppComponents.ts` no longer passes time-warp data into trajectory presentation.
- `src/devtools/devtoolsBridge.ts` and `extension/space-web-game-devtools/panel.*` expose prediction sampling values in DevTools.
- `tests/presentation/trajectoryPresentation.test.ts` covers rejecting insignificant moves, accepting meaningful moves, and stale-state resets.
- `tests/prediction/trajectoryPrediction.test.ts` covers the close-bound precision cap and starting Earth orbit Pe/Ap accuracy.
- `tests/devtools/devtoolsBridge.test.ts` covers the snapshot sampling fields.

## Decisions

- Kept stabilization in presentation instead of changing prediction physics.
- Used marker altitude delta divided by marker altitude scale, not screen pixels, point movement, or time warp, so the threshold tracks the orbit size and is easy to tune manually.
- Used `0.0025` as the current threshold for manual playtesting.
- Used current target-relative distance divided by target radius for the precision trigger, with `3x` target radius as the close-orbit cutoff.
- Reset marker state on scenario session and target context changes so stale markers do not survive runtime resets.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts` passed.
- `npx vitest run --config vite.config.ts tests/prediction/trajectoryPrediction.test.ts` passed.
- `npx vitest run --config vite.config.ts tests/devtools/devtoolsBridge.test.ts` passed.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npm run test` passed: 57 Vitest files with 379 tests, plus 16 automation-claim node tests.
- `npm run test:gui` passed: 25 Playwright tests.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png`; trajectory horizon control remained readable without HUD overlap.
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; trajectory/debug overlays stayed readable.
- Manual browser playtest at `?scenario=earth-moon`: after enabling debug mode, increasing coast horizon to 2m, and zooming in, the live Pe label stayed `Pe 7 Mm -> alt 371 km`; sampled label position moved only about 0.1 px over one second, so it felt stable without appearing stuck in that state.

## Follow-Ups

- Tune `0.0025` if manual playtesting shows the markers still jitter or feel stuck.
