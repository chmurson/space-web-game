# Runtime scenario state nesting plan

## Context

`AppRuntimeState` still mixes three concerns at the top level:

- simulation/world state
- runtime scenario/session metadata
- transient UI/player state

The scenario-related slice is currently spread across these top-level fields:

- `activeScenarioTitle`
- `activeScenarioDescription`
- `resetScenario`
- `scenarioDirectives`
- `scenarioSession`

The current runtime shape stores a separate reset target, but this plan now treats that domain as redundant and removes it entirely from `AppRuntimeState`.

## Goal

Move scenario-related app-runtime state under one nested `scenario` object.

Suggested target:

```ts
export type AppRuntimeState = {
  scenario: {
    activeDescription: string
    activeTitle: string
    directives: RuntimeScenarioDirectives
    session: RuntimeScenarioSession
  }
  // all other current fields remain flat
}
```

Important details:

- rename `scenarioSession` to `scenario.session`
- move `scenarioDirectives` to `scenario.directives`
- move `activeScenarioTitle` to `scenario.activeTitle`
- move `activeScenarioDescription` to `scenario.activeDescription`
- remove the separate reset domain from `AppRuntimeState`
- make scenario restart rely on `scenario.session.scenarioId`
- keep directives distinct from session-owned state even though they are grouped under the same app-runtime field
- do not keep both old and new names around unless a blocker forces a short-lived bridge

## Non-goals

- do not split other runtime fields into more nested groups
- do not redesign scenario checkpoint structure
- do not rename scenario-layer domain fields just because they also contain `scenarioSession`
- do not change debug snapshot format unless the compiler forces a small call-site adjustment
- do not change how scenario directives are derived
- do not change how scenarios are loaded, advanced, or reset

## Current runtime shape

At the time of writing, `src/runtime/appRuntimeState.ts` looks roughly like this:

```ts
export type AppRuntimeState = {
  activeScenarioDescription: string
  activeScenarioTitle: string
  assistMode: AssistMode
  assistTargetIndex: number
  coastPredictionHorizonHours: number
  crashedBodyName: string | null
  debugModeEnabled: boolean
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
  performanceDebugEnabled: boolean
  resetScenario: {
    description: string
    scenarioId: string
    title: string
  }
  scenarioDirectives: RuntimeScenarioDirectives
  scenarioSession: RuntimeScenarioSession
  spacecraftLabelIntroUntil: number
  targetHeadingSelectionEpoch: number
  uiEffectEpoch: number
  state: SimulationState
  targetHeading: number | null
  timeWarpIndex: number
  viewportSize: number
}
```

The refactor should move the four live scenario-related fields into `scenario` and remove the separate `resetScenario` field.

## Refactor rule

Apply this mapping consistently for app-runtime reads and writes:

- `runtime.activeScenarioTitle` -> `runtime.scenario.activeTitle`
- `runtime.activeScenarioDescription` -> `runtime.scenario.activeDescription`
- `runtime.scenarioDirectives` -> `runtime.scenario.directives`
- `runtime.resetScenario.scenarioId` -> `runtime.scenario.session.scenarioId` when used as a restart source
- `runtime.scenarioSession` -> `runtime.scenario.session`

Also update indexed types:

- `AppRuntimeState['resetScenario']` usages should be removed rather than remapped to a new app-runtime field
- `AppRuntimeState['scenarioDirectives']` -> `AppRuntimeState['scenario']['directives']`
- `AppRuntimeState['scenarioSession']` -> `AppRuntimeState['scenario']['session']`

## Current hotspots

Based on the current repo, the main app-runtime call sites are:

- `src/runtime/appRuntimeState.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/scenarioRecovery.ts`
- `src/runtime/highLevelActions/registerHighLevelActions.ts`
- `src/app/createAppComponents.ts`
- `src/presentation/hudPresentation.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`

Tests and fixtures that currently encode the flat shape:

- `src/app/createInitialAppRuntimeState.test.ts`
- `src/runtime/runtimeActions.test.ts`
- `src/runtime/scenarioRecovery.test.ts`
- `src/runtime/gameQueries.test.ts`
- `src/scenario/scenarioDirectives.test.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

These changes should be broad but mostly mechanical once the type is updated.

## Recommended shape

Adding a small alias is reasonable here because the nested object is no longer trivial:

```ts
export type AppRuntimeScenarioState = {
  activeDescription: string
  activeTitle: string
  directives: RuntimeScenarioDirectives
  session: RuntimeScenarioSession
}

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
  scenario: AppRuntimeScenarioState
  spacecraftLabelIntroUntil: number
  targetHeadingSelectionEpoch: number
  uiEffectEpoch: number
  state: SimulationState
  targetHeading: number | null
  timeWarpIndex: number
  viewportSize: number
}
```

No additional reset-target alias should be necessary once the separate reset domain is removed.

Important boundary:

- `scenario.session` is owned scenario/session state
- `scenario.directives` is derived runtime output resolved from session state, scenario definitions, and global limits
- grouping them together in `runtime.scenario` is about app-runtime organization, not about treating directives as part of `RuntimeScenarioSession`

## Implementation plan

### Step 1: Change the runtime state type

File:

- `src/runtime/appRuntimeState.ts`

Replace the flat scenario-related fields with:

```ts
scenario: {
  activeDescription: string
  activeTitle: string
  directives: RuntimeScenarioDirectives
  session: RuntimeScenarioSession
}
```

Keep every other field exactly where it is today.

### Step 2: Update initial runtime state creation

File:

- `src/app/createInitialAppRuntimeState.ts`

Build the new nested object during initialization:

```ts
const runtimeState: AppRuntimeState = {
  assistMode: 'off',
  ...
  scenario: {
    activeDescription: initialScenarioTransition.scenario.activeDescription,
    activeTitle: initialScenarioTransition.scenario.activeTitle,
    directives: createDefaultScenarioDirectives(),
    session: initialScenarioTransition.scenario.session,
  },
  ...
}
```

If `ScenarioRuntimeTransition` is updated to mirror the nested shape, this can be simpler:

```ts
scenario: {
  ...initialScenarioTransition.scenario,
  directives: createDefaultScenarioDirectives(),
},
```

Do not change:

- initial scenario selection
- directive sync timing
- any initial numeric defaults
- menu-mode special handling for `spacecraftLabelIntroUntil` and `timeWarpIndex`

### Step 3: Update the scenario transition/controller layer

Primary file:

- `src/runtime/createScenarioRuntimeController.ts`

This is the highest-sensitivity runtime file because it owns scenario entry, reset, tutorial/free-roam switching, and debug snapshot load.

Recommended adjustments:

- remove `RuntimeScenarioResetTarget`
- change `ScenarioRuntimeTransition` so the scenario metadata travels as one `scenario` object
- write metadata into `options.runtime.scenario.*`
- write the runtime scenario session object into `options.runtime.scenario.session`
- leave directive recomputation to `syncRuntimeScenarioDirectives()` rather than persisting directives in transitions
- remove app-runtime reset-target writes entirely
- make `resetScenario()` read from `options.runtime.scenario.session.scenarioId`

Recommended transition shape:

```ts
export type ScenarioRuntimeTransition = {
  coastPredictionHorizonHours: number
  scenario: Omit<AppRuntimeState['scenario'], 'directives'>
  state: AppRuntimeState['state']
  viewportSize: number
}
```

Important caution for debug snapshot loading:

- `loadedDebugScenario.runtimeState` is a `RuntimeScenarioState`, not an `AppRuntimeState`
- that type should still expose `scenarioSession`
- the read should remain `loadedDebugScenario.runtimeState.scenarioSession.scenarioId`
- only the destination app-runtime writes should become `runtime.scenario.*`

Watch the following carefully:

- `resetScenario()` should still reset to the last selected scenario
- `loadDebugSnapshot()` should still leave restart behavior correct by loading the new session object with its own `scenarioId`
- `uiEffectEpoch` behavior must remain unchanged
- directives should still be recomputed through `syncRuntimeScenarioDirectives()` after transitions and during the frame loop

### Step 4: Update runtime helpers that read checkpoints or save snapshots

Files:

- `src/runtime/runtimeActions.ts`
- `src/runtime/scenarioRecovery.ts`
- `src/runtime/highLevelActions/registerHighLevelActions.ts`
- `src/app/createAppComponents.ts`

Specific expectations:

- checkpoint access becomes `runtime.scenario.session.checkpoint`
- snapshot save payload should use `scenarioSession: options.runtime.scenario.session`
- any UI button state using checkpoint existence should read from `runtime.scenario.session.checkpoint`
- live directive reads in runtime helpers become `runtime.scenario.directives`

Important caution:

- the runtime-scenario layer still uses `scenarioSession` as a domain name
- `saveRuntimeDebugSnapshot()` still expects `{ scenarioSession: ... }`
- this refactor should not rename that API unless there is a separate reason to do so

### Step 5: Update scenario and presentation callers

Files likely involved:

- `src/presentation/hudPresentation.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`

These changes should be mechanical:

- scenario id reads become `runtime.scenario.session.scenarioId`
- scenario state reads become `runtime.scenario.session.state`
- scenario object replacement becomes `runtime.scenario.session = ...`
- directive reads become `runtime.scenario.directives`
- HUD fallback title/description become `runtime.scenario.activeTitle` and `runtime.scenario.activeDescription`

Watch for tutorial code paths that replace the whole runtime scenario session object each frame. Those semantics should stay the same after the move:

- `runtime.scenarioSession = { ... }` becomes `runtime.scenario.session = { ... }`

Also update comments that explicitly mention the old field path, for example in `scenario-prompts.ts`.

### Step 6: Update tests and fixtures

The current test suite has multiple inline `AppRuntimeState` fixtures that still use the flat shape.

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
  scenario: {
    activeDescription: 'Tutorial description',
    activeTitle: 'Tutorial',
    directives: createDefaultScenarioDirectives(),
    session: createRuntimeScenarioSession('tutorial', { ... }),
  },
  ...
}
```

Assertion rule examples:

- `runtime.resetScenario.scenarioId` should no longer exist on `AppRuntimeState`
- `runtime.scenarioSession.scenarioId` -> `runtime.scenario.session.scenarioId`
- `runtime.scenarioDirectives.maxTimeWarp` -> `runtime.scenario.directives.maxTimeWarp`
- `runtime.activeScenarioTitle` -> `runtime.scenario.activeTitle`

### Step 7: Run targeted tests

Most relevant suites:

```sh
npm test -- createInitialAppRuntimeState runtimeActions scenarioRecovery gameQueries scenarioDirectives tutorialScenario tutorialOnboardingProgress
```

If the filter arguments are awkward with the current runner, use the direct Vitest equivalent:

```sh
npx vitest run \
  src/app/createInitialAppRuntimeState.test.ts \
  src/runtime/runtimeActions.test.ts \
  src/runtime/scenarioRecovery.test.ts \
  src/runtime/gameQueries.test.ts \
  src/scenario/scenarioDirectives.test.ts \
  src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts \
  src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts
```

Also run a type/build check:

```sh
npm run build
```

The main purpose is to catch:

- missed app-runtime call sites
- broken fixture shapes
- indexed type references that still point at removed flat fields
- stale comments or expectations around `runtime.scenarioSession`

## Recommended order of execution

This order should keep compiler churn manageable:

1. update `src/runtime/appRuntimeState.ts`
2. update `src/runtime/createScenarioRuntimeController.ts`
3. update `src/app/createInitialAppRuntimeState.ts`
4. run a search/replace pass for the moved field paths and removed `resetScenario` references
5. fix remaining runtime, scenario, presentation, and tutorial call sites
6. update tests and fixtures
7. run targeted tests
8. run `npm run build`

## Search checklist

Use repo-wide search for each old field name until no app-runtime call sites remain:

- `activeScenarioTitle`
- `activeScenarioDescription`
- `resetScenario`
- `scenarioDirectives`
- `scenarioSession`
- `AppRuntimeState['resetScenario']`
- `AppRuntimeState['scenarioDirectives']`
- `AppRuntimeState['scenarioSession']`

Be careful with `resetScenario` and `scenarioSession` because not every occurrence belongs to `AppRuntimeState`.

These should usually stay unchanged:

- `RuntimeScenarioState['scenarioSession']`
- `RuntimeScenario['scenarioSession']`
- snapshot option keys named `scenarioSession`
- snapshot payload keys like `runtimeScenario`
- helper/function parameter names that describe scenario-layer objects instead of app-runtime fields

The key distinction is:

- rename app-runtime field access
- do not blindly rename scenario-layer domain names

## Risks and pitfalls

### 1. Over-renaming domain objects

`scenarioSession` is still a legitimate scenario-layer concept. That does not mean every `scenarioSession` token should become `scenario.session`.

Examples that should stay unchanged:

- `createRuntimeScenarioState(...).scenarioSession`
- `RuntimeScenarioState['scenarioSession']`
- `createSnapshotFromState(..., { scenarioSession })`

Examples that should change:

- `runtime.scenarioSession`
- `options.runtimeState.scenarioSession`
- `AppRuntimeState['scenarioSession']`

`scenarioDirectives` is different: it should move under `runtime.scenario`, but it should not be folded into `RuntimeScenarioSession`.

### 2. Indexed type breakage

After the type move, these will fail until updated:

- `AppRuntimeState['resetScenario']`
- `AppRuntimeState['scenarioDirectives']`
- `AppRuntimeState['scenarioSession']`

These are easy to miss because they are not property reads.

### 3. Transition/controller drift

If `AppRuntimeState` is nested but `ScenarioRuntimeTransition` remains flat, it is easy to update some assignments and miss others.

The simplest way to reduce that risk is to move the transition metadata under `transition.scenario` as well.

### 4. Test fixture drift

Several tests construct large inline runtime objects. Missing one nested `scenario` wrapper will cause noisy failures.

### 5. Tutorial mutation paths

Tutorial logic replaces the runtime scenario session object in multiple places. Every one of those writes must become `runtime.scenario.session = ...`.

### 6. Comment drift

There are comments and docstrings that explicitly say `runtime.scenarioSession` or `runtime.scenarioDirectives`. They should be updated along with the code so the next refactor pass is not working against stale explanations.

## Acceptance criteria

The refactor is complete when:

- `AppRuntimeState` no longer exposes top-level `activeScenarioTitle`
- `AppRuntimeState` no longer exposes top-level `activeScenarioDescription`
- `AppRuntimeState` no longer exposes top-level `resetScenario`
- `AppRuntimeState` no longer exposes top-level `scenarioDirectives`
- `AppRuntimeState` no longer exposes top-level `scenarioSession`
- the replacement nested field is `runtime.scenario`
- restart behavior uses `runtime.scenario.session.scenarioId`
- scenario reset, free roam start, tutorial start, checkpoint restart, and debug snapshot load all behave exactly as before
- directive recomputation behavior remains unchanged
- relevant tests pass

## Suggested handoff prompt

Use this if handing the refactor to another model:

```text
Refactor `AppRuntimeState` so scenario-related app-runtime state is nested under `runtime.scenario`.

Rules:
- Keep the refactor narrow and behavior-preserving.
- Do not redesign unrelated runtime state.
- Replace:
  - `runtime.activeScenarioTitle` -> `runtime.scenario.activeTitle`
  - `runtime.activeScenarioDescription` -> `runtime.scenario.activeDescription`
  - `runtime.scenarioDirectives` -> `runtime.scenario.directives`
  - `runtime.scenarioSession` -> `runtime.scenario.session`
- Remove the separate app-runtime reset domain entirely and make restart rely on `runtime.scenario.session.scenarioId`.
- Keep `runtime.scenario.directives` and `runtime.scenario.session` as siblings.
- Do not move directives into `RuntimeScenarioSession`; directives remain derived runtime output.
- Update indexed types like:
  - `AppRuntimeState['resetScenario']`
  - `AppRuntimeState['scenarioDirectives']`
  - `AppRuntimeState['scenarioSession']`
- Be careful not to rename unrelated scenario-layer `scenarioSession` domain fields.
- In `loadDebugSnapshot`, keep reading from `loadedDebugScenario.runtimeState.scenarioSession`; only the app-runtime destination becomes nested.
- Update tests and run targeted Vitest suites after the change.

Start with:
1. `src/runtime/appRuntimeState.ts`
2. `src/runtime/createScenarioRuntimeController.ts`
3. `src/app/createInitialAppRuntimeState.ts`

Then fix remaining compiler and test failures mechanically.
```

## Status

Implemented.
