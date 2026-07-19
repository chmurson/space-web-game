# Navigation time-warp restoration

Shipit state: `.codex/shipit-workflows/issue-270-restore-time-warp.md`

## What changed

Navigation now temporarily caps the effective time warp without discarding the
player's selected value. The first thrust, reverse, strafe, turn, or heading-plan
input preserves any selected warp above the existing control ceiling. Once every
navigation source is inactive for 500 ms, the preserved selection becomes
effective again.

Repeated and overlapping controls share the same pending selection. Re-engaging
navigation during the release delay cancels that delay and starts a fresh 500 ms
idle window when navigation stops again.

## Why

The simulation previously returned its capped time-warp index as the new runtime
index. That made the safety cap permanent because no separate value retained the
pre-navigation selection.

## Ownership and implementation

- `src/runtime/navigationTimeWarpController.ts` owns the temporary selection,
  active heading-plan state, simulation-control activity, and release timestamp.
- `src/runtime/simulationStep.ts` continues to resolve actual thrust and turn
  controls, then gives their aggregate active state to the controller before
  choosing the frame's effective warp.
- `src/runtime/runtimeActions.ts` routes explicit time-warp changes and
  heading-plan start/stop events through the same controller.
- `src/app/createAppComponents.ts` creates one controller shared by runtime
  actions and the frame loop.

The controller uses the configured time-warp ladder and existing 100x navigation
ceiling rather than assuming a fixed index. With the shipped ladder, the highest
safe value is 60x.

## Product decisions

- The first above-cap selection remains pending across overlapping inputs; later
  control starts cannot overwrite it with the temporary 60x value.
- An explicit, committed user warp change replaces the pending value. A new
  above-cap choice remains capped while navigation is active and is restored
  after release; a choice at or below the cap remains effective and prevents the
  old high value from returning.
- Time-warp changes rejected by the existing active-control feedback policy are
  not committed and therefore do not alter the pending selection.
- Scenario maximum-warp directives constrain both the effective and pending
  values.
- Scenario loads and checkpoint recovery reset pending navigation-warp state.

## Validation

- Focused Biome check completed for the changed TypeScript and test files.
- Focused Vitest run: 39 tests passed.
- Release build passed; Vite reported only the existing large-chunk advisory.
- Full automated suite passed: 571 Vitest tests, 16 automation-claim tests, and 3
  engineer-workflow tests.
- `git diff --check` passed.

## Follow-ups and known gaps

- No UI or layout changed, so GUI screenshot validation is not required.
- The release delay begins on the first animation frame that observes all
  simulation controls inactive; this can add at most one normal frame interval
  to the requested 500 ms.
