# Scenario startup/runtime boundary cleanup

## Context

The `createGameApp` init/runtime split is in much better shape now, but scenario bootstrapping still crosses the config, init-state, component, and runtime-action phases in a way that leaves a few smells behind.

Today:

- `src/app/createAppConfigContext.ts` materializes `initialScenario`
- `src/app/createInitialAppRuntimeState.ts` builds runtime state from that materialized scenario
- menu startup immediately replaces that state with `menu-background`
- `src/runtime/runtimeActions.ts` owns its own scenario loading path and a hidden `activeScenarioId`
- `src/app/createAppComponents.ts` still uses bootstrap scenario data as fallback HUD metadata

That means scenario selection, scenario materialization, scenario reset behavior, and scenario UI metadata do not yet have one clear owner.

## Current smells

### 1. Config creates runtime data

`AppConfigContext` is meant to be immutable startup/config data, but `initialScenario` is a full `RuntimeScenario` object with bodies, spacecraft state, optional elapsed time, and optional session state.

That makes config responsible for materializing runtime payloads instead of just describing startup intent.

### 2. Menu startup creates throwaway scenario state

When the app boots into menu mode, the requested scenario is still created first and then replaced by `menu-background` during initialization.

That work is unnecessary and makes the startup path harder to reason about.

### 3. Startup loading and runtime loading are split

Initial scenario loading happens in `createInitialAppRuntimeState`, while later scenario transitions happen in `runtimeActions`.

Both paths create runtime scenario state, reset transient runtime fields, and sync directives, but ownership is split across bootstrap and runtime code.

### 4. Reset behavior depends on hidden local state

`runtimeActions` keeps `activeScenarioId` as a closure-local value. That means the scenario used by reset/restart behavior is not obvious from `AppRuntimeState`.

This is the main remaining scenario lifecycle smell after the earlier refactor.

### 5. UI fallback metadata still comes from bootstrap config

HUD fallback title/description still come from the initial bootstrap scenario instead of the currently active runtime scenario.

That keeps a stale dependency from presentation back to config.

## Proposal

Do this follow-up in two behavior-preserving steps:

1. remove scenario materialization from the config phase
2. extract explicit scenario runtime ownership so startup, reset, menu background, and snapshot loading all follow one path

The first step is small and safe.

The second step is the real cleanup that removes the remaining code smell around scenario setup/state/runtime.

## Step 1

### Goal

Keep `AppConfigContext` purely about startup choices and static tuning. Do not materialize a `RuntimeScenario` there.

### Changes

- remove `initialScenario` from `AppConfigContext`
- remove `createRequestedRuntimeScenario(...)` from `createAppConfigContext.ts`
- keep only startup selection data in config:
  - `initialAppMode`
  - `requestedScenarioId`
  - physics engine
  - user settings
  - tuning/config values
- move initial scenario materialization into `createInitialAppRuntimeState.ts`

### Suggested bootstrap rule

Initial runtime scenario id should be resolved in one obvious place:

```ts
const initialScenarioId =
  config.initialAppMode === 'menu'
    ? 'menu-background'
    : config.requestedScenarioId
```

Then `createInitialAppRuntimeState` should create runtime state from that id instead of from `config.initialScenario`.

### Recommended helper

Add a helper in the scenario layer so bootstrap loads by id instead of by prebuilt object:

```ts
createRuntimeScenarioStateFromId(scenarioId, options)
```

or:

```ts
loadRuntimeScenarioState({ scenarioId, options })
```

This keeps bootstrap code from needing to know how scenarios are materialized.

### Acceptance criteria

- `AppConfigContext` no longer contains `RuntimeScenario`
- menu startup no longer creates a throwaway requested scenario first
- `createAppConfigContext.ts` no longer imports scenario-loading code
- no gameplay behavior changes

## Step 2

### Goal

Give scenario lifecycle one explicit owner after bootstrap.

That owner should handle:

- initial scenario load
- enter main menu background
- start free roam
- start tutorial
- reset scenario
- load debug snapshot
- restart from checkpoint fallback behavior
- shared post-load cleanup

### New file

- `src/runtime/createScenarioRuntimeController.ts`

Exact file name can differ, but it should be runtime-owned rather than config-owned.

### Responsibilities

This controller should:

- load scenario state by id
- apply loaded scenario state into `AppRuntimeState`
- keep explicit reset target state instead of hidden `activeScenarioId`
- clear transient runtime fields after scenario transitions
- sync scenario directives after transitions
- apply menu-only overrides such as infinite label intro and 500x warp
- optionally load snapshot state through the same transition surface

### Suggested shape

```ts
type ScenarioRuntimeController = {
  getResetScenarioId(): string
  initializeFromStartup(): void
  enterMainMenuBackground(): void
  startFreeRoam(): void
  startTutorial(): void
  resetScenario(): void
  loadDebugSnapshot(): boolean
  restartFromCheckpoint(): boolean
}
```

The exact API can differ. The important part is that `runtimeActions` stops owning hidden scenario lifecycle state.

### Ownership rule

`runtimeActions` should remain about player/runtime mutations such as:

- zoom
- heading selection
- debug toggles
- time warp changes
- prompt acknowledgement

Scenario transitions should either move out of `runtimeActions` entirely or `runtimeActions` should delegate them to the controller.

### Why this is the next real cleanup

Without this step, scenario loading still lives in two places:

- bootstrap
- `runtimeActions`

And reset behavior still depends on closure-local state instead of an explicit scenario lifecycle model.

## Step 3

### Goal

Remove bootstrap scenario metadata from the UI layer.

### Changes

- stop passing `config.initialScenario.name/description` into UI/presentation
- remove unused `scenarioName` and `scenarioDescription` props from `createOverlayUi`
- give the scenario layer a lightweight metadata lookup for active scenario presentation

### Recommended direction

Add lightweight metadata access in the scenario layer, separate from full scenario creation.

Examples:

- `getRuntimeScenarioMetadata(scenarioId)`
- or static `title` / `description` fields on `RuntimeScenarioDefinition`

Then HUD fallback content can follow the active runtime scenario rather than the bootstrap scenario.

### Note on debug snapshots

Debug snapshots are the one case where display metadata may be dynamic.

Do not force the UI layer to recreate full scenario state just to get labels. If needed, use a simple fallback title/description for snapshot-backed loads, or add an explicit runtime-owned display metadata field during scenario transitions.

## Recommended implementation order

1. remove `initialScenario` from `AppConfigContext`
2. add scenario-state creation by id and switch initial runtime creation to use it
3. add tests for menu startup vs direct scenario startup
4. extract a scenario runtime controller and move transition ownership there
5. make `runtimeActions` delegate scenario transitions or stop owning them
6. remove bootstrap scenario metadata from HUD/overlay wiring

## Test plan

Add or update tests for:

- `createInitialAppRuntimeState` boots `menu-background` when `initialAppMode === 'menu'`
- `createInitialAppRuntimeState` boots the requested scenario in game mode
- resetting the scenario uses the explicit reset target after free roam/tutorial transitions
- entering the main menu switches to `menu-background`
- loading a debug snapshot does not leave reset behavior ambiguous
- HUD fallback metadata comes from active runtime scenario metadata, not bootstrap config

## Non-goals

Do not combine this with:

- frame loop redesign
- high-level action redesign
- gameplay rule changes
- splitting all of `AppRuntimeState` in the same pass

## Open questions

- Should the explicit reset target live in `AppRuntimeState`, or in controller-owned state?
- Should debug snapshot loading update the reset target, preserve the prior one, or make that behavior explicit in the API?
- Should active scenario display metadata live in runtime state, or be derived on demand from scenario/session data?

## Status

Promising
