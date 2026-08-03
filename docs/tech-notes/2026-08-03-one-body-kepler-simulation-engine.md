# One-body Kepler simulation engine

Date: 2026-08-03

Shipit state:
`.codex/shipit-workflows/automation/issue-347-kepler-simulation-engine.md`

Issue: [#347](https://github.com/chmurson/space-web-game/issues/347)

## What changed

- Added `kepler` as a real `PhysicsEngine` registered behind
  `engine=kepler`.
- Reused the existing universal-variable two-body propagator for live
  spacecraft coast motion in exactly one-body scenarios.
- Made the selected engine derive the trajectory predictor, so Kepler live
  simulation and Kepler trajectory prediction are enabled by the same URL
  switch.
- Retired the `trajectoryPrediction=kepler` URL behavior and removed the
  trajectory-model selector from the developer flags menu. Applying the
  remaining developer flags also removes a stale legacy parameter from the
  URL.
- Added engine-owned state validation before startup and runtime scenario
  loads, resets, debug snapshot loads, and checkpoint restores. Kepler mode
  throws a clear error before state mutation unless there is exactly one
  positive-mass body.
- Added focused engine/runtime tests and desktop/mobile Playwright coverage for
  a complete displayed Earth orbit.

## Why

The closed-orbit renderer previously allowed `engine=kepler` to mean
prediction-only behavior while live motion still used the default numerical
engine. That made a single URL appear to select one model while actually
comparing two. The new engine makes the URL honest and keeps the one-body
restriction explicit until patched-conic work exists.

## Ownership boundaries

- `src/simulation/physics/kepler.ts` owns the one-body engine, its state guard,
  and the control/gravity split used by live steps.
- `src/prediction/keplerTwoBody.ts` remains the owner of analytic two-body
  propagation and trajectory sampling.
- `src/simulation/physics/spacecraftControls.ts` owns shared thrust, heading,
  angular-velocity, and fuel calculations used by both engines. Extracting the
  existing calculation keeps default Euler behavior unchanged.
- `src/app/createAppConfigContext.ts` owns URL engine selection and derives the
  internal prediction implementation from that one source.
- `src/runtime/createScenarioRuntimeController.ts` owns validation before
  runtime scenario state changes; initial startup validates in
  `src/app/createInitialAppRuntimeState.ts`.
- `src/runtime/simulationStep.ts` remains the owner of time-warp subdivision,
  collision detection, and crash freeze behavior.

## Controls, time warp, collision, and crash behavior

- Player and assist controls are not dropped. Each existing runtime physics
  substep resolves controls first; the Kepler engine applies the shared
  heading/fuel calculation and a thrust velocity kick before analytically
  propagating gravity for that substep.
- This is an operator-split powered-flight approximation, not a closed-form
  finite-burn solution. The runtime currently limits physics substeps to one
  simulated second, bounding the split error. Passive coast motion uses the
  exact existing Kepler propagator.
- Time warp keeps the same caps and one-second physics subdivision as the
  default engine. No Kepler-specific warp bypass exists.
- Collision checks still run after each substep. On impact, the existing
  runtime clamps the spacecraft to the body surface, matches body velocity,
  clears controls and targeting, records the crashed body, and stops future
  physics steps.
- As with the existing numerical path, collision detection samples substep end
  states rather than solving continuous time of impact. Extremely fast motion
  that enters and exits a body within one one-second substep can tunnel; this
  issue does not expand scope into continuous collision detection.

## Important decisions

- Kepler support is deliberately strict: one body total, and that body must
  have positive mass. There is no numerical fallback for unsupported worlds.
- The default engine remains semi-implicit Euler, and ordinary URLs ignore the
  retired `trajectoryPrediction` parameter.
- The developer menu keeps its independent extended-horizon flag, but it no
  longer chooses a physical model.
- No patched conics, SOI/Hill transitions, or multi-body approximations were
  introduced.

## Validation

- `npm test`: passed all 799 product tests, 16 task-claim tests, and 7 engineer
  workflow tests.
- `npm run build`: passed config validation, TypeScript compilation, and the
  production Vite build. The existing large-chunk warning remains informational.
- Focused Playwright coverage in `tests/gui/keplerTrajectoryPlaytest.spec.ts`:
  passed all 3 tests. The 1024×720 desktop and 390×844 mobile cases each ran
  longer than one approximately 92-minute simulated orbit at 1800× warp,
  retained a closed Kepler prediction, stayed out of crash state, and bounded
  position mismatch below 100 m, radius drift below 10 m, and speed drift below
  0.02 m/s.
- Full `npm run test:gui`: 106 of 107 tests passed, including all 3 new Kepler
  tests. The sole failure is the existing mobile Reach the Moon leaderboard
  expectation for accessible text `Time 7h30m`; this branch does not touch that
  test or leaderboard behavior.
- Visually inspected the generated desktop/mobile one-period orbit screenshots
  and the developer-flags screenshot. Both game viewports showed a coherent
  closed cyan orbit with usable HUD controls, and the developer menu retained
  only the trajectory-horizon selector.

## Follow-ups and known gaps

- Future patched-conic work should relax or replace the one-body validator
  while keeping `engine` as the only model-selection surface.
- A future finite-burn integrator could reduce the documented one-second
  operator-split approximation without changing the coast propagator.
