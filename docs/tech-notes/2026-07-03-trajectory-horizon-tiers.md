# Trajectory Horizon Tiers

## What Changed

- Long trajectory predictions now refresh in two runtime-owned tiers.
- Manual and short-horizon refreshes still produce the full prediction in one pass.
- Automatic long-horizon refreshes update the near tier first, keep a previously rendered far tier visible while a far refresh is pending, and apply the far tier only when it still matches the current prediction inputs.
- While that far refresh is pending, the displayed path can briefly join fresh near points to the retained far tail even when they are not spatially continuous. This is an accepted temporary visual tradeoff for keeping the near path responsive and avoiding a disappearing long-horizon tail.
- If the fresh near tier already predicts impact, the runtime suppresses the retained far tier so stale far points do not draw past the impact.
- Added DevTools/debug diagnostics for the tier state: current near/far/visible point counts, pending far state, far visibility, short input-key hashes, elapsed refresh time, refresh interval, last successful near/far calculation duration, wall-clock age of the last near/far calculations, rolling 1s/10s/30s calculation counts and averages, and a capped recent event log.
- A high-time-warp debug snapshot showed long-horizon starvation: at `3600x`, every recent diagnostic event was `far-replaced`, with no `far-complete` events, because the quantized spacecraft/body input key changed every rendered frame.
- Far refreshes now use a synchronous one-active/one-pending request queue. Near-horizon refreshes can keep reacting to input-key changes while the active far request is preserved, and newer far requests replace only the waiting pending request.
- Far queue progress now has a separate trigger policy: complete active far work when there is no near refresh to run, or when the far refresh interval has elapsed despite continuous near-input churn.
- The Chrome DevTools extension now has a dedicated Sampling section for sampling config, refresh timing, last successful near/far calculation duration, age of the last near/far calculations, rolling 1s/10s/30s calculation counts and averages, geometry duration, tier state, point counts, event-log status, and short input keys.
- The Sampling section also reports actual coast integration step diagnostics per near/far tier: step count, average `dt`, and minimum `dt`.
- The Sampling section now reports near-travel coverage: distance the spacecraft moved during the last trajectory check, distance covered by the most recent completed near-calc gap, the predicted near-path span, and ratios against that span.

## Why

Long horizons are expensive enough that active control changes should not wait for a full far-horizon prediction before the visible near path responds. Keeping tiering in the trajectory runtime preserves the existing renderer contract: presentation still consumes a single combined prediction state.

The additional diagnostics make fast-time-warp refresh behavior inspectable from the DevTools panel and raw JSON snapshot. They help separate three cases: quantization suppressing input-key changes, pending far work being repeatedly replaced, and prediction state updating while presentation geometry does not.

## Key Files

- `src/runtime/trajectoryPredictionRuntime.ts` owns tier scheduling, input keys, stale far-tier rejection, and combined prediction state.
- `src/devtools/devtoolsBridge.ts` exposes the diagnostics through the existing snapshot path.
- `extension/space-web-game-devtools/` renders the Sampling panel fields in the Chrome DevTools extension and bumps the unpacked-extension manifest version.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` covers unchanged short horizons, near-first long-horizon refreshes, retained far visibility, replacement of pending stale far work, and the new event log fields.

## Decisions

- The near tier is capped at ten minutes for long horizons.
- Far prediction remains synchronous and frame-scheduled by the runtime; this does not introduce Web Workers.
- Presentation, HUD text, and trajectory geometry continue using the existing combined runtime state.
- The diagnostic event log is intentionally a simple in-memory ring buffer capped at 100 entries. No persistent telemetry or export flow was added.
- Calculation ages and rolling windows are for the current runtime session. Ages and windows use wall-clock time from `performance.now()`, not simulated mission time. They are not persisted and do not add reset controls.
- Integration diagnostics count coast prediction physics steps only. Assisted prediction step counts are not included in this slice.
- Short input-key hashes are debugging identifiers only. The runtime still uses the full input key for correctness.
- Long-horizon work uses one active far job plus at most one pending far request. Active far jobs finish instead of being restarted, new requests replace only the waiting pending request, and finished far results replace the displayed far tier while being labeled as exact/current only when their input key matches the live input key.
- The queue remains main-thread and synchronous. It models the scheduling boundary needed for a future worker without adding worker infrastructure in this slice.
- Quantization is static today: positions use 5 km buckets and velocities use 5 m/s buckets. At `3600x`, the captured spacecraft moved about 74 km per rendered frame, so static 5 km position buckets cause automatic refresh invalidation at frame rate.
- Near-travel coverage is session-local diagnostic state. It keeps the last trajectory-check movement and the completed near-calc gap even when a near calculation immediately resets the accumulated "since calc" distance, and compares those values to the last near tier's absolute path length.

## Validation

- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts`
- Diagnostic follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- Diagnostic follow-up: `npm test`
- Diagnostic follow-up: `npm run build`
- Queue follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts`
- Queue follow-up: `npx tsc --noEmit`
- Sampling panel follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- Sampling panel follow-up: `npx tsc --noEmit`
- Sampling average follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- Sampling average follow-up: `npx tsc --noEmit`
- Sampling age follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- Sampling age follow-up: `npx tsc --noEmit`
- Sampling rolling-window follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- Sampling rolling-window follow-up: `npx tsc --noEmit`
- Integration diagnostics follow-up: `npx vitest run --config vite.config.ts tests/prediction/trajectoryPrediction.test.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- Integration diagnostics follow-up: `npx tsc --noEmit`
- Near-travel diagnostic follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts`
- Near-travel diagnostic follow-up: `npx tsc --noEmit`

## Follow-Ups

- Revisit prediction input quantization or refresh cadence for high time warp. The captured `3600x` case crossed the current position bucket many times per frame, so quantization alone needs to be time-warp-aware or paired with coalescing.
- Web Worker execution, progressive precision rendering, and screen-space point-density policy remain out of scope for the current issue #173 implementation slice.
