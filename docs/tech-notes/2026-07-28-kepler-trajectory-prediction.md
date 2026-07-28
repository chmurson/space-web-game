# Selectable Kepler trajectory prediction

PR: [#326](https://github.com/chmurson/space-web-game/pull/326)

Shipit state:
`.codex/shipit-workflows/agent/kepler-trajectory-implementation-flag.md`

## What changed

- Added an experimental `trajectoryPrediction=kepler` URL mode for passive-coast
  near and far trajectory prediction while keeping Euler as the default.
- Added universal-variable two-body propagation and sampled prediction result
  construction for a single positive-mass target body.
- Hardened the experimental path so universal-anomaly iteration exhaustion
  returns a best-effort estimate instead of throwing through the frame loop.
- Kepler sampling rejects non-positive sample steps and applies the same
  configured angular loop limit as Euler when loop trimming is allowed.
- The trajectory benchmark compares Euler and Kepler through their complete
  production computation wrappers.

## Why

Long-horizon passive-coast prediction is expensive with numerical integration.
The feature flag makes an analytic two-body alternative measurable without
changing the shipped default. The follow-up hardening keeps malformed sampling
configuration and difficult solver inputs from hanging or aborting gameplay,
and preserves the runtime's existing bound-orbit coverage contract.

## Ownership and implementation decisions

- `src/prediction/keplerTwoBody.ts` owns analytic propagation, sampling,
  result construction, input validation, and loop-limit termination.
- `src/runtime/trajectoryPredictionRuntime.ts` owns near-path dispatch.
- `src/prediction/farTrajectoryPrediction.ts` owns worker-backed far dispatch
  and deliberately disables far-result reuse for Kepler mode.
- `src/app/createAppConfigContext.ts` owns exact URL parsing; unknown values
  remain Euler.
- Kepler remains limited to passive coast around the sole positive-mass target.
  Active controls, assisted flight, multi-body scenarios, and the default mode
  continue using Euler.
- Angular travel is accumulated from sampled target-relative positions with the
  same normalized-angle rule as the Euler coast predictor. Impact termination
  takes precedence over a loop limit reached on the same sample.
- Iteration exhaustion is best-effort by design. This prevents an experimental
  prediction failure from unwinding the animation loop; callers may add
  stricter output rejection separately if real scenarios expose unusable data.
- `DESIGN.md` remains unchanged because this work does not alter the visual
  language, HUD, controls, or responsive layout.

## Validation

- Focused Kepler and trajectory-runtime tests passed: 2 files / 45 tests
  covering propagation, invalid sample steps, loop-limit behavior, feature-flag
  dispatch, and worker payloads.
- The on-demand trajectory benchmark completed all 14 cases while exercising
  the complete Kepler result path. In this run, the four Kepler cases measured
  about 8,995, 2,158, 2,134, and 1,689 operations/second for 2-hour, 24-hour,
  2-day, and 16-day horizons respectively.
- The complete product and automation suites passed: 691 product tests, 16
  task-claim tests, and 4 engineer-workflow tests.
- Release config validation, TypeScript, and the Vite production build passed.
  Vite emitted only its existing large-chunk advisory.
- Biome passed for every changed source, test, benchmark, and tech-note file.
  The repository-wide audit still reports 23 errors and 4 warnings in untouched
  files, including existing extension formatting and import-order findings.
- `git diff --check` passed.
- Focused Kepler gameplay Playwright coverage passed 2/2 at a 1024×720 desktop
  viewport and a 390×844 mobile viewport. Both tests loaded the exact
  `trajectoryPrediction=kepler` mode, observed more than 20 visible trajectory
  points, and confirmed simulation elapsed time continued advancing.
- The desktop and mobile PNGs under
  `tmp/playwright-results/keplerTrajectoryPlaytest-*` were inspected at original
  resolution. The cyan coast path remained coherent around Earth; desktop HUD
  and controls were unobstructed; and mobile top telemetry plus the command dock
  remained readable without overlap.

## Follow-ups and known gaps

- The experimental solver does not yet model multi-body gravity, active thrust,
  or assisted flight.
- Best-effort non-converged output is not currently tagged with a diagnostic;
  add one only if profiling or real scenario inputs show a need.
