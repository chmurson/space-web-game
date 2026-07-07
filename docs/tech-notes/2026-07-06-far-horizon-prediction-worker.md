# Far-Horizon Prediction Worker

## What Changed

Far-horizon trajectory prediction now runs through a dedicated module Web Worker. The main thread still computes the near-horizon tier synchronously, keeps simulation/input/rendering ownership, and renders the most recent accepted far tier when the worker completes.

The worker receives a stripped, plain-serializable payload: job id, prediction keys, target id, prediction config, assist mode, autopilot rotation rate, and a prediction-only simulation snapshot. It does not receive DOM nodes, Three.js objects, renderer state, functions, physics-engine objects, or body color/rendering fields.

Follow-up after high-warp testing: far-result semantic acceptance now uses a static body signature of body id, mass, and radius instead of live body position/velocity. Near prediction refreshes still use the full live body key, but ordinary Earth/Moon drift while a worker job is in flight no longer causes the worker result to be rejected indefinitely. Explicit manual refreshes advance an internal far semantic generation so results from before a reset/forced refresh boundary are still ignored.

## Why

Long far-horizon prediction can consume enough integration time to compete with `requestAnimationFrame`, input handling, HUD updates, and WebGL rendering. Moving only the far tier off-thread preserves immediate near-horizon feedback while letting expensive long-horizon integration complete asynchronously.

## Key Files

- `src/prediction/farTrajectoryPrediction.ts` owns the serializable payload shape and pure far prediction execution used by the worker.
- `src/runtime/trajectoryPredictionWorker.ts` is the module worker entry point.
- `src/runtime/trajectoryPredictionWorkerClient.ts` wraps the browser Worker lifecycle and result/error messages.
- `src/runtime/trajectoryPredictionRuntime.ts` owns active/pending job versioning, semantic result acceptance, stale result rejection, worker recreation, and merging accepted far tiers with the current near tier.
- `src/presentation/trajectoryPresentation.ts` and `src/runtime/frameLoop.ts` pass the extra serializable assist setting needed by worker-side assisted prediction.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` covers payload shape, job ids, stale rejection, spacecraft-drift acceptance, and worker recreation.

## Decisions

- Only the far tier moved to the worker. Near prediction remains synchronous on the main thread.
- A single active worker job and a single replaceable pending job are enough for this issue.
- Worker results are accepted by a semantic key derived from the existing prediction input key without the spacecraft snapshot or live body drift. Target, static body layout, horizon/sampling config, assist mode, controls, and manual refresh generation still invalidate stale far results.
- Worker failures terminate the current worker and recreate one for the next pending or future far request. There is no main-thread far fallback.
- Presentation data shape stays unchanged so trajectory rendering continues to consume the same merged near/far prediction state.

## Validation

- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/prediction/trajectoryPrediction.test.ts tests/presentation/trajectoryPresentation.test.ts` passed.
- Follow-up focused validation: `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/prediction/trajectoryPrediction.test.ts tests/presentation/trajectoryPresentation.test.ts` passed with body-drift worker acceptance and manual-refresh boundary coverage.
- `npm run build` passed and emitted a separate `trajectoryPredictionWorker` asset.
- `npm run test` passed.
- `npm run test:gui` passed. Inspected `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png` and `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; HUD controls and trajectory/debug rendering looked coherent.
- `git diff --check` passed.
- Local `coderabbit --base main --agent` reached analysis but produced no findings/output after several minutes and was stopped as stalled.

## Follow-Ups

- None currently. Progressive/coarse far passes, screen-space point density, budget-aware scheduling, and workerizing current-frame simulation remain intentionally out of scope.
