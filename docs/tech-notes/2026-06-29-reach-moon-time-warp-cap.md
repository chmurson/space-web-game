# Reach the Moon Time Warp Cap

Issue: https://github.com/chmurson/space-web-game/issues/133

## What Changed

- Removed the Reach the Moon scenario-specific `maxTimeWarp` directive.
- Added focused Reach the Moon scenario coverage that keeps the mission viewport directive intact while proving time warp now uses the global cap.
- Rebased over PR #135's trajectory-horizon change so Reach the Moon now uses global caps for both trajectory horizon and time warp.

## Why

`config/base.yml` already defines the global time warp ladder up to `18000`. Reach the Moon overrode that ladder with a local cap of `2000`, so the mission could not use the same upper time warp options as the rest of the game.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScenario.ts` owns Reach the Moon mission scene directives.
- `tests/scenario/specific-scenarios/reachMoonScenario.test.ts` covers the mission directives and global time warp clamping expectation.

## Decisions

- Kept the fix as a deletion in the scenario directive factory instead of adding a new runtime option.
- Preserved current `main` behavior where Reach the Moon no longer sets `maxCoastPredictionHorizonHours`.
- Left Reach the Moon's `maxViewportSize` override unchanged.
- Tested through public directive resolution and clamp behavior instead of exporting scenario internals.

## Validation

- Focused scenario and trajectory-horizon tests passed.
- Full test suite passed.
- Production build passed. Vite emitted the existing large-chunk warning.
- `git diff --check` passed.

## Follow-Ups

- None.
