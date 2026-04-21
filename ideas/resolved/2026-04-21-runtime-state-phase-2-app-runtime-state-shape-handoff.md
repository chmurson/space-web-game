# AppRuntimeState Phase 2 handoff

## Context

Phase 1 already improved runtime mutation ownership by moving the main write paths behind more central helpers.

That was the right first move, but the runtime shape is still only partially structured:

- `scenario` is already grouped
- most simulation, UI, and debug fields are still flat on `AppRuntimeState`

Today that means even well-contained runtime code still reads like one large mixed bag of concerns:

- simulation control and world state
- scenario session and derived directives
- transient UI epochs
- debug toggles and debug status text

The next step should be a compatibility refactor that reshapes `AppRuntimeState` into clearer slices without changing runtime behavior.

## Goal

Reshape `AppRuntimeState` into domain-oriented slices so reads and writes communicate responsibility more clearly:

- `simulation`
- `scenario`
- `ui`
- `debug`

This phase should stay mechanical.

## Constraints

- do not redesign runtime ownership from scratch
- do not mix in gameplay tuning
- do not mix in UI redesign
- do not widen module APIs just to make tests easier
- do not bundle unrelated cleanup into the same pass
- preserve existing behavior

## Recommended target shape

Use the following structure for Phase 2:

```ts
import type { AssistMode } from '../assist/orbitalAssist'
import type { RuntimeScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import type { RuntimeScenarioSession } from '../scenario/scenarioSession'
import type { SimulationState } from '../simulation/types'

export type AppRuntimeSimulationSlice = {
  assistMode: AssistMode
  assistTargetIndex: number
  coastPredictionHorizonHours: number
  crashedBodyName: string | null
  state: SimulationState
  targetHeading: number | null
  timeWarpIndex: number
  viewportSize: number
}

export type AppRuntimeScenarioSlice = {
  activeDescription: string
  activeTitle: string
  directives: RuntimeScenarioDirectives
  session: RuntimeScenarioSession
}

export type AppRuntimeUiSlice = {
  spacecraftLabelIntroUntil: number
  targetHeadingSelectionEpoch: number
  uiEffectEpoch: number
}

export type AppRuntimeDebugSlice = {
  debugModeEnabled: boolean
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
  performanceDebugEnabled: boolean
}

export type AppRuntimeState = {
  simulation: AppRuntimeSimulationSlice
  scenario: AppRuntimeScenarioSlice
  ui: AppRuntimeUiSlice
  debug: AppRuntimeDebugSlice
}
```

## Why this exact shape

This shape matches how the code already behaves:

- most runtime logic clusters around simulation control and world stepping
- scenario metadata, directives, and session already belong together
- UI timing and interaction epochs are transient UI/runtime glue
- debug toggles and debug snapshot messaging form a separate concern

It is enough structure to improve readability without turning Phase 2 into an architecture rewrite.

## Field placement decisions

### `simulation.state`

Keep the existing `state` field name inside `simulation`.

Reasons:

- it is already used broadly
- renaming it to `world` would create a second large rename axis
- that extra churn does not buy enough value in this phase

### `viewportSize`

Keep `viewportSize` inside `simulation`, not `ui`.

Reasons:

- it participates in checkpoint restore
- it is constrained by scenario directives
- it behaves more like runtime camera/world state than like pure UI state

### `targetHeadingSelectionEpoch`

Place `targetHeadingSelectionEpoch` inside `ui`.

This is the least obvious field in the shape. It influences tutorial onboarding logic, so it is not purely cosmetic, but it is still best treated as an interaction epoch rather than simulation world state.

Do not try to solve that ambiguity in Phase 2. Keep it in `ui` and revisit only if a later phase gives a stronger reason to move it.

### `activeTitle` and `activeDescription`

Keep both in `scenario`.

They are user-facing, but they represent active scenario metadata and are already aligned with scenario ownership.

### `debugSnapshotStatus`

Keep it in `debug`.

It is UI-visible text, but it is debug-only status and should stay near the other debug controls and indicators.

## Migration strategy

Do this as a compatibility refactor with one real shape change and a compiler-driven sweep.

### Main rule

Do not introduce runtime compatibility adapters that preserve both shapes at once.

Avoid:

- dual flat and nested fields
- runtime getters/setters that mimic the old shape
- long-lived compatibility helpers like `getRuntimeAssistMode(runtime)`

Those patterns would increase complexity, make ownership less obvious, and allow old call sites to linger.

### Safer approach

1. add slice types first
2. update indexed-access helper types to use slice types where useful
3. change `AppRuntimeState` to the nested shape
4. perform a single mechanical migration across production code
5. update tests and fixtures honestly rather than masking old shapes with casts

### Why this is safer

- the repo is small enough for a compile-driven sweep
- the compiler will force every real call site to move
- runtime behavior stays unchanged because the work is mostly field-path migration
- the review remains understandable if structural churn is not mixed with cleanup

## Recommended mechanical field mapping

Use these replacements as the migration guide:

- `runtime.assistMode` -> `runtime.simulation.assistMode`
- `runtime.assistTargetIndex` -> `runtime.simulation.assistTargetIndex`
- `runtime.coastPredictionHorizonHours` -> `runtime.simulation.coastPredictionHorizonHours`
- `runtime.crashedBodyName` -> `runtime.simulation.crashedBodyName`
- `runtime.state` -> `runtime.simulation.state`
- `runtime.targetHeading` -> `runtime.simulation.targetHeading`
- `runtime.timeWarpIndex` -> `runtime.simulation.timeWarpIndex`
- `runtime.viewportSize` -> `runtime.simulation.viewportSize`
- `runtime.spacecraftLabelIntroUntil` -> `runtime.ui.spacecraftLabelIntroUntil`
- `runtime.targetHeadingSelectionEpoch` -> `runtime.ui.targetHeadingSelectionEpoch`
- `runtime.uiEffectEpoch` -> `runtime.ui.uiEffectEpoch`
- `runtime.debugModeEnabled` -> `runtime.debug.debugModeEnabled`
- `runtime.debugNoGravityEnabled` -> `runtime.debug.debugNoGravityEnabled`
- `runtime.debugSnapshotStatus` -> `runtime.debug.debugSnapshotStatus`
- `runtime.fpsIndicatorEnabled` -> `runtime.debug.fpsIndicatorEnabled`
- `runtime.performanceDebugEnabled` -> `runtime.debug.performanceDebugEnabled`

## Important migration caution

Do not blindly replace every `.state` access.

There are two different concepts in play:

- `runtime.simulation.state`
- `runtime.scenario.session.state`

This is the easiest place for a mechanical mistake to hide.

## Execution order

### 1. Prepare the runtime state types

Touch first:

- `src/runtime/appRuntimeState.ts`

Work:

- add the four slice types
- export them for indexed-access reuse
- keep naming stable and intentionally boring

### 2. Update helper and transition types that depend on indexed access

Touch next:

- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/scenarioRecovery.ts`

Work:

- retarget type references like `AppRuntimeState['state']`
- prefer slice-type access such as `AppRuntimeSimulationSlice['state']`

This step reduces friction before the main shape flip.

### 3. Flip `AppRuntimeState` to the nested shape

Touch immediately after:

- `src/runtime/appRuntimeState.ts`
- `src/app/createInitialAppRuntimeState.ts`

Work:

- change the type definition
- rebuild the initial runtime object literal into slices
- preserve current startup values exactly

### 4. Migrate runtime-owned mutation and orchestration paths

Touch next:

- `src/runtime/runtimeStateTransitions.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/scenarioRecovery.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/frameLoop.ts`
- `src/runtime/gameQueries.ts`
- `src/scenario/scenarioDirectives.ts`

Why this order:

- these modules own the core runtime reads and writes
- Phase 1 already centralized important mutations here
- getting these files stable first limits the chance of chasing presentation-only type noise while the core is still in flux

### 5. Migrate wiring and presentation consumers

Touch after core runtime compiles:

- `src/app/createAppComponents.ts`
- HUD-related presentation modules
- trajectory and spacecraft presentation modules

Work:

- update read paths to the new slices
- avoid opportunistic presentation cleanup

### 6. Migrate scenario consumers

Touch after the broad runtime sweep:

- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- any scenario helpers that read runtime fields directly

This is still mechanical in Phase 2. Do not mix in the stronger scenario typing work planned for Phase 3.

### 7. Update runtime-state fixtures and tests

Touch last, but keep runtime-core tests close to the production changes they cover.

Likely files:

- `src/app/createInitialAppRuntimeState.test.ts`
- `src/runtime/runtimeStateTransitions.test.ts`
- `src/runtime/scenarioRecovery.test.ts`
- `src/runtime/runtimeActions.test.ts`
- `src/runtime/gameQueries.test.ts`
- `src/scenario/scenarioDirectives.test.ts`
- tutorial scenario and onboarding tests

## File-by-file impact map

### Highest-priority files

- `src/runtime/appRuntimeState.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/frameLoop.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/scenarioRecovery.ts`
- `src/runtime/gameQueries.ts`
- `src/scenario/scenarioDirectives.ts`

These files should move first because they define the runtime shape, own the important state transitions, or constrain simulation values.

### Next-wave files

- `src/app/createAppComponents.ts`
- `src/presentation/hudPresentation.ts`
- `src/presentation/trajectoryPresentation.ts`
- `src/presentation/spacecraftPresentation.ts`

These files are read-heavy consumers of the runtime shape and will mostly need path updates.

### Final-wave files

- tutorial scenario modules
- tutorial onboarding modules
- tests and fixtures creating `AppRuntimeState` literals

## Test strategy

### During the migration

Run narrow tests after each meaningful batch.

Suggested runtime-core batch:

```bash
npm run test -- src/app/createInitialAppRuntimeState.test.ts src/runtime/runtimeStateTransitions.test.ts src/runtime/scenarioRecovery.test.ts src/runtime/runtimeActions.test.ts src/runtime/gameQueries.test.ts
```

Suggested scenario/tutorial batch:

```bash
npm run test -- src/scenario/scenarioDirectives.test.ts src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts
```

### Final verification

Run:

```bash
npm run test
npm run build
```

### What to watch specifically

- startup runtime still boots the same scenario and menu defaults
- scenario reset still resets to the same scenario and same initial time warp
- checkpoint restore still produces the same runtime values
- directive syncing still constrains time warp, viewport, and coast horizon
- HUD and presentation code still read from the correct fields
- tutorial onboarding still responds to target heading selection changes

## Risks and guardrails

### Risk: broad search-and-replace mistakes

Especially around `runtime.state`.

### Guardrail

Move carefully where both of these exist in the same file:

- `runtime.simulation.state`
- `runtime.scenario.session.state`

### Risk: hiding old fixtures behind casts

It is easy to keep tests compiling with `as AppRuntimeState` while leaving them structurally stale.

### Guardrail

Do not use broad casts to suppress migration work. Update fixture shapes directly.

### Risk: mixing structural changes with cleanup

The temptation will be to rename variables, extract helpers, or simplify logic while touching all call sites.

### Guardrail

Do not do that in Phase 2. If a cleanup is still desirable after the sweep, do it in a follow-up commit.

### Risk: introducing temporary adapter layers

This would reduce short-term pain, but it would also allow the flat shape to persist conceptually.

### Guardrail

Prefer one type flip and one mechanical sweep over a bridge layer.

### Risk: checkpoint and debug snapshot regressions

Those paths carry simulation, scenario, viewport, and debug state together, so they are good places for hidden mistakes.

### Guardrail

Keep checkpoint and scenario-load tests green throughout the migration. Do not leave those paths to end-of-pass verification only.

## Recommended commit boundaries

Keep commits small enough for review, but not so small that the code spends long in a half-migrated state.

### Commit 1

`refactor(runtime): introduce AppRuntimeState slice types`

Contents:

- add slice type exports
- retarget helper type references where useful
- no runtime shape change yet

### Commit 2

`refactor(runtime): nest AppRuntimeState and migrate core runtime paths`

Contents:

- change `AppRuntimeState` to the nested structure
- update runtime initializer
- update runtime transitions, controller, recovery, actions, frame loop, queries, and directive helpers

### Commit 3

`refactor(runtime): migrate runtime consumers to nested state slices`

Contents:

- app wiring
- presentation modules
- scenario consumers
- test fixtures

If the change set becomes too large, split Commit 3 into:

- presentation and app wiring
- scenario modules and tests

## Acceptance criteria

Phase 2 is done when:

- `AppRuntimeState` uses clear domain slices
- core runtime code reads and writes through the new slices consistently
- behavior remains unchanged
- tests were updated mechanically rather than through compatibility hacks
- the resulting review is mostly about field-path moves, not hidden logic changes

## Non-goals for this phase

- changing scenario typing strategy
- redesigning directive derivation
- reworking tutorial state flow
- replacing mutable runtime state with another state model
- UI polish or presentation cleanup

## Plain-language summary

This phase is mainly a labeling and organization pass for runtime state. The point is to make it obvious which values belong to simulation, scenario, UI, or debug behavior, while keeping the game working exactly the same as before.

## Status

Resolved on 2026-04-21.

Moved to `ideas/resolved/` because the runtime-state shape refactor landed and this note no longer tracks active work.
