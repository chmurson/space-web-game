# Passive-Coast Far Prediction Reuse

> Follow-up: `2026-07-17-bound-and-expired-far-prediction-reuse.md` broadens this initial conservative implementation to stable bound paths and elapsed metadata. The exclusions below describe the first shipped boundary, not the current final behavior.

## What Changed

- Far-horizon worker prediction now keeps its last completed coast computation and can roll it forward during compatible passive coast.
- A reusable request trims samples whose prediction time has elapsed, keeps the still-future samples, and integrates only the elapsed duration needed to extend the far tip back to the selected horizon.
- Reused results shift or recompute closest-approach, impact, and trajectory event metadata against the rolled-forward timeline.
- Runtime diagnostics and the DevTools Sampling panel report whether the accepted far result used `trim-extend` or a full calculation, how many points were retained, how much time was extended, and the conservative fallback reason.

## Why It Changed

Long passive-coast predictions repeatedly describe mostly the same future path. Reintegrating the complete horizon spends worker time on points that remain valid. Reusing that middle segment reduces integration work while keeping the existing near-tier responsiveness, worker result versioning, and far-refresh scheduling.

## Key Files and Ownership

- `src/prediction/trajectoryPrediction.ts` exposes the coast computation details needed for continuation: sampled times, sampled absolute/relative points, terminal simulation state, and prediction time. The existing `predictCoastTrajectory` result contract remains unchanged.
- `src/prediction/farTrajectoryPrediction.ts` owns the worker-local cache, compatibility checks, continuity validation, trim/extend composition, metadata handling, reuse limit, and fallback diagnostics.
- `src/runtime/trajectoryPredictionWorker.ts` owns the lifetime of the stateful predictor inside the existing module worker.
- `src/runtime/trajectoryPredictionRuntime.ts` accepts the worker result through the existing semantic/job checks and exposes the accepted result's reuse diagnostics.
- `extension/space-web-game-devtools/` displays the reuse readout and advances the extension version to `0.1.23`.
- `tests/prediction/farTrajectoryPrediction.test.ts` covers reuse correctness and conservative fallback behavior; existing runtime/DevTools fixtures cover the extended diagnostics contract.

## Safety and Compatibility Decisions

- Reuse requires an identical far semantic key, so target, horizon/sampling configuration, static body layout, assist/control plan, and manual/reset generation must match.
- Only assist-off requests with all controls idle can reuse cached coast work.
- Bound predictions that may use loop trimming always take the full path; reuse cannot accidentally extend beyond the configured angular loop limit.
- Elapsed time must be positive and no more than 25% of the horizon, at least two cached future samples must remain, the cached prediction must have reached the full horizon without impact, and closest-approach/event metadata must still be in the future.
- Before retaining any point, the worker re-integrates the elapsed prefix and compares spacecraft/body position and velocity plus spacecraft heading/fuel to the live request. Divergent state falls back to full prediction.
- Reuse performs at most four consecutive rolls before forcing a full recompute, bounding numerical drift and refreshing all metadata from the live state.
- The elapsed-prefix continuity check plus the missing-tip extension integrate at most half of the selected horizon under the 25% threshold. The long-horizon deterministic regression reduces integration steps from 100 to 40 while preserving the full result's points and closest approach.
- Non-sample-aligned elapsed time keeps physically valid future points on their original time phase and extends to the exact requested horizon. This does not change the configured point-density policy.

## Scope Boundaries

- Issue #193 far request/result coalescing policy is unchanged.
- Issue #175 screen-space density and sampling policy are unchanged.
- Near prediction remains synchronous and unchanged.
- Worker job ordering, semantic acceptance, stale result handling, and error recovery from issue #176 / PR #187 remain unchanged.

## Validation

- `npx --no-install tsc --noEmit`
- `npx --no-install vitest run --config vite.config.ts tests/prediction/farTrajectoryPrediction.test.ts tests/prediction/trajectoryPrediction.test.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts` (99 tests)
- `npx --no-install biome check src/prediction/farTrajectoryPrediction.ts src/prediction/trajectoryPrediction.ts src/runtime/trajectoryPredictionRuntime.ts src/runtime/trajectoryPredictionWorker.ts tests/prediction/farTrajectoryPrediction.test.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts`
- `node --check extension/space-web-game-devtools/panel.js`
- `npm test` after rebasing onto current `origin/main` (63 Vitest files / 559 tests, 16 automation-claim tests, and 3 automation-workflow tests)
- `npm run build`; the release build emitted the separate trajectory worker asset, and `dist/space-web-game-devtools-version.json` reported `0.1.23`.
- `npm run test:gui` after rebasing onto current `origin/main` (61 Playwright tests)
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; the debug trajectory remained continuous and coherent around the Earth/Moon scene.
- `git diff --check`

## Follow-Ups and Known Gaps

- Bound/loop-trimmed predictions and expired metadata were broadened in `2026-07-17-bound-and-expired-far-prediction-reuse.md` using per-segment closest-approach metadata and retained angular-travel accounting.
- State continuity tolerances mirror the existing coarse prediction input tolerances. Requests outside those bounds fall back safely; device profiling can determine whether stricter tolerances are practical without suppressing useful reuse.
