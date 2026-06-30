# Stabilize Orbit Point Markers

Issue: https://github.com/chmurson/space-web-game/issues/142
Branch: `codex/142-stabilize-orbit-markers`

## What Changed

- Replaced the Pe/Ap marker display stability check with an altitude-relative point-change threshold.
- Added one tuning constant in trajectory presentation: marker candidates must move more than `0.05` of the accepted/current marker altitude scale before replacing the displayed marker.
- Cleared accepted marker state when trajectory visuals hide, prediction target/session context changes, or a marker kind disappears.
- Removed trajectory presentation's old time-warp-based marker threshold input.

## Why

The sampled trajectory predictor can choose slightly different closest/farthest sample points frame to frame. Small candidate movement should not immediately shift the displayed Pe/Ap marker, but meaningful orbit changes still need to move the marker promptly.

## Key Files

- `src/presentation/trajectoryPresentation.ts` owns marker acceptance, reset behavior, and rendering.
- `src/app/createAppComponents.ts` no longer passes time-warp data into trajectory presentation.
- `tests/presentation/trajectoryPresentation.test.ts` covers rejecting insignificant moves, accepting meaningful moves, and stale-state resets.

## Decisions

- Kept stabilization in presentation instead of changing prediction physics.
- Used point movement divided by marker altitude scale, not screen pixels or time warp, so the threshold tracks the orbit size and is easy to tune manually.
- Used `0.05` as the initial conservative threshold for manual playtesting.
- Reset marker state on scenario session and target context changes so stale markers do not survive runtime resets.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts` passed.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npm run test` passed: 57 Vitest files with 379 tests, plus 16 automation-claim node tests.
- `npm run test:gui` passed: 25 Playwright tests.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png`; trajectory horizon control remained readable without HUD overlap.
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; trajectory/debug overlays stayed readable.
- Manual browser playtest at `?scenario=earth-moon`: with threshold `0.05`, after enabling debug mode, increasing coast horizon to 2m, and zooming in, the live Pe label stayed `Pe 7 Mm -> alt 371 km`; sampled label position moved only about 0.1 px over one second, so it felt stable without appearing stuck in that state.

## Follow-Ups

- Tune `0.05` if manual playtesting shows the markers still jitter or feel stuck.
