# Kepler closed-orbit rendering

Source PR: [#326](https://github.com/chmurson/space-web-game/pull/326)

Shipit state:
`.codex/shipit-workflows/agent/pr-326-kepler-closed-orbit.md`

## What changed

- Passive Kepler prediction now distinguishes a safe bound orbit from an open
  escape path or a target-intersecting impact path.
- A safe bound orbit is sampled for exactly one orbital period, even when that
  period is longer than the selected prediction horizon.
- Closed predictions report the explicit `closed-orbit` termination reason.
- Presentation closes the decimated line back to its first visible vertex,
  uses uniform brightness around the loop, and omits the path-end marker.
- Closed passive Kepler predictions stay on the synchronous single-tier path
  instead of scheduling a redundant far-worker prediction.
- Timer-only refreshes are suppressed while a closed Kepler prediction and its
  quantized inputs remain unchanged. Spacecraft, target/body, controls, assist,
  sampling, or horizon changes still invalidate the result.

## Why

A bound two-body Kepler orbit is a repeating ellipse, not a finite path that
ends at the selected horizon. Rendering it with the normal trajectory fade and
an open final segment made a stable parking orbit look incomplete. The full
ellipse is also inexpensive to compute, so repeating the same calculation only
because the refresh timer elapsed provided no useful visual update.

## Ownership and implementation decisions

- `src/prediction/keplerTwoBody.ts` owns two-body orbital classification and
  sampling. It derives semimajor-axis, period, eccentricity, and periapsis from
  the target-relative state. A bound solution is considered renderably closed
  only when its periapsis stays outside the target radius.
- Closed sampling uses at least 128 and at most 1,200 uniformly timed samples
  around one period. The normal configured step still requests additional
  samples within that cap.
- `src/prediction/trajectoryPrediction.ts` owns the shared
  `closed-orbit` termination reason.
- `src/runtime/trajectoryPredictionRuntime.ts` owns refresh and tier policy.
  It gives closed geometry usable coverage at least as long as both the chosen
  horizon and the sampled period, avoids far-worker setup, and skips only
  timer-driven refreshes. Existing input-key invalidation remains the source of
  truth for meaningful state changes.
- `src/presentation/trajectoryPresentation.ts` owns the visual loop. It appends
  the first selected render point after viewport-dependent decimation rather
  than duplicating physics samples, so the existing render-density cache and
  prediction data contracts stay intact.
- Impacting bound solutions and unbound solutions keep the existing open,
  horizon-shaped trajectory treatment.
- `DESIGN.md` remains accurate: the cyan trajectory language is unchanged; the
  geometry now communicates the closed-orbit state correctly.

## Validation

- Focused Biome check passed for all eight changed source and test files.
- Focused Vitest passed 64 tests covering propagation, closed/impact/escape
  classification, runtime tier/refresh policy, and rendered loop geometry.
- `npm test` passed 692 product tests, 16 automation-claim tests, and 4
  engineer-workflow tests.
- `npm run build` passed config validation, TypeScript, and the release Vite
  build.
- `npm run benchmark:trajectory` passed. Closed Earth-orbit Kepler sampling
  averaged about 0.055–0.091 ms across the benchmark horizons.
- `npm run test:gui` passed 87 of 88 browser tests, including both trajectory
  render-density checks. The unrelated highscores test still expects the
  accessible cell name `Time 7h30m`, while the current UI exposes
  `Time 07h30m`; an isolated rerun reproduced that pre-existing mismatch.
- Manual Playwright checks passed at 1440×900 desktop and on an emulated mobile
  device. Both captures show a continuous, evenly lit Earth parking-orbit loop
  with no visible gap, and both browser sessions reported zero console warnings
  or errors:
  - `.codex/shipit-workflows/agent/pr-326-kepler-closed-orbit/screenshots/kepler-closed-orbit-desktop-detail.png`
  - `.codex/shipit-workflows/agent/pr-326-kepler-closed-orbit/screenshots/kepler-closed-orbit-mobile.png`
- A repository-wide `npx biome check` remains red on pre-existing formatting,
  import-order, and lint findings outside this change. The task-scoped Biome
  check is clean.

## Follow-ups and known gaps

- Kepler mode still intentionally models only the selected target body's
  gravity. Material spacecraft or body-state drift therefore continues to
  refresh the osculating closed orbit.
- The 1,200-sample ceiling bounds extremely long or high-eccentricity closed
  paths. Presentation decimation continues to determine the final GPU vertex
  count for the current zoom.
- The existing GUI highscores accessible-name expectation should be updated
  separately from trajectory work.

## 2026-07-29 long-period convergence follow-up

### What changed and why

A human playtest found that Free roam could freeze after a burn extended the
spacecraft into a long, highly eccentric bound orbit while one-minute time warp
was active. The freeze was an uncaught
`Kepler two-body propagation did not converge` error from the animation frame.

The universal-anomaly solver now:

- uses the energy-scaled initial guess for every bound orbit instead of
  switching to the near-parabolic guess at a fixed semimajor-axis threshold;
- keeps each bound-orbit Newton step inside the physically valid
  zero-to-one-period anomaly interval, falling back to bisection when a Newton
  step leaves that interval or becomes non-finite; and
- uses an absolute anomaly tolerance of `1e-8`, which remains sub-centimeter
  accurate for the regression orbit without demanding precision below stable
  floating-point resolution after the spacecraft moves away from periapsis.

This is limited to convergence of the existing two-body solver. Closed-orbit
classification, sample caps, refresh policy, presentation, and non-bound
trajectory behavior are unchanged.

### Ownership and regression coverage

- `src/prediction/keplerTwoBody.ts` continues to own universal-variable
  propagation. The safeguard is internal and does not widen module APIs.
- `tests/prediction/keplerTwoBody.test.ts` now covers a 120 Mm semimajor-axis
  Earth orbit after a 60-second coast away from periapsis. Before the fix, this
  state throws during full-period sampling; after the fix it produces the
  capped 1,200-point closed loop and closes its seam within one centimeter.
- `DESIGN.md` remains accurate because no visual language or layout changed.

### Validation

- Focused Biome check passed for the changed prediction source and test.
- Focused prediction, runtime, and presentation tests passed: 65 tests.
- `npm test` passed 693 product tests, 16 automation-claim tests, and 4
  engineer-workflow tests.
- `npm run build` passed configuration validation, TypeScript, and the release
  Vite build.
- `npm run benchmark:trajectory -- --run` passed.
- The desktop and mobile trajectory render-density GUI tests passed.
- An exact transient browser replay of the regression state passed at effective
  x1m on 1440×900 desktop and 390×844 mobile. Over a 1.2-second observation,
  simulation time advanced by more than 30 seconds, prediction stayed
  `closed-orbit`, synchronous calculations remained below 20 ms, and the page
  reported no console or uncaught errors. The inspected screenshots were:
  - `tmp/playwright-results/pr330KeplerFreeze.playtest-1677d-sponsive-at-one-minute-warp-mobile-chromium/pr-330-long-period-kepler-desktop.png`
  - `tmp/playwright-results/pr330KeplerFreeze.playtest-1677d-sponsive-at-one-minute-warp-mobile-chromium/pr-330-long-period-kepler-mobile.png`
- The full `npm run test:gui` run passed 86 of 88 tests. The known highscores
  accessible-name mismatch still expects `Time 7h30m` while the UI exposes
  `Time 07h30m`. An unrelated controlled-fling timing expectation also observed
  `x2m` instead of `x1m` at its early sample and reproduced in isolation.
