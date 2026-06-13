# Shipit State

Task: Improve long-horizon trajectory calculation stability
Branch: trajectory-calc-improvement
Current Mode: review
Status: completed

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [x] PR opened/updated or explicitly not requested

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- User reported long-horizon trajectory prediction loses stability and precision, especially near large bodies such as Earth.
- Start by validating the claim against current code and researching numerically stable trajectory prediction approaches before changing product code.
- Follow `AGENTS.md`: executable/user-visible code changes on this non-main branch require relevant tests/build checks and a shared staging deploy before handoff.
- Keep product code untouched during the initial validation/research pass.
- Claim validated against the actual Earth-Moon scenario: shipped prediction reports false Earth impacts at 48h and 96h while a one-second runtime-style baseline does not impact.
- Main root cause is coupling rendered prediction sample spacing to physics integration step size.
- Follow-up issue for async/off-main-thread prediction and zoom-aware rendering: `https://github.com/chmurson/space-web-game/issues/1`.

## Open Questions

- What runtime budget should prediction refresh target on low-end mobile devices?
- Is it acceptable for long bound-orbit predictions to be visually truncated earlier when accuracy would otherwise require too much work?

## Validation

- [x] Inspect current trajectory calculation path.
- [x] Reproduce or disprove long-horizon instability with a read-only local experiment.
- [x] Compare observed failure mode with numerical integration references.

## Next Step

Commit this branch, merge to `main`, and deploy production.

## Brainstorm Handoff

Problem statement:

- Current trajectory prediction may become unstable or imprecise for long prediction horizons.
- The suspected worst case is prediction near massive bodies such as Earth, where acceleration gradients are high and small numerical errors can compound quickly.

Goals:

- Validate whether the current implementation shows measurable instability or precision loss.
- Identify likely root causes in the current algorithm and scale choices.
- Research practical fix options suitable for an interactive browser game.

Non-goals for this pass:

- Do not implement product-code changes until the failure mode and recommended design are understood.
- Do not broaden unrelated trajectory UI or control behavior.

User-facing behavior:

- Trajectory previews should remain visually stable and believable across long horizons, especially near large bodies, without unacceptable frame-time cost.

Edge cases and failure states:

- Close passes near Earth or other massive bodies.
- Long prediction horizons with accumulated integration error.
- Very small distances that can produce huge accelerations or floating-point cancellation.
- Predictor mismatch versus the runtime physics step.

## Design Handoff

Current implementation:

- `getTrajectoryPredictionStepSeconds` chooses `stepSeconds` from the render sampling ladder using `horizonSeconds / targetMaxSteps`.
- `predictCoastTrajectory` and `predictAssistedTrajectory` call `physicsEngine.step` once per prediction point using that `stepSeconds`.
- The shipped config allows prediction physics steps up to `1800s` as horizons grow.
- Runtime gameplay uses the same physics engine, but `stepSimulationFrame` advances it in `1s` chunks.

Validation results:

- Actual Earth-Moon scenario, current predictor:
  - `24h`: `90s` step, no impact, closest Earth approach reported near `89km` altitude.
  - `48h`: `180s` step, false Earth impact at `720s`, closest approach near `-63km`.
  - `96h`: `300s` step, false Earth impact at `600s`, closest approach near `-231km`.
- Same Earth-Moon scenario with a one-second runtime-style baseline:
  - `24h`, `48h`, and `96h` remain near `396km` minimum Earth altitude with no impact.
- Simplified Earth fast close flyby also diverges with horizon:
  - `24h`: current final position differs from one-second baseline by about `1.9Mm`.
  - `48h`: about `10.7Mm`.
  - `96h`: about `52.0Mm`.
- Candidate experiment:
  - Euler with internal `10s` cap removes false impacts in the tested parking orbit and preserves close-flyby altitude much better, but costs more iterations.
  - RK4 improves the tested flyby at coarse steps, but is not a safe drop-in for long bound orbits at very coarse steps.
  - Verlet/leapfrog improves some geometric properties but still has large phase error at the shipped coarse steps.

Research notes:

- Adaptive high-order gravitational integrators such as IAS15 are designed for close encounters and high-eccentricity orbits, with automatic timestep selection.
- Generic ODE solvers expose `max_step`, tolerances, dense output, and event detection because step size and output sampling are separate concerns.
- Close encounters make fixed large timesteps unreliable because the shortest dynamical timescale can become very small.
- Symplectic/leapfrog methods are useful for long Hamiltonian behavior, but still require an appropriate timestep and do not by themselves solve the current coarse-step issue.

Recommended implementation direction:

- Keep the existing rendered point budget, but integrate internally with smaller substeps and only record points at display sample intervals.
- Start with a conservative, runtime-aligned internal step cap for trajectory prediction, such as `10s` or an adaptive cap based on local gravitational timescale near the dominant body.
- Preserve impact and closest-approach checks at internal substep resolution, not just rendered point resolution.
- Add regression tests for the default Earth-Moon parking orbit at `24h`, `48h`, and `96h` so prediction does not falsely report Earth impact.
- Add a close-flyby regression comparing coarse-render prediction against a finer baseline within an explicit tolerance.
- Consider a second pass for an adaptive or higher-order predictor only after measuring refresh cost on target devices.

## Task Slices

- [x] Add prediction-internal substep policy that is independent of rendered point spacing.
- [x] Update coast and assisted trajectory prediction to integrate in internal substeps while recording at existing visual sample intervals.
- [x] Check impact and closest approach per internal substep.
- [x] Add Earth-Moon long-horizon false-impact regression tests.
- [x] Add close-flyby precision regression tests.
- [x] Measure/validate test suite and build; deploy staging if executable code changes are made.

## Implementation Handoff

Changed files:

- `src/prediction/trajectoryPrediction.ts`
- `config/base.yml`
- `config/game-config.schema.json`
- `src/config/types.ts`
- `tests/prediction/trajectoryPrediction.test.ts`
- `tests/runtime/gameQueries.test.ts`
- `tests/app/createInitialAppRuntimeState.test.ts`

Behavior implemented:

- Trajectory prediction now keeps `stepSeconds` as the visual output interval.
- A new `maxIntegrationStepSeconds` sampling config caps internal physics chunks independently from visual point spacing.
- Internal coast and assisted trajectory prediction now advance through substeps and only emit visual points at the existing sample interval.
- Coast prediction checks closest approach and body impact at internal substep resolution.
- Assisted prediction recalculates controls per internal substep, closer to runtime stepping behavior.
- The internal step also applies a local gravitational-timescale limiter so stronger gravity can reduce substeps below the configured maximum.
- Shipped config sets `trajectory.sampling.maxIntegrationStepSeconds` to `8`.

Tests added/updated:

- Added default Earth-Moon long-horizon regressions covering `24h`, `48h`, and `96h`; they assert no false Earth impacts and a sane closest approach.
- Added a close Earth flyby regression that compares the shipped `8s` cap against a `1s` baseline.
- Updated runtime query/config test fixtures for the new config field.

Deviations:

- Used an `8s` shipped cap instead of the initial `10s` candidate after validation showed the 96h close-flyby endpoint stayed substantially closer to the `1s` baseline.

Known gaps:

- No browser performance profile has been captured yet for worst-case `768h` unbound predictions on low-end mobile hardware.

## Cleanup Notes

- Named the adaptive step constants (`gravityTimescaleStepRatio`, `minIntegrationStepSeconds`) instead of leaving inline magic numbers.
- Kept the implementation scoped to prediction, config wiring, and regression tests.
- No unrelated refactors or UI changes were made.

## Review Notes

Supplied findings:

- None.

Self-review findings:

- Refined the first fixed `10s` cap into a local gravitational-timescale limiter plus a shipped `8s` maximum after the `60s` cap left the 96h close-flyby endpoint too far from the `1s` baseline.
- Kept `stepSeconds` as the visual sample interval and renamed the solver cap to `maxIntegrationStepSeconds` to avoid implying it is always the exact internal step.
- Created follow-up issue for async prediction/rendering scalability: `https://github.com/chmurson/space-web-game/issues/1`.
- No merge-blocking code-review findings remain.

Solution retrospect:

- The main design correction is appropriate: prediction output sampling and physics integration are now separate.
- The predictor still uses the same runtime physics engine, which keeps behavior consistent without introducing a second integrator family.
- A higher-order or more sophisticated adaptive integrator could improve long-horizon performance/accuracy further, but it is a larger follow-up and not required to fix the validated false-impact bug.
- Regression coverage now locks the actual Earth-Moon false-impact case and a close Earth flyby precision case.

Validation results:

- Passed: `npm test -- --run tests/prediction/trajectoryPrediction.test.ts`.
- Passed: `npm test -- --run` (30 files, 132 tests).
- Passed: targeted `npx biome check ...` on changed source/test/config files.
- Passed: `npm run build` (config validation, `tsc`, Vite release build). Vite emitted the existing large chunk warning.
- Passed: `git diff --check`.
- Passed: local worst-case probe for a `768h` unbound Earth flyby with shipped `8s` cap; it completed in about `166ms` in Node on this machine and produced 1537 visual points.
- Passed: `npm run deploy:netlify`.
- Staging URL: `https://fanciful-bunny-d77b4b.netlify.app`.
- Unique deploy URL: `https://6a2c87bbeec7292af08b0276--fanciful-bunny-d77b4b.netlify.app`.

Residual risk:

- The `768h` maximum-horizon unbound case is much more expensive than the previous coarse predictor. It was acceptable on this machine, but low-end mobile performance may need a later budgeted/truncated predictor path if users frequently preview maximum horizons.
- Follow-up issue for this risk: `https://github.com/chmurson/space-web-game/issues/1`.
