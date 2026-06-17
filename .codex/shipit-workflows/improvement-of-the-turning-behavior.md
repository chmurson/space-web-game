# Shipit State

Task: Improvement of the turning behavior
Branch: improvement-of-the-turning-behavior
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

## Decisions

- Branch was created from the current HEAD of `new-looks-of-turning-animations`, which was clean and 13 commits ahead of `origin/main`.
- Follow repository guidance for this Three.js/Vite game.
- Use `game-studio:web-game-foundations` if the work changes simulation, runtime state, scenario flow, game-loop behavior, or input architecture.
- Use `game-studio:three-webgl-game` if the work changes render-loop behavior, camera controls, pointer input, visual simulation presentation, or code under scene/render/presentation areas.
- Use `game-studio:game-playtest` after gameplay, camera, rendering, HUD, input, or responsive-layout changes.
- Run CodeRabbit and apply the Ponytail review lens during Shipit review.
- Target turn progression should use a symmetric ease-in/ease-out speed profile: begin more gradually than the current behavior, reach peak speed around the middle of the turn, then slow down near the end.
- Turning progression is real runtime/gameplay state, not renderer-only animation. Visual animation should reflect the authoritative turn state rather than maintaining a separate eased presentation-only timeline.
- Apply the new progression to discrete target-heading turns. Continuous assist modes such as capture/circularize can keep their existing proportional steering because their desired headings can change every frame.
- Use the existing total turn-rate budget as the responsiveness bound; preserve the configured turn rate and compute the eased runtime heading plan around it.
- Second tuning pass: target-heading turns should use fixed angular acceleration independent of turn width. Short turns should use a triangular velocity profile and may never hit max speed; wider turns should accelerate at the same rate, cruise at max turn speed, then decelerate at the same rate.
- Third tuning pass: target-heading turns should be twice slower overall. Keep the same triangular/trapezoidal profile shape, but cap target-heading angular speed at half of the configured turn-rate budget.

## Open Questions

- None before implementation. Validate target-heading selection from desktop and mobile interaction paths because both feed the same runtime target-heading path.

## Validation

- [x] `npm test -- --run tests/runtime/simulationStep.test.ts` passed.
- [x] `npm test` passed: 32 files, 174 tests.
- [x] `npm run build` passed: config validation, TypeScript, and Vite release build.
- [x] `npx biome check --write <touched files>` applied formatting fixes.
- [x] `git diff --check` passed.
- [x] Desktop browser playtest passed: double-click target heading selected a target, turn control ramped from a slow start, peaked at `0.5`, cleared after completion, the scene rendered correctly, and no console warnings/errors were reported.
- [x] Mobile browser playtest passed: emulated touch double-tap selected a target, turn control ramped from a slow start, peaked at `0.5`, cleared after completion, and no console warnings/errors were reported.
- [x] Browser screenshots captured:
  - `/tmp/space-web-game-turn-half-speed-desktop.png`
  - `/tmp/space-web-game-turn-half-speed-mobile.png`
- [x] Browser console check passed with no warnings or errors.
- [x] `npm run deploy:netlify` deployed branch `improvement-of-the-turning-behavior` to the shared non-main staging site.
- [x] Staging URL HTTP check passed: `https://fanciful-bunny-d77b4b.netlify.app`.
- [x] Unique deploy URL HTTP check passed: `https://6a327aa23b952f0b5c3c2078--fanciful-bunny-d77b4b.netlify.app`.

## Brainstorm Handoff

Problem statement: Improve the game's turning behavior. The current turn progression appears to start almost immediately at too much speed and then mostly decelerate toward the end. The target feel is a more balanced turn that starts gradually, accelerates to a mid-turn peak, and decelerates into the endpoint.

Goals:
- Clarify the expected turning behavior before design or implementation.
- Preserve existing branch work from `new-looks-of-turning-animations` as the base for this branch.
- Keep the implementation scoped to turning behavior unless new requirements justify a broader change.
- Make the runtime turn state use the improved progression so rendered animation, heading, and gameplay behavior stay aligned.

Non-goals:
- No product code changes have been made during branch setup.
- No deployment is needed for this workflow-state-only change.

User-facing behavior:
- Turning should feel less abrupt at the start while preserving the existing smooth slowdown at the end.
- The desired curve is not flat constant speed; it should be closer to an ease-in/ease-out profile with a natural acceleration phase and a natural settling phase.
- The visual turn animation should be a presentation of actual turn state, not an independent cosmetic effect that can drift from gameplay.

Edge cases and failure states:
- Avoid making turn initiation feel laggy even though the first phase becomes slower.
- Confirm whether desktop input, touch input, camera behavior, and trajectory feedback all use the same turn progression.
- Avoid splitting gameplay heading and rendered heading into two different timelines.

## Design Handoff

Implementation scope:
- Add serialized runtime state for an active target-heading turn plan: start heading, target heading, elapsed seconds, and duration seconds.
- When a target heading is active, have `stepSimulationFrame` advance the real `spacecraft.heading` along a smoothstep-style ease-in/ease-out progression.
- Keep presentation unchanged except for naturally reflecting the updated `spacecraft.heading`.
- Clear the active target-turn plan whenever target heading is cleared, manual turn overrides, scenario reset/load/recovery clears transient turn state, or a new target heading is selected.

Target files and modules:
- `src/simulation/types.ts`: shared target-turn state type.
- `src/runtime/appRuntimeState.ts`: runtime slice includes the active target-turn plan.
- `src/runtime/simulationStep.ts`: create and advance target-turn plans, returning the updated plan in frame results.
- `src/runtime/runtimeActions.ts` and `src/runtime/runtimeStateTransitions.ts`: clear/restart turn plans at target selection and transition boundaries.
- `src/app/createAppComponents.ts` and `src/runtime/frameLoop.ts`: pass configured turn rate into simulation stepping if needed.
- `tests/runtime/simulationStep.test.ts`: verify slow start, mid-turn peak, end slowdown, and cleanup.

Risks:
- Time-warp stepping can use larger `dt` slices, so the target-turn plan must remain stable with coarse and fine frame intervals.
- If the eased plan is presentation-only, the heading indicator and trajectory can drift; keep the real heading as the source of truth.
- Very small turns must still complete promptly and avoid feeling stuck.

Validation commands:
- `npm test -- --run tests/runtime/simulationStep.test.ts`
- `npm run build`
- Browser playtest with desktop and mobile viewport coverage.
- `npm run deploy:netlify`

Cleanup expectations:
- Keep helper code close to the runtime turn logic unless reuse appears naturally.
- Avoid changing assist-mode steering, rendering, or UI behavior outside target-heading turn progression.

Completion criteria:
- A target-heading turn starts slower than the current immediate full-speed start, reaches faster turn input near the middle, slows near completion, and clears its target state at the end.
- The rendered ship and heading UI continue to read from `spacecraft.heading`.
- Build, focused tests, browser smoke playtest, and staging deploy complete.

## Task Slices

- [x] Add target-heading turn state type and lifecycle clearing.
- [x] Implement eased runtime turn progression in `stepSimulationFrame`.
- [x] Add focused runtime tests for the turn speed profile and target cleanup.
- [x] Run tests/build, browser playtest, and staging deploy.
- [x] Replace scaled smoothstep turn progression with fixed-acceleration triangular/trapezoidal progression.
- [x] Add focused runtime tests proving short and long turns share the same early acceleration.
- [x] Re-run tests/build, browser playtest, and staging deploy.
- [x] Apply half-speed target-heading turn tuning.
- [x] Update focused runtime tests for the half-speed peak.
- [x] Re-run validation, browser playtest, and staging deploy.

## Fixed-Acceleration Tuning Handoff

Implementation scope:
- Replace the smoothstep progress calculation in `src/runtime/simulationStep.ts` with an analytical angular velocity profile.
- Initially keep maximum angular speed equal to the configured `autopilotRotationRate`; the later half-speed tuning caps target-heading angular speed at 50% of that budget.
- Use one fixed acceleration ramp time so the acceleration feel is the same for short and long turns.
- For turns too short to reach max speed, use a triangular profile: accelerate then immediately decelerate.
- For larger turns, use a trapezoidal profile: accelerate, cruise, decelerate.

Validation additions:
- Focused runtime tests should compare early turn controls for short and long turns and confirm they share the same acceleration ramp.
- Browser playtest should sample short and long target-heading selections on desktop and at least one target-heading selection on mobile.

## Implementation Handoff

Changed files:
- `src/simulation/types.ts`
- `src/runtime/appRuntimeState.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/runtime/simulationStep.ts`
- `src/runtime/frameLoop.ts`
- `src/app/createAppComponents.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/runtime/scenarioRecovery.ts`
- `src/scenario/scenarioSession.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`
- `tests/runtime/simulationStep.test.ts`

Behavior implemented:
- Target-heading turns now create a runtime `TargetHeadingTurn` plan with start heading, target heading, elapsed seconds, and duration seconds.
- `stepSimulationFrame` advances the real `spacecraft.heading` through a fixed-acceleration angular velocity profile while preserving the configured turn-rate budget.
- Short target-heading turns use a triangular profile and can complete without reaching max turn speed.
- Wider target-heading turns use a trapezoidal profile: accelerate, cruise at configured max turn speed, then decelerate.
- The initial angular acceleration is now independent of turn width, so short and long turns share the same early ramp.
- Target-heading turns now use a `0.5` speed scale, so the same profile shape plays back about twice as slowly overall.
- Rendered ship orientation and heading UI remain driven by the authoritative `spacecraft.heading`.
- Manual turn overrides, assist-mode switches, target changes, transient scenario clears, collisions, and completed turns clear the active target-turn plan.

Deviations from design:
- Continuous capture/circularize assist steering remains on the existing proportional controller because those headings can change continuously.

Blockers:
- None.

Known gaps:
- No PR was requested or opened.

## Cleanup Notes

Cleanup performed:
- Ran Biome on touched files and accepted import/order/format fixes.
- Kept turn-profile helpers local to `simulationStep` because no other module needs them yet.

Cleanup intentionally skipped:
- Did not introduce a reusable turn-profile module; one runtime use is not enough to justify it.
- Did not change presentation code because it already reflects `spacecraft.heading`.

Stale artifacts/docs:
- No docs updates required beyond this Shipit state.

## Review Notes

Supplied findings:
- None.

Automated review:
- `coderabbit --base main --agent` completed with 1 finding.
- Finding fixed: `AppRuntimeSimulationSlice.targetHeadingTurn` is now required nullable instead of optional nullable, matching initialization and live runtime usage.

Self-review:
- Verified active target-turn plans own completion so the old dead-zone preview path cannot end eased turns early.
- Verified target-turn plans are cleared when target headings are replaced or transient scenario state is cleared.
- Verified time-warp clamping still sees active target-heading turns as active controls.
- Verified continuous assist steering was intentionally left unchanged.
- Verified fixed-acceleration short and long target-heading turns share identical early turn-control samples in focused runtime tests.
- Verified half-speed target-heading turns peak at roughly `0.5` normalized turn input in focused tests and browser smoke checks.
- Verified test runtime fixtures explicitly set `targetHeadingTurn: null` after making the live runtime slice field required.

Ponytail review lens:
- Lean already. Ship.

Solution retrospect:
- The implementation would still use a runtime turn plan if redesigned now; a renderer-only curve would violate the source-of-truth requirement.
- The helper code is large enough to test, but not large enough to split into a new module yet.
- Focused runtime coverage is adequate for the curve shape; browser playtesting covers the real desktop and mobile interaction paths.

Residual risk:
- The curve feel may still need subjective tuning after staging review, especially duration versus responsiveness.

Proposed follow-up issues:
- None.

## Next Step

Commit the branch, merge it to `main`, push `main`, and deploy production.
