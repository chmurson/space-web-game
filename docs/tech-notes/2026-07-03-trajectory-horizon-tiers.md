# Trajectory Horizon Tiers

## What Changed

- Long trajectory predictions now refresh in two runtime-owned tiers.
- Manual and short-horizon refreshes still produce the full prediction in one pass.
- Automatic long-horizon refreshes update the near tier first, keep a previously rendered far tier visible while a far refresh is pending, and apply the far tier only when it still matches the current prediction inputs.
- While that far refresh is pending, presentation keeps the retained far tail visible as stale context. It bridges only plausible small seams to the fresh near tip and leaves a visible gap when the retained tail is no longer spatially continuous.
- If the fresh near tier already predicts impact, the runtime suppresses the retained far tier so stale far points do not draw past the impact.
- Added DevTools/debug diagnostics for the tier state: current near/far/visible point counts, pending far state, far visibility, short input-key hashes, elapsed refresh time, refresh interval, last successful near/far calculation duration, wall-clock age of the last near/far calculations, rolling 1s/10s/30s calculation counts and averages, and a capped recent event log.
- A high-time-warp debug snapshot showed long-horizon starvation: at `3600x`, every recent diagnostic event was `far-replaced`, with no `far-complete` events, because the quantized spacecraft/body input key changed every rendered frame.
- Far refreshes now use a synchronous one-active/one-pending request queue. Near-horizon refreshes can keep reacting to input-key changes while the active far request is preserved, and newer far requests replace only the waiting pending request.
- Far queue progress now has a separate trigger policy: complete active far work when there is no near refresh to run, or when the far refresh interval has elapsed despite continuous near-input churn.
- The Chrome DevTools extension now has a dedicated Sampling section for sampling config, refresh timing, last successful near/far calculation duration, age of the last near/far calculations, rolling 1s/10s/30s calculation counts and averages, geometry duration, tier state, point counts, event-log status, and short input keys.
- The Sampling section also reports actual coast integration step diagnostics per near/far tier: step count, average `dt`, and minimum `dt`.
- The Sampling section now reports near-travel coverage: distance the spacecraft moved during the last trajectory check, distance covered by the most recent completed near-calc gap, the predicted near-path span, and ratios against that span.
- The near tier now grows beyond the ten-minute floor when the last trajectory-check movement would consume more than 1% of the previous near-path span, capped by the selected full prediction horizon.
- Debug mode now colors the rendered prediction line by tier: near points use cyan and far points use amber, making retained-stale far tails visible in the playfield.
- Retained-stale far tails now render as a separate prediction line segment instead of a continuous polyline connected to the fresh near tier.
- Split retained-stale far tails now share the combined trajectory fade curve, so the fresh near segment does not fade as if it were the final trajectory tip. The stale far line is also rendered behind the fresh near line so current near prediction owns overlaps.
- Retained-stale far presentation now trims stale points that are behind the fresh near tip, then bridges only plausible small seams from the stale-far line. Large gaps stay disconnected.
- The retained-stale far seam bridge now accepts close curved seams after trimming, instead of requiring the gap to point along the last fresh-near segment. This reduces bridge flicker when the path bends near the split.

## Why

Long horizons are expensive enough that active control changes should not wait for a full far-horizon prediction before the visible near path responds. Keeping tiering in the trajectory runtime preserves the existing renderer contract: presentation still consumes a single combined prediction state.

The additional diagnostics make fast-time-warp refresh behavior inspectable from the DevTools panel and raw JSON snapshot. They help separate three cases: quantization suppressing input-key changes, pending far work being repeatedly replaced, and prediction state updating while presentation geometry does not.

## Key Files

- `src/runtime/trajectoryPredictionRuntime.ts` owns tier scheduling, input keys, stale far-tier rejection, and combined prediction state.
- `src/devtools/devtoolsBridge.ts` exposes the diagnostics through the existing snapshot path.
- `extension/space-web-game-devtools/` renders the Sampling panel fields in the Chrome DevTools extension and bumps the unpacked-extension manifest version.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` covers unchanged short horizons, near-first long-horizon refreshes, retained far visibility, replacement of pending stale far work, and the new event log fields.

## Decisions

- The near tier uses ten minutes as its long-horizon floor. It scales upward only when recent movement per trajectory check exceeds the 1% near-span budget, so short horizons and ordinary low-warp long-horizon behavior keep the previous sampling shape.
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
- Dynamic near-horizon scaling uses the previous near-path span as the distance estimate. It avoids adding a separate orbital-distance predictor, and the next near calculation corrects the span with real integration output.
- Debug tier coloring is presentation-only. It uses the runtime diagnostic near-point count to color the existing combined line and does not change prediction scheduling or normal non-debug trajectory styling.
- The retained-stale far split is presentation-only. The runtime still exposes one combined prediction point list, while `trajectoryPresentation` uses the diagnostic near-point count and far visibility to draw fresh near and stale far as separate `Line2` objects.
- Split retained-stale far rendering keeps fade based on the full combined point list, then slices those colors between the near and stale-far line objects. This preserves the original single-line fade behavior in normal mode while still avoiding the false connector segment.
- Retained-stale far currently keeps full opacity and uses a lower render order than the fresh near line. The stale tail remains visible as context, but current near prediction owns the overlap. Age-based opacity remains a future presentation refinement.
- Retained-stale far seam bridging is presentation-only. It uses the last fresh near segment as a local tangent, drops stale-far points that project behind the near tip, and bridges the remaining seam only when the gap is within the local segment scale.
- The bridge check intentionally does not require the seam vector to align with the last fresh-near segment. That direction gate rejected valid curved seams and made the bridge flicker around the split.

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
- Dynamic near-horizon follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts`
- Dynamic near-horizon follow-up: `npx tsc --noEmit`
- Dynamic near-horizon follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- Dynamic near-horizon follow-up: `npm test`
- Dynamic near-horizon follow-up: `npm run build`
- Debug tier-color follow-up: `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts tests/runtime/trajectoryPredictionRuntime.test.ts`
- Debug tier-color follow-up: `npx tsc --noEmit`
- Retained-stale far split follow-up: `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts`
- Retained-stale far split follow-up: `npx tsc --noEmit`
- Retained-stale far split follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts tests/presentation/predictionLineFade.test.ts tests/scene/starfield.test.ts`
- Retained-stale far fade/overlap follow-up: `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts`
- Retained-stale far fade/overlap follow-up: `npx tsc --noEmit`
- Retained-stale far fade/overlap follow-up: `npx biome check --write src/scene/createGameScene.ts src/render/sceneUpdates.ts src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryPresentation.test.ts docs/tech-notes/2026-07-03-trajectory-horizon-tiers.md`
- Retained-stale far fade/overlap follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts tests/presentation/predictionLineFade.test.ts tests/scene/starfield.test.ts`
- Retained-stale far fade/overlap follow-up: `npm test`
- Retained-stale far fade/overlap follow-up: `npm run build`
- Retained-stale far fade/overlap browser smoke: captured x30m/2h debug screenshots at `tmp/playwright-results/stale-far-fade-smoke/desktop-x30m.png` and `tmp/playwright-results/stale-far-fade-smoke/mobile-x30m.png`; diagnostics text showed current near-only state (`pts 186/185/0`), so retained-stale split behavior remains covered by the focused presentation test.
- Retained-stale far seam follow-up: `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts`
- Retained-stale far seam follow-up: `npx tsc --noEmit`
- Retained-stale far seam follow-up: `npx biome check --write src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryPresentation.test.ts docs/tech-notes/2026-07-03-trajectory-horizon-tiers.md`
- Retained-stale far seam follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts tests/presentation/predictionLineFade.test.ts tests/scene/starfield.test.ts`
- Retained-stale far seam follow-up: `npm test`
- Retained-stale far seam follow-up: `npm run build`
- Retained-stale far seam flicker follow-up: `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts`
- Retained-stale far seam flicker follow-up: `npx tsc --noEmit`
- Retained-stale far seam flicker follow-up: `npx biome check --write src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryPresentation.test.ts docs/tech-notes/2026-07-03-trajectory-horizon-tiers.md`
- Retained-stale far seam flicker follow-up: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts tests/presentation/predictionLineFade.test.ts tests/scene/starfield.test.ts`
- Retained-stale far seam flicker follow-up: `npm test`
- Retained-stale far seam flicker follow-up: `npm run build`

## Follow-Ups

- Revisit prediction input quantization or refresh cadence for high time warp. The captured `3600x` case crossed the current position bucket many times per frame, so quantization alone needs to be time-warp-aware or paired with coalescing.
- Web Worker execution, progressive precision rendering, and screen-space point-density policy remain out of scope for the current issue #173 implementation slice.
