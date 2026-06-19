# Smooth Trajectory Tip Rendering

## What Changed

- Added a presentation-only trajectory tip smoothing helper.
- The coast trajectory renderer now trims the unrevealed tail of the final calculated segment immediately after each prediction refresh.
- The visible endpoint advances back toward the calculated endpoint during the refresh window.
- The prediction line, fade colors, endpoint marker, and impact gradient now use the same smoothed endpoint.
- Follow-up: the trim now scales by the active time warp, so `x300` / `5m` trims the visual endpoint by the simulation time represented by the remaining refresh window.
- Follow-up: the rendered coast trajectory now starts at the current target-relative ship position, so the start of the line follows the ship every frame instead of beginning at the first fixed prediction sample.
- Follow-up: fixed prediction samples after the ship now blend from the previous prediction to the new prediction over the refresh window, which smooths the visible line start in the tight main-menu orbit.

## Why It Changed

Trajectory prediction still samples at fixed time intervals, but drawing the full newest endpoint on every refresh made short zoomed previews visibly step forward. A tiny render-time trim keeps the endpoint moving smoothly without changing the calculated trajectory.

## Key Files

- `src/presentation/trajectoryLineSmoothing.ts`: pure render-time smoothing helper.
- `src/presentation/trajectoryPresentation.ts`: tracks prediction visual age and applies smoothed coast points.
- `tests/presentation/trajectoryLineSmoothing.test.ts`: covers render-only trimming behavior for `1s` and `0.5s` sample intervals.

## Decisions

- Prediction calculation, sampling cadence, physics, and runtime prediction state remain unchanged.
- Smoothing never extrapolates; it only interpolates between already calculated points.
- The helper leaves very short or invalid inputs unchanged rather than hiding the trajectory.
- Large high-warp trims clamp to keep at least two calculated points visible.
- Empty prediction data still renders no line; anchoring does not invent a trajectory when prediction output is unavailable.
- The live ship anchor is never blended; only the fixed prediction samples after it transition between refreshes.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/trajectoryLineSmoothing.test.ts` passed: 11 tests, including start anchoring, previous-to-current sample blending, and `x300` / `5m` coverage.
- `npm test` passed: 38 files, 251 tests.
- `npm run build` passed. Vite emitted the existing large chunk warning.
- `npx biome check` on touched files passed.
- `git diff --check` passed.
- Browser playtest passed on desktop, `390x844` mobile emulation, an `x5m` keyboard-driven desktop smoke check, and a main-menu background smoke check after multiple refreshes.
- `npm run deploy:netlify` deployed to staging: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy after main-menu start blending: https://6a3546f667d5ad04692eee7c--fanciful-bunny-d77b4b.netlify.app

## Follow-Up

- None currently.
