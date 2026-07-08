# Active Thrust Far Trajectory Coalescing

## What Changed

- Changed far trajectory scheduling so hard semantic refreshes still enqueue far work immediately.
- Added an active-thrust far cooldown based only on current time warp.
- Stopped coasting spacecraft/body drift from queuing far work directly; timed refresh keeps using the existing horizon/time-warp cooldown.
- Kept turn-only controls out of the active-thrust path.

## Why It Changed

Far prediction should update more often while the spacecraft is actively thrusting, but routine coasting drift should continue to use the existing far coalescing behavior. This keeps expensive far-worker work focused on player-visible thrust changes without making every drift invalidation a far request.

## Key Files

- `src/runtime/trajectoryPredictionRuntime.ts` owns far request scheduling, result-stage coalescing, active/pending worker requests, and diagnostics.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` covers hard refreshes, active-thrust cooldown, coasting drift behavior, and pending result coalescing.

## Decisions

- Hard force reasons remain `initial`, `manual`, `target-change`, `horizon-change`, `sampling-change`, and `assist-change`.
- Active thrust means nonzero `main`, `reverse`, or `strafe`; `turn` is ignored.
- Active-thrust far coalescing uses one simulated second divided by current time warp, with the existing 0.25-second floor.
- DevTools far coalescing override remains global and can override both routine and active-thrust cooldowns.
- Near trajectory refresh behavior was intentionally left unchanged for this pass.

## Validation

- `npx biome check --write src/runtime/trajectoryPredictionRuntime.ts tests/runtime/trajectoryPredictionRuntime.test.ts docs/tech-notes/2026-07-08-active-thrust-far-trajectory-coalescing.md`
- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts`
- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- `npm run build`
- Deployed to shared staging: `https://fanciful-bunny-d77b4b.netlify.app`.
- Unique deploy: `https://6a4ec54e9484752b78b2c92b--fanciful-bunny-d77b4b.netlify.app`.

## Follow-Ups

- Review close/near trajectory refresh policy separately if it needs different active-thrust handling.
