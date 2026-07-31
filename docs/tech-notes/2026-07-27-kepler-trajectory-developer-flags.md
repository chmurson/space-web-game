# Kepler trajectory developer flags

## What changed

- Added a developer-only menu and URL-backed selection between the existing
  numerical coast predictor and a Kepler two-body predictor.
- Added an extended trajectory-horizon developer option and production-path
  trajectory benchmarks.
- Hardened the Kepler path after review: iteration exhaustion returns a
  best-effort estimate, remaining production-wrapper failures fall back to the
  configured numerical predictor, loop trimming honors the shared revolution
  limit, and near/far dispatch requires the target to be the only massive body.
- Limited the Kepler URL override to loopback hosts or the existing exact
  `devtools=1` authorization.

## Why

The flags make trajectory experiments accessible without changing the default
player experience. The review hardening prevents an experimental solver failure
from escaping into the animation loop and prevents two-body math from silently
ignoring another body's gravity.

## Ownership boundaries

- `src/app/developerFeatureFlags.ts` and `src/app/createAppConfigContext.ts` own
  developer access gating and URL parsing.
- `src/prediction/keplerTwoBody.ts` owns two-body eligibility, propagation,
  sampling, loop trimming, and numerical fallback.
- `src/runtime/trajectoryPredictionRuntime.ts` owns synchronous near-tier
  selection; `src/prediction/farTrajectoryPrediction.ts` applies the same rule
  in the worker-compatible far-tier path.
- `benchmarks/trajectoryPrediction.bench.ts` measures the same public wrappers
  used by production.

## Important decisions

- A scenario is eligible for Kepler prediction only when the selected target has
  positive mass and every other body has zero mass. Massless scenario helpers do
  not force a fallback, while Earth-Moon and other multi-gravity scenarios do.
- Universal-anomaly iteration exhaustion keeps the best-effort result now
  shipped on `main`. Other propagation or sampling exceptions fall back to
  `computeCoastTrajectoryPrediction` with the caller's physics engine. This
  preserves configured near-tier behavior and the worker's existing
  semi-implicit Euler behavior. Invalid non-positive sampling steps remain
  fail-fast `RangeError`s rather than being retried through the fallback.
- Loop trimming uses target-relative angular travel and the existing
  `maxLoopRevolutions` configuration, matching the numerical predictor's
  termination semantics.
- The developer menu has no visual changes in this follow-up, so no design-system
  or GUI screenshot update is required.

## Validation

- `npx tsc --noEmit`
- Focused Vitest coverage: 4 files and 73 tests.
- `npm run build`
- `npm test`: 724 product tests, 16 automation-claim tests, and 4 automation
  workflow tests.
- Focused production-wrapper benchmark:
  `npx vitest bench --config vite.config.ts benchmarks/trajectoryPrediction.bench.ts --run -t 'Earth-only Kepler production coast: 2-hour horizon'`

## Follow-ups and known gaps

- Kepler remains an experimental developer mode and intentionally falls back to
  numerical prediction for multi-body scenarios.
- The fallback is deliberately transparent to the player; richer diagnostics
  can be added later if solver convergence needs operational visibility.

## 2026-07-28 conflict resolution

- Merged current `main` after PR #326 landed the overlapping Kepler
  implementation, preserving its positive-step validation, best-effort
  iteration behavior, focused gameplay coverage, and public sampling API.
- Retained this PR's developer menu and access gate, shared single-mass
  eligibility rule, numerical fallback containment, loop-event behavior, and
  production-wrapper benchmark naming.
- Preserved current-main non-positive sampling-step validation across the
  branch's numerical fallback wrapper.
- Post-merge validation passed 80 focused tests, 766 product tests, 16 claim
  tests, 4 workflow tests, the release build, and focused desktop/mobile Kepler
  Playwright coverage.
- The focused 2-hour production-wrapper benchmark completed at about 8.5k
  operations per second.
- The full Playwright run passed 91 of 95 tests. Two unchanged snapshot-detail
  fixtures are rejected by current `main` snapshot validation, the unchanged
  leaderboard assertion still expects `7h30m` while the UI renders `07h30m`,
  and one highscore navigation timeout passed immediately in isolation.
- Desktop/mobile Kepler screenshots and developer-menu screenshots were
  inspected at original resolution. The trajectory remained coherent and the
  menu controls stayed inside both viewports.
