# Trajectory Horizon Tiers

## What Changed

- Long trajectory predictions now refresh in two runtime-owned tiers.
- Manual and short-horizon refreshes still produce the full prediction in one pass.
- Automatic long-horizon refreshes update the near tier first, keep a previously rendered far tier visible while a far refresh is pending, and apply the far tier only when it still matches the current prediction inputs.
- If the fresh near tier already predicts impact, the runtime suppresses the retained far tier so stale far points do not draw past the impact.

## Why

Long horizons are expensive enough that active control changes should not wait for a full far-horizon prediction before the visible near path responds. Keeping tiering in the trajectory runtime preserves the existing renderer contract: presentation still consumes a single combined prediction state.

## Key Files

- `src/runtime/trajectoryPredictionRuntime.ts` owns tier scheduling, input keys, stale far-tier rejection, and combined prediction state.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` covers unchanged short horizons, near-first long-horizon refreshes, retained far visibility, and replacement of pending stale far work.

## Decisions

- The near tier is capped at ten minutes for long horizons.
- Far prediction remains synchronous and frame-scheduled by the runtime; this does not introduce Web Workers.
- Presentation, HUD text, and trajectory geometry continue using the existing combined runtime state.

## Validation

- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts`

## Follow-Ups

- None. Web Worker execution, progressive precision rendering, and screen-space point-density policy remain out of scope for issue #173.
