# Passive-Coast Accepted Prediction Window

## What Changed

- Accepted far-worker coast results now carry the prediction anchor elapsed
  time, sample offsets and interval closest-approach metadata, total actual
  coverage, bound/unbound loop policy, and the actual termination reason
  (`horizon`, `loop-limit`, or `impact`). Existing result geometry, integration,
  and impact fields are reused instead of duplicated in the window payload.
- During compatible passive coast, the runtime advances through that accepted
  result by simulation elapsed time. It drops elapsed samples, rebuilds shifted
  closest-approach/event/impact timing, uses the first retained portion as the
  near tier, and uses the complete retained future as the far tier.
- Ordinary quantized spacecraft and body-position drift no longer forces a
  synchronous near integration once a compatible worker baseline is accepted.
  Worker refreshes still use the existing request coalescing and #194
  trim-and-extend cache.
- Runtime diagnostics now report near source, fallback reason, prediction
  anchor, actual termination reason, remaining usable coverage, and retained
  near/far point counts. `getRemainingUsableCoverageSeconds()` exposes the same
  current-generation value for the later time-warp policy in issue #286.
- Hard semantic changes and unsafe windows retain the synchronous near path.
  This includes target/config/assist/control changes, manual generation changes,
  bound/unbound policy changes, exhausted or undersampled coverage, malformed
  continuity, and worker-reported divergence.

## Why It Changed

High-warp passive coast crossed quantized spacecraft or body buckets on many
frames. The runtime synchronously integrated the near horizon for each crossing
even though the accepted worker path already described the same future. That
main-thread work dominated recent trajectory profiles. Treating the accepted
coast result as one rolling time window removes the redundant near calculation
without introducing a second cache, scheduler, or worker.

## Key Files and Ownership

- `src/prediction/trajectoryPrediction.ts` identifies whether a coast
  computation ended at the selected horizon, angular loop limit, or impact.
- `src/prediction/farTrajectoryPrediction.ts` keeps ownership of the accepted
  coast-window shape and time-based slicing. The existing worker-local cache,
  validation, mandatory seam check, trim-and-extend composition, reuse limit,
  and divergence diagnostics remain unchanged.
- `src/runtime/trajectoryPredictionRuntime.ts` owns semantic acceptance,
  hard-invalidation generations, passive-coast eligibility, near/far tier
  application, synchronous fallback, and runtime coverage diagnostics.
- `tests/prediction/farTrajectoryPrediction.test.ts` verifies worker timing and
  actual horizon/loop/impact termination metadata.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` verifies rolling reuse,
  non-sample-aligned slicing, spacecraft/body drift, hard invalidation,
  exhaustion, divergence recovery, termination-bounded coverage, and stale
  result rejection.

## Important Decisions

- There is one accepted coast window. The runtime does not maintain an
  independent near cache and does not schedule a second prediction job.
- The worker re-anchors each full or trim-and-extend result to that request's
  simulation elapsed time. Runtime slicing is read-only and never mutates the
  worker cache or performs physics integration.
- The window adds only timing and interval metadata. Absolute/relative points,
  impact, and integration diagnostics remain in the existing worker result so
  the structured-clone payload does not send trajectory geometry twice.
- At least two future samples must remain before the window can supply near
  coverage. The first sample is retained even when the configured near horizon
  is shorter than one output interval, preserving a current-to-future segment.
- The live spacecraft position starts each sliced absolute path. Future points
  keep their original sampling phase, so a non-sample-aligned current time does
  not move or resample accepted physics points.
- Semantic keys now include the bound/unbound loop policy. Hard semantic
  round-trips also advance the existing generation, preventing an older
  in-flight result from becoming acceptable merely because controls, target, or
  configuration later return to their former serialized values.
- A worker `state-diverged` result provides a new accepted full baseline, but
  the completion frame still computes near synchronously. Later compatible
  frames may use the newly accepted baseline.
- Remaining usable coverage is zero whenever near falls back synchronously. For
  an accepted window it is `anchor + actual termination time - current elapsed`,
  not the selected horizon.

## Validation

- Focused TypeScript and Biome checks passed for the changed source and fixtures.
- Focused Vitest coverage passed: 6 files / 119 tests across prediction,
  trajectory runtime, presentation, DevTools bridge, and HUD text fixtures.
- Full product Vitest coverage passed: 65 files / 624 tests. All 16 automation
  claim-helper tests passed. The separate workflow-prompt suite remained 2/3 on
  its unchanged current-main missing-`rocket`-policy wording expectation.
- The release build passed, including configuration validation and TypeScript.
  Vite emitted only its existing large-chunk advisory.
- The full Playwright suite passed 83/84. The one unrelated current-main failure
  expects the in-game Controls list to omit the newly shipped `Toggle Info` and
  `Clear Info pins` shortcuts. The focused tutorial trajectory replay passed
  1/1, and its screenshot showed a continuous coherent Earth/Moon transfer
  trajectory.
- `git diff --check` passed.

## Follow-Ups and Known Gaps

- Issue #286 can consume remaining usable coverage to cap and later restore time
  warp; this change intentionally does not alter time-warp policy.
- Progressive integration refinement (#174) and screen-space point density
  changes (#175) remain independent.
- Active thrust, turn planning, and assist-controlled near prediction remain
  synchronous by design.
