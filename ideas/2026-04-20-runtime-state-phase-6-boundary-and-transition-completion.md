# Runtime state Phase 6 boundary and transition completion

## Why there is still a Phase 6

The runtime-state refactor is not fully complete yet.

Phase 5 metadata ownership appears complete, but the remaining acceptance items from Phase 3 and Phase 4 are still open in the current codebase.

The repo is stable and tests pass. This is not a bug-fix phase. It is a completion pass for the refactor goals that were already planned but not fully landed.

## Verified remaining gaps

### Phase 3 gaps still open

- generic directive resolution still reads loose root-level session keys instead of a typed nested directive input field
- menu background scenario still stores camera/hidden-body directive input in that loose root shape
- scenario registry still repeats `definition.isState(...)` checks inline instead of routing through one shared validation helper
- HUD presentation still repeats the same validation pattern inline
- tutorial prompt acknowledgement still uses a cast for prompt effect

### Phase 4 gaps still open

- `ScenarioRuntimeTransition` still cannot describe runtime-owned patches such as simulation state, assist mode, or target heading
- scenario transition application still lives in `src/scenario/scenarioDirectives.ts` instead of a runtime-owned helper
- tutorial onboarding step changes still write `runtime.simulation.targetHeading` and `runtime.simulation.assistMode` directly
- tutorial phase advancement still mutates the live simulation world when repositioning the moon for phase 2
- `frameLoop` and `runtimeActions` still manually combine "request transition" and "apply transition" steps instead of delegating to runtime-owned orchestration helpers

## Goal

Finish the runtime/scenario ownership cleanup without widening scope.

After this phase:

- active scenario state is typed at the runtime boundary where the current code actually consumes it
- scenario code returns transition data instead of mutating runtime-owned fields directly
- runtime-owned code applies scenario transitions in one place
- directive resync remains centralized and automatic after scenario transitions
- behavior remains unchanged

## Scope

Do only the remaining work from Phase 3 and Phase 4.

Do not:

- redesign the app action system
- redesign the scenario registry into a type-level framework
- move high-level prompt navigation (`start-free-roam`, `exit-to-menu`) into runtime transitions
- retune tutorial gameplay or onboarding rules

## Execution plan

### 1. Finish the typed scenario-state boundary

Touch:

- `src/scenario/scenarioSession.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/specific-scenarios/menuBackgroundScenario.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/presentation/hudPresentation.ts`
- related tests

Work:

- add typed JSON-safe `runtimeDirectives` session input types
- stop reading generic directives from loose root-level keys
- migrate menu background scenario state and fixtures to `runtimeDirectives`
- add one shared helper that validates raw session state against a scenario definition
- reuse that helper in registry prompt helpers and HUD presentation
- remove the tutorial prompt-effect cast while keeping behavior unchanged

### 2. Extend scenario transitions so tutorial code can stay declarative

Touch:

- `src/scenario/scenarioRuntimeTransition.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

Work:

- add an optional runtime patch to `ScenarioRuntimeTransition` for:
  - `state`
  - `assistMode`
  - `targetHeading`
- make tutorial onboarding helpers return onboarding state plus optional runtime patch data
- replace the phase-2 moon repositioning mutation with a pure helper that returns the next simulation state
- compute tutorial checkpoints from the same next world that gets applied

### 3. Move scenario transition application under runtime ownership

Touch:

- `src/runtime/runtimeStateTransitions.ts`
- `src/scenario/scenarioDirectives.ts`

Work:

- move `applyScenarioRuntimeTransition` into `src/runtime/runtimeStateTransitions.ts`
- apply runtime patch fields before session updates
- keep directive resync centralized after transition application
- leave `src/scenario/scenarioDirectives.ts` focused on directive resolution and constraint logic

### 4. Add runtime-owned orchestration helpers and migrate callers

Touch:

- `src/runtime/runtimeStateTransitions.ts`
- `src/runtime/frameLoop.ts`
- `src/runtime/runtimeActions.ts`
- optionally `src/scenario/scenarioRegistry.ts`

Work:

- add helpers such as:
  - `advanceRuntimeScenario(...)`
  - `acknowledgeRuntimeScenarioPrompt(...)`
  - `reopenRuntimeScenarioPrompt(...)`
- make those helpers request scenario transitions and apply them through the runtime-owned apply path
- update `frameLoop` and `runtimeActions` to call the runtime-owned helpers instead of combining request/apply logic themselves

## Acceptance criteria

This phase is complete when:

- generic directive resolution no longer depends on loose root-level session keys
- menu background scenario state uses nested typed directive input
- registry and HUD consumers no longer repeat inline `isState` validation branches
- tutorial prompt acknowledgement no longer uses `as PromptActionEffect`
- tutorial onboarding step changes no longer write runtime-owned fields directly
- the tutorial phase-2 moon repositioning path returns next world state through the transition
- scenario transitions are applied by runtime-owned code in one place
- `frameLoop` and `runtimeActions` no longer manually combine transition request/apply logic
- directive resync still happens centrally after transition application
- gameplay behavior remains unchanged

## Verification

Run at minimum:

```bash
npm run test -- src/scenario/scenarioDirectives.test.ts src/runtime/runtimeStateTransitions.test.ts src/runtime/runtimeActions.test.ts src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts src/app/createInitialAppRuntimeState.test.ts
npm run test
npm run build
```

## Suggested implementation order

1. land the typed `runtimeDirectives` boundary and shared validation helper
2. extend `ScenarioRuntimeTransition` and refactor tutorial helpers to return data instead of mutating runtime
3. move scenario transition application into `src/runtime/runtimeStateTransitions.ts`
4. migrate `frameLoop` and `runtimeActions` to runtime-owned orchestration helpers

## Status

Planned.
