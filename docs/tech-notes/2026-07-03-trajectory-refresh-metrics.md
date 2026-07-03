# Trajectory Refresh Metrics

## What Changed

- Added a quantized trajectory prediction input key to the prediction runtime.
- Skipped full prediction recomputation when the key is unchanged and the configured refresh interval has not elapsed.
- Recorded prediction refresh reason, prediction CPU time, recent refresh count, geometry update time, horizon, sample step, integration step cap, point counts, and event marker count.
- Exposed the metrics through the in-game debug panel JSON/text and the DevTools simulation snapshot/panel sampling row.

## Why It Changed

Long-horizon trajectory prediction can spike the main thread. This first slice measures the existing hot path and avoids redundant refreshes before larger worker or progressive-rendering changes are justified.

## Key Files

- `src/runtime/trajectoryPredictionRuntime.ts` owns invalidation keys, refresh reasons, and prediction metrics.
- `src/presentation/trajectoryPresentation.ts` records trajectory geometry update timing.
- `src/ui/hudText.ts`, `src/presentation/hudPresentation.ts`, and `src/devtools/devtoolsBridge.ts` expose diagnostics.
- `extension/space-web-game-devtools/panel.js` shows the metrics in the existing sampling row.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` covers the invalidation cases.

## Decisions

- Continuous state is quantized before key comparison: positions at `5km`, velocities at `5m/s`, scalar config/control values at `0.001`, and heading at `0.0001` radians so normal frame-to-frame orbital drift falls back to the configured refresh cadence instead of forcing a refresh every animation frame.
- Horizon/config changes refresh conservatively instead of trimming or reusing prior points.
- The configured refresh interval remains the safety net for missed or intentionally conservative key comparisons.
- `sampleStepSeconds` describes emitted trajectory point spacing. `integrationStepSeconds` is labelled as an integration max because adaptive gravity timing can still use smaller internal physics steps.
- Worker scheduling, near/far horizon splits, progressive rendering, zoom-aware density, and loop trimming remain follow-up work.

## Validation

- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/ui/hudText.test.ts tests/devtools/devtoolsBridge.test.ts`
- `npm run test`
- `npm run build`
- `npm run test:gui`
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; the mobile debug panel showed the new prediction metrics line without overlap.

## Follow-Ups

- Use the collected metrics to tune thresholds and prioritize #173, #177, #176, #174, and #175.
