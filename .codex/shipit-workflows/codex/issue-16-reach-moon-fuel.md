# Shipit State

Task: Issue #16 - Add mission fuel capacity, mass contribution, and thruster depletion behavior
Branch: codex/issue-16-reach-moon-fuel
Current Mode: yeet
Status: active

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [ ] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline
- Tech note: `docs/tech-notes/2026-06-19-reach-moon-fuel.md`

## Decisions

- Issue URL: https://github.com/chmurson/space-web-game/issues/16
- Issue start comment: https://github.com/chmurson/space-web-game/issues/16#issuecomment-4751310938
- Issue progress comment: https://github.com/chmurson/space-web-game/issues/16#issuecomment-4751426518
- Issue #16 is assigned to the authenticated GitHub user as the in-progress marker; this repo has no current `in progress` label or project status for this issue.
- Issue #16 has no comments as of pickup on 2026-06-19.
- Apply repository guidance: Shipit from the start, Ponytail lens throughout, and Game Studio foundations guidance for scenario/simulation boundaries.
- Keep fuel mission-scoped and optional. Tutorial and Free Roam must not gain fuel limits unless their scenario configuration explicitly opts in.
- Keep the first fuel model simple and tunable; player-visible resource pressure matters more than physically perfect propellant simulation.
- Avoid new dependencies, broad mission frameworks, or renderer-owned gameplay state.

## Open Questions

- None currently. The issue body and parent #14 provide clear first-pass scope.

## Validation

- [x] Focused simulation/scenario tests for fuel availability, consumption, depletion, and mass effects
- [x] npm test
- [x] npm run build
- [x] npx biome lint src tests scripts
- [x] git diff --check
- [x] Browser smoke/playtest for Reach the Moon fuel behavior if user-visible HUD/input behavior changes
- [x] coderabbit --base main --agent
- [x] npm run deploy:netlify

## Next Step

Commit, push, open/merge PR, deploy production from main, and close issue #16.

## Brainstorm Handoff

Problem:
- Reach the Moon needs finite fuel so the mission has resource pressure and future scoring input.
- Existing Tutorial and Free Roam behavior should remain unlimited unless configured otherwise.

Goals:
- Add scenario/simulation configuration for optional fuel capacity.
- Consume fuel for main thrust and turning/attitude thrusters.
- Prevent fuel-consuming engines from firing when fuel is depleted.
- Include remaining fuel in the ship mass model so acceleration and gravity response change as fuel burns off.
- Keep fuel deterministic enough for scoring and regression tests.

Non-goals:
- No HUD fuel pill or mission prompts; issue #18 owns player-facing HUD feedback.
- No objective tracking; issue #17 owns mission phase/orbit completion.
- No scoring or completion routing; issue #19 owns final score calculation.
- No highscore persistence; issue #20 owns shared leaderboard storage.
- No broad mission authoring system.

User-facing behavior:
- Reach the Moon starts with finite fuel once entered behind the existing `?reachmoon=1` gate.
- Burning main or attitude thrusters spends fuel.
- At zero fuel, thrust input no longer accelerates/rotates the ship, but the mission/gameplay continues.

Edge cases:
- Fuel never drops below zero.
- Unlimited-fuel scenarios keep current input and physics behavior.
- Depletion during a frame clamps thrust/turning effects to the available fuel budget rather than producing negative fuel or extra impulse.

## Design Handoff

Implementation scope:
- Reuse the existing spacecraft fuel fields instead of adding a mission subsystem.
- Treat `spacecraft.fuel` as the current normalized remaining fuel fraction.
- Treat `spacecraft.fuelCapacity > 0` as finite fuel capacity in kg; `fuelCapacity <= 0` means unlimited fuel for existing scenarios.
- Keep `spacecraft.fuelMass` as the mass contribution at full tanks, so spacecraft mass is `dryMass + fuelMass * fuel`.
- Consume finite fuel from main, reverse, strafe, and turn controls inside the physics step.
- Scale thrust acceleration and heading rotation by available fuel during a frame, so partial depletion cannot grant free impulse.
- Set Reach the Moon to finite fuel while Earth-Moon, Tutorial, and Moon capture debug remain unlimited.

Target files:
- `src/simulation/physics/semiImplicitEuler.ts`
- `src/simulation/scenarios/earthMoon.ts`
- `src/runtime/simulationStep.ts`
- `src/scenario/scenarioRegistry.ts`
- `tests/simulation/physics/semiImplicitEuler.test.ts`
- `tests/runtime/simulationStep.test.ts`
- `tests/scenario/runtimeScenario.test.ts`
- `docs/tech-notes/2026-06-19-reach-moon-fuel.md`

Data flow:
- Scenario creation initializes spacecraft fuel fields.
- Runtime transitions already carry the spacecraft state into simulation.
- `stepSimulationFrame` resolves controls as before.
- `stepSimulationFrame` drops fuel-consuming controls when finite fuel is already depleted.
- The physics engine applies fuel availability to movement/turning and returns updated fuel state.

Risks:
- Accidentally making Tutorial or Free Roam fuel-limited.
- Consuming fuel during unlimited scenarios and changing current debug/HUD behavior.
- Letting zero-fuel turn controls continue rotating the ship.
- Creating a broad mission resource framework before objective/scoring issues need it.

Test strategy:
- Unit-test finite main thrust fuel consumption and `fuelUsed` accounting.
- Unit-test finite turn fuel consumption and zero-fuel rotation lockout.
- Unit-test partial-frame depletion clamps fuel to zero and scales impulse.
- Unit-test lower remaining fuel mass increases acceleration.
- Unit-test Reach the Moon has finite fuel while Earth-Moon and Tutorial stay unlimited.

Completion criteria:
- Reach the Moon starts with finite fuel.
- Tutorial and Free Roam remain unlimited.
- Fuel-consuming controls drain finite fuel and stop working at depletion.
- Mass changes deterministically with remaining fuel.

## Task Slices

- [x] Add minimal fuel-capacity helpers inside the physics engine.
- [x] Apply fuel availability to thrust acceleration, heading rotation, and fuel state updates.
- [x] Gate resolved controls when finite fuel is depleted.
- [x] Make `createEarthMoonScenario` default to unlimited fuel while preserving current full-tank mass.
- [x] Configure Reach the Moon with finite fuel.
- [x] Add focused simulation/scenario tests.
- [x] Add the required dated tech note.

## Implementation Handoff

Changed files:
- `.codex/shipit-workflows/codex/issue-16-reach-moon-fuel.md`
- `docs/tech-notes/2026-06-19-reach-moon-fuel.md`
- `src/runtime/simulationStep.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/simulation/physics/semiImplicitEuler.ts`
- `src/simulation/scenarios/earthMoon.ts`
- `tests/runtime/simulationStep.test.ts`
- `tests/scenario/runtimeScenario.test.ts`
- `tests/scenario/scenarioPrompts.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `tests/simulation/physics/semiImplicitEuler.test.ts`

Completed behavior:
- Reach the Moon starts with finite fuel capacity.
- Earth-Moon sandbox, Tutorial, and Moon capture debug stay unlimited by default.
- Finite fuel drains from main, reverse, strafe, and turn controls.
- Finite fuel clamps at zero and scales the final partially fueled frame.
- Zero finite fuel blocks fuel-consuming controls and prevents thrust/turning from applying.
- Lower remaining fuel mass increases acceleration according to the existing mass model.

Deviations from design:
- Added a small depleted-fuel control gate in `simulationStep` after noticing `state.controls` also drives time-warp clamping and visual active-control state.

Known gaps:
- No fuel HUD pill, no depleted-fuel notification, no objective tracking, no scoring, and no highscores; those remain #18, #17, #19, and #20 respectively.

Validation so far:
- `npx vitest run tests/simulation/physics/semiImplicitEuler.test.ts tests/runtime/simulationStep.test.ts tests/scenario/runtimeScenario.test.ts` passed: 3 files, 19 tests.
- `npx vitest run tests/simulation/physics/semiImplicitEuler.test.ts tests/runtime/simulationStep.test.ts tests/scenario/runtimeScenario.test.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` passed: 6 files, 71 tests.
- `npm test` passed: 37 files, 240 tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- `npx biome lint src tests scripts` exited successfully with one unrelated existing warning for `src/style.css:1624` using `!important`.
- `git diff --check` passed.
- Browser smoke on `http://127.0.0.1:5174/?reachmoon=1` confirmed `reach-moon` starts with `fuelCapacity: 32000`.
- Browser smoke held main thrust for about 0.9s and confirmed `fuelUsed` increased from `0` to about `6.3 kg` while fuel fraction decreased.
- Browser smoke on `http://127.0.0.1:5174/?scenario=earth-moon` confirmed Free Roam has `fuelCapacity: 0` and thrust does not change `fuel` or `fuelUsed`.
- Mobile 390x844 menu and gameplay snapshots were visually checked for overlap; generated screenshot files were removed after inspection.
- Browser console preserved one unrelated dev-server `favicon.ico` 404; no app warnings or errors were observed.
- `coderabbit --base main --agent` stalled in the reviewing phase and was stopped after repeated heartbeat messages.
- `npm run deploy:netlify` passed.
- Shared staging deploy: https://fanciful-bunny-d77b4b.netlify.app
- Unique staging deploy: https://6a3532409f7e9b2304f24fb8--fanciful-bunny-d77b4b.netlify.app
- Netlify logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a3532409f7e9b2304f24fb8

## Cleanup Notes

Cleanup performed:
- Formatted the changed source/test files with Biome.
- Updated tutorial-owned test fixtures from finite `fuelCapacity: 32000` to unlimited `fuelCapacity: 0` so tests match the new scenario rule.
- Removed temporary browser smoke screenshot files after visual inspection.

Cleanup intentionally skipped:
- No shared fuel helper module was added; the finite-fuel checks are small and currently only shared inside the physics/control-resolution files.
- No HUD text or fuel pill was added because #18 owns player-facing fuel UI.
- No mission resource framework was added; the existing spacecraft fields cover #16.

## Review Notes

CodeRabbit status:
- `coderabbit --base main --agent` connected, set up the sandbox, summarized the diff, reached `reviewing`, and then emitted only heartbeat messages.
- The run was stopped manually after repeated heartbeats and no findings output. Treat this as a stalled CodeRabbit gate, not a clean CodeRabbit pass.

Automated findings:
- None available because CodeRabbit did not finish.

Ponytail lens outcome:
- Kept the implementation on existing spacecraft fields: no resource framework, no mission system, no dependency, no UI placeholder.
- Used `fuelCapacity > 0` as the finite-fuel opt-in instead of adding another flag.
- Kept helper functions local to the files where they are used.

Self-review outcome:
- Verified Reach the Moon is the only scenario opted into finite fuel.
- Verified zero finite fuel clears active fuel-consuming controls so time-warp/visual state do not treat dead controls as active thrust.
- Verified physics clamps fuel at zero and scales partial final-frame thrust/turning.
- Verified unlimited scenarios keep full-tank mass and do not spend fuel.
- Verified tutorial-owned fixtures now document unlimited fuel.

Solution retrospect:
- The existing `fuel` normalized fraction plus `fuelCapacity` kg shape is good enough for #16.
- Fuel mass affects thrust acceleration through spacecraft mass. Gravity remains acceleration-based in the existing physics model, which avoids an incorrect mass-dependent gravity hack.
- #18 should own fuel HUD/depletion messaging, and #19 can use `fuelUsed`/remaining fraction for scoring.

Residual risk:
- CodeRabbit did not produce findings.
- The first fuel rates are tunable constants; playtesting may adjust the `32_000 kg` capacity or turn-consumption multiplier after #17/#18 make the mission loop visible.
