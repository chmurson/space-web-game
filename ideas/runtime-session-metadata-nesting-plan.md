# Runtime session metadata nesting plan

## Context

`AppRuntimeState` currently mixes three different concerns at the top level:

- simulation/world state
- scenario/session lifecycle metadata
- transient UI/player state

Recent additions made that boundary worse by adding more scenario/session fields directly onto `AppRuntimeState`:

- `activeScenarioTitle`
- `activeScenarioDescription`
- `resetScenarioId`
- `scenarioSession`

Those fields all describe the active runtime scenario/session rather than the broader app runtime. They should be grouped under one nested field so the state shape better reflects ownership.

This refactor should stay narrow:

- preserve behavior
- avoid redesigning unrelated runtime state
- avoid changing scenario logic semantics
- avoid introducing compatibility aliases unless required by an unexpected blocker

## Goal

Move scenario/session metadata from flat `AppRuntimeState` fields into a nested `session` object.

Suggested target:

```ts
type AppRuntimeState = {
  session: {
    activeScenarioTitle: string
    activeScenarioDescription: string
    resetScenarioId: string
    scenario: RuntimeScenarioSession
  }
  // all other current fields remain flat
}
```

Important detail:

- rename `scenarioSession` to `session.scenario`
- do not keep both names around unless a blocker makes a temporary bridge necessary

## Non-goals

- do not split other runtime fields into more nested groups
- do not redesign scenario checkpoint structure
- do not change debug snapshot format unless required by the type rename already flowing through saved payload construction
- do not change how scenario directives are derived
- do not change how scenarios are loaded, advanced, or reset

## Current hotspots

Based on current repo usage, the flat fields are referenced in these areas:

- `src/runtime/appRuntimeState.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/scenarioRecovery.ts`
- `src/presentation/hudPresentation.ts`
- `src/app/createAppComponents.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- tutorial scenario helpers/tests
- runtime/scenario tests with inline `AppRuntimeState` fixtures

This is a broad call-site migration, but most edits are mechanical.

## Refactor rule

Apply this mapping consistently:

- `runtime.activeScenarioTitle` -> `runtime.session.activeScenarioTitle`
- `runtime.activeScenarioDescription` -> `runtime.session.activeScenarioDescription`
- `runtime.resetScenarioId` -> `runtime.session.resetScenarioId`
- `runtime.scenarioSession` -> `runtime.session.scenario`

Also update any indexed type usage:

- `AppRuntimeState['scenarioSession']` -> `AppRuntimeState['session']['scenario']`

## Implementation plan

### Step 1: Change the runtime state type

File:

- `src/runtime/appRuntimeState.ts`

Change `AppRuntimeState` to add a nested `session` object containing:

- `activeScenarioTitle`
- `activeScenarioDescription`
- `resetScenarioId`
- `scenario`

Keep every other field exactly where it is today.

Target shape:

```ts
export type AppRuntimeState = {
  assistMode: AssistMode
  assistTargetIndex: number
  coastPredictionHorizonHours: number
  crashedBodyName: string | null
  debugModeEnabled: boolean
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
  performanceDebugEnabled: boolean
  scenarioDirectives: RuntimeScenarioDirectives
  session: {
    activeScenarioDescription: string
    activeScenarioTitle: string
    resetScenarioId: string
    scenario: RuntimeScenarioSession
  }
  spacecraftLabelIntroUntil: number
  targetHeadingSelectionEpoch: number
  uiEffectEpoch: number
  state: SimulationState
  targetHeading: number | null
  timeWarpIndex: number
  viewportSize: number
}
```

No helper type is strictly required, but adding a small exported alias is acceptable if it keeps signatures cleaner:

```ts
export type AppRuntimeSessionState = {
  activeScenarioDescription: string
  activeScenarioTitle: string
  resetScenarioId: string
  scenario: RuntimeScenarioSession
}
```

Only add that alias if it actually improves readability.

### Step 2: Update initial runtime state creation

File:

- `src/app/createInitialAppRuntimeState.ts`

Build the new nested `session` object during initialization:

```ts
const runtimeState: AppRuntimeState = {
  assistMode: 'off',
  ...
  scenarioDirectives: createDefaultScenarioDirectives(),
  session: {
    activeScenarioDescription: initialScenario.description,
    activeScenarioTitle: initialScenario.name,
    resetScenarioId: initialScenarioId,
    scenario: initialRuntimeScenarioState.scenarioSession,
  },
  ...
}
```

Do not change:

- initial scenario selection
- directive sync timing
- any initial numeric defaults

### Step 3: Update scenario transition ownership paths

Primary file:

- `src/runtime/createScenarioRuntimeController.ts`

This is the most important behavior-sensitive file after the type definition.

Required updates:

- change `AppRuntimeState['scenarioSession']` references in signatures
- write scenario metadata into `options.runtime.session.*`
- write the runtime scenario session object into `options.runtime.session.scenario`
- read reset target from `options.runtime.session.resetScenarioId`
- when loading a debug snapshot, read snapshot scenario id from `loadedDebugScenario.runtimeState.session.scenario.scenarioId` after the migration

Watch the following carefully:

- `resetScenario()` should still reset to the last selected scenario
- `loadDebugSnapshot()` should still update the reset target exactly as it does today
- `uiEffectEpoch` behavior must remain unchanged

### Step 4: Update runtime helpers that read checkpoints or save snapshots

Files:

- `src/runtime/runtimeActions.ts`
- `src/runtime/scenarioRecovery.ts`
- `src/runtime/highLevelActions/registerHighLevelActions.ts`
- `src/app/createAppComponents.ts`

Specific expectations:

- checkpoint access becomes `runtime.session.scenario.checkpoint`
- snapshot save payload should use `scenarioSession: options.runtime.session.scenario` unless the snapshot format itself is also being renamed in the runtime-scenario layer
- any UI button state using checkpoint existence should read from `runtime.session.scenario.checkpoint`

Important caution:

- the user asked for a narrow refactor of `AppRuntimeState`
- avoid renaming unrelated snapshot object keys outside runtime state unless the compiler forces it

### Step 5: Update scenario/presentation callers

Files likely involved:

- `src/presentation/hudPresentation.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`

These changes should be mechanical:

- scenario id reads become `runtime.session.scenario.scenarioId`
- scenario state reads become `runtime.session.scenario.state`
- scenario object replacement becomes `runtime.session.scenario = ...`
- HUD fallback title/description become `runtime.session.activeScenarioTitle` and `runtime.session.activeScenarioDescription`

Watch for places that compare session object identity or assume it may be replaced each frame. Those semantics should stay the same after moving the field under `session`.

### Step 6: Update tests and fixtures

There are several tests with inline `AppRuntimeState` fixtures that will fail until updated.

Likely files:

- `src/app/createInitialAppRuntimeState.test.ts`
- `src/runtime/runtimeActions.test.ts`
- `src/runtime/scenarioRecovery.test.ts`
- `src/runtime/gameQueries.test.ts`
- `src/scenario/scenarioDirectives.test.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

Fixture rule:

```ts
const runtime: AppRuntimeState = {
  assistMode: 'capture',
  ...
  scenarioDirectives: createDefaultScenarioDirectives(),
  session: {
    activeScenarioDescription: 'Tutorial description',
    activeScenarioTitle: 'Tutorial',
    resetScenarioId: 'tutorial',
    scenario: createRuntimeScenarioSession('tutorial', { ... }),
  },
  ...
}
```

Assertion rule:

- `runtime.resetScenarioId` -> `runtime.session.resetScenarioId`
- `runtime.scenarioSession.scenarioId` -> `runtime.session.scenario.scenarioId`
- `runtime.activeScenarioTitle` -> `runtime.session.activeScenarioTitle`

### Step 7: Run targeted tests

Run the most relevant suites first:

```sh
npm test -- createInitialAppRuntimeState runtimeActions scenarioRecovery scenarioDirectives tutorialScenario tutorialOnboardingProgress
```

If that filter syntax does not match this repo’s test runner setup, run the nearest working equivalent with `vitest`.

Also run a type/build check if available:

```sh
npm run build
```

The main purpose is to catch:

- missed call sites
- broken fixture shapes
- indexed type references that still point at the removed flat fields

## Recommended order of execution

This order minimizes compiler churn:

1. update `src/runtime/appRuntimeState.ts`
2. update `src/app/createInitialAppRuntimeState.ts`
3. update `src/runtime/createScenarioRuntimeController.ts`
4. run a search/replace pass for the four renamed access paths
5. fix remaining type errors in runtime/presentation/scenario files
6. update test fixtures
7. run targeted tests

## Search checklist

Use repo-wide search for each old field name until no runtime-state call sites remain:

- `activeScenarioTitle`
- `activeScenarioDescription`
- `resetScenarioId`
- `scenarioSession`
- `AppRuntimeState['scenarioSession']`

Be careful with `scenarioSession` because not every occurrence belongs to `AppRuntimeState`.

These should usually stay unchanged:

- `RuntimeScenarioState['scenarioSession']`
- snapshot object keys named `scenarioSession`
- helper/function parameter names that describe scenario-layer objects instead of app runtime fields

The key distinction is:

- rename app runtime field access
- do not blindly rename scenario-layer domain names

## Risks and pitfalls

### 1. Over-renaming domain objects

`scenarioSession` exists in the scenario layer as a domain concept. That does not mean every `scenarioSession` token should become `session.scenario`.

Example:

- `createRuntimeScenarioState(...).scenarioSession` should probably remain unchanged
- `runtime.scenarioSession` should change

### 2. Indexed type breakage

`AppRuntimeState['scenarioSession']` will fail after the type change. These are easy to miss because they are not property reads.

### 3. Test fixture drift

Some tests construct large inline runtime objects. Missing one nested `session` wrapper will cause noisy failures.

### 4. Snapshot load path

`createScenarioRuntimeController.loadDebugSnapshot()` reads scenario id and session data from a loaded runtime state. That path needs special attention because it reads already-materialized runtime state rather than creating a fresh one.

### 5. Mutation paths in tutorial code

Tutorial logic appears to replace the whole runtime scenario session object in several places. Those writes must become `runtime.session.scenario = ...` consistently.

## Acceptance criteria

The refactor is complete when:

- `AppRuntimeState` no longer exposes flat `activeScenarioTitle`
- `AppRuntimeState` no longer exposes flat `activeScenarioDescription`
- `AppRuntimeState` no longer exposes flat `resetScenarioId`
- `AppRuntimeState` no longer exposes flat `scenarioSession`
- the replacement nested field is `runtime.session`
- scenario reset, free roam start, tutorial start, checkpoint restart, and debug snapshot load all behave exactly as before
- relevant tests pass

## Suggested handoff prompt for a simpler model

Use this refactor prompt:

```text
Refactor `AppRuntimeState` so scenario/session metadata is nested under `runtime.session`.

Rules:
- Keep the refactor narrow and behavior-preserving.
- Do not redesign unrelated runtime state.
- Replace:
  - `runtime.activeScenarioTitle` -> `runtime.session.activeScenarioTitle`
  - `runtime.activeScenarioDescription` -> `runtime.session.activeScenarioDescription`
  - `runtime.resetScenarioId` -> `runtime.session.resetScenarioId`
  - `runtime.scenarioSession` -> `runtime.session.scenario`
- Update indexed types like `AppRuntimeState['scenarioSession']`.
- Be careful not to rename unrelated scenario-layer `scenarioSession` domain fields.
- Update tests and run targeted test suites after the change.

Start with:
1. `src/runtime/appRuntimeState.ts`
2. `src/app/createInitialAppRuntimeState.ts`
3. `src/runtime/createScenarioRuntimeController.ts`

Then fix remaining compiler/test failures mechanically.
```

## Status

Promising
