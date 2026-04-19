# createGameApp init/runtime refactor plan

## Context

`src/app/createGameApp.ts` currently mixes several responsibilities:

- reading config and URL params
- creating the initial runtime state
- creating Three.js, UI, input, query, and presentation components
- wiring high-level actions and UI events
- starting the runtime loop

That makes init order hard to reason about because config, mutable state, constructed components, and runtime orchestration are all created in one place and often close over each other.

The target shape is:

1. init config phase
2. init initial state phase
3. init all components
4. start frame loop

The main goal of the first refactor pass is not to redesign gameplay logic. It is to separate setup phases cleanly so later runtime simplification becomes safer.

## Proposal

Do the refactor in three behavior-preserving phases:

1. extract an immutable app config context
2. extract initial mutable runtime state creation
3. extract component construction and wiring into a dedicated factory

After these three phases, `createGameApp` should become a small orchestrator that reads roughly like:

```ts
export const createGameApp = (app: HTMLDivElement) => {
  const config = createAppConfigContext()
  const runtimeState = createInitialAppRuntimeState(config)
  const components = createAppComponents({ app, config, runtimeState })

  components.initialize()
  components.start()
}
```

The exact method names can differ. The important part is the boundary between config, state, components, and runtime start.

## Phase 1

### Goal

Extract everything in `createGameApp` that is configuration or startup selection data into one immutable object.

### New file

- `src/app/createAppConfigContext.ts`

### Inputs

- `window.location.search`
- `gameConfig`
- user settings from `readUserSettings()`

### Outputs

Create a type and factory similar to:

```ts
export type AppConfigContext = {
  initialAppMode: 'menu' | 'game'
  requestedEngine: string
  physicsEngine: PhysicsEngine
  requestedScenarioId: string
  initialScenario: RuntimeScenario
  userSettings: {
    debugModeEnabled: boolean
  }
  controls: {
    timeWarps: number[]
    autopilotRotationRate: number
  }
  assistTarget: {
    autoSelectNearestSurface: boolean
    switchRangeMultiplier: number
  }
  trajectory: {
    defaultCoastPredictionHorizonHours: number
    minCoastPredictionHorizonHours: number
    maxCoastPredictionHorizonHours: number
    predictionSampling: TrajectoryPredictionSamplingConfig
    maxPredictionLoopRevolutions: number
    rendering: ...
  }
  camera: {
    distance: number
    elevation: number
    defaultViewport: number
    minViewport: number
    maxViewport: number
    spacecraftModelZoomThreshold: number
  }
  runtimeScenarioOptions: RuntimeScenarioOptions
  globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
}
```

The object does not need to be nested exactly like this. The important part is that it is:

- immutable after creation
- free of DOM refs
- free of runtime mutable state
- complete enough that later phases stop reading `gameConfig` and URL params directly inside `createGameApp`

### What moves out of `createGameApp`

Move the logic currently around:

- URL param parsing
- initial app mode selection
- engine selection
- scenario selection
- user settings lookup
- time warp and assist config extraction
- camera and trajectory tuning extraction
- `runtimeScenarioOptions`
- `globalScenarioDirectiveLimits`

Most of this currently lives near the top of `src/app/createGameApp.ts`.

### What stays in `createGameApp` for now

- `app` DOM root
- the mutable `appMode` setter state, unless moved in phase 3
- actual component creation
- event listeners
- frame loop start

### Acceptance criteria

- `createGameApp` no longer reads `gameConfig` directly
- `createGameApp` no longer parses URL params directly
- `createGameApp` gets all startup choices from `config`
- no behavior changes

### Risks

- over-designing the config shape too early
- including mutable runtime data by accident

### Guardrails

- keep the first config type narrow and practical
- prefer copying scalar values over exposing whole source objects unless the whole object is actually stable config

## Phase 2

### Goal

Extract creation of `AppRuntimeState` into one dedicated factory that depends only on config and initial scenario state.

### New file

- `src/app/createInitialAppRuntimeState.ts`

### Inputs

- `AppConfigContext`

### Outputs

Create a type-safe factory:

```ts
export const createInitialAppRuntimeState = (
  config: AppConfigContext,
): AppRuntimeState => { ... }
```

### Responsibilities

This factory should:

- create the initial runtime scenario state with `createRuntimeScenarioState`
- assemble the initial `AppRuntimeState`
- apply initial directive sync before returning, if that remains required

### What moves out of `createGameApp`

Move the logic currently responsible for:

- `createRuntimeScenarioState(...)`
- initial `AppRuntimeState` object creation
- initial `scenarioDirectives`
- initial `spacecraftLabelIntroUntil`
- initial `timeWarpIndex`, `assistMode`, `targetHeading`, and debug flags
- initial `syncRuntimeScenarioDirectives(...)`

### Recommended helper split

If the factory grows, split it into two local helpers inside the same file:

- `createInitialScenarioRuntimeState(config)`
- `createBaseAppRuntimeState(config, initialScenarioState)`

Do not export these helpers unless there is a real non-test caller.

### Acceptance criteria

- `createGameApp` no longer knows how `AppRuntimeState` is assembled
- the initial runtime state can be created from config alone
- directive sync happens in one obvious place
- no behavior changes

### Risks

- mixing truly initial state with runtime reset logic from `runtimeActions`
- duplicating scenario option logic already defined in config

### Guardrails

- keep initial creation separate from reload/reset behavior
- do not widen `AppRuntimeState` API just to make extraction easier

## Phase 3

### Goal

Extract component creation and runtime wiring into a dedicated app component factory so `createGameApp` becomes an orchestrator instead of a long construction script.

### New file

- `src/app/createAppComponents.ts`

### Inputs

- `app: HTMLDivElement`
- `config: AppConfigContext`
- `runtimeState: AppRuntimeState`

### Outputs

Return a structured object that separates constructed refs from startup actions. Example shape:

```ts
export type AppComponents = {
  renderer: THREE.WebGLRenderer
  rendererProfiler: RendererProfiler
  keyboardInput: KeyboardInput
  gameScene: GameSceneRefs
  overlayUi: OverlayUi
  queries: GameQueries
  runtimeActions: RuntimeActions
  trajectoryPredictionRuntime: TrajectoryPredictionRuntime
  trajectoryPresentation: TrajectoryPresentation
  hudPresentation: HudPresentation
  mainMenu: MainMenu
  topMenu: TopMenu
  crashMenu: CrashMenu
  frameLoop: FrameLoop
  initialize(): void
  start(): void
}
```

This does not have to be the exact final public shape. The key is to stop leaving half-initialized local variables in `createGameApp`.

### Internal sub-phases inside `createAppComponents`

Recommended creation order:

1. low-level engine and input primitives
2. scene and prediction runtime
3. query/runtime action layer
4. UI and presentation layer
5. frame loop
6. event wiring
7. startup mode application

### Concrete extraction targets

Move these groups out of `createGameApp`:

- renderer creation
- renderer profiler creation
- keyboard input creation
- scene creation
- trajectory prediction runtime creation
- ripple array creation
- overlay UI creation
- game query creation
- runtime actions creation
- top menu creation
- touch controls creation
- HUD creation
- pointer camera binding
- main menu creation
- frame loop creation
- crash menu creation
- keyboard shortcut binding
- overlay prompt listeners
- high-level action registration
- initial menu vs game startup branch

### Important design rule

Do not let `createAppComponents` hide runtime transitions in arbitrary event closures.

Instead, introduce one small runtime coordinator object inside this phase or in a follow-up file. That coordinator should own:

- current `appMode`
- `setAppMode`
- `dispatchRuntimeAction`
- high-level action dispatch registration
- startup transition into menu or game

That will reduce the current cross-closure coupling between:

- `frameLoop`
- `runtimeActions`
- `topMenu`
- `crashMenu`
- `mainMenu`
- `appMode`

### Suggested file split if phase 3 becomes too large

If `createAppComponents.ts` still becomes too dense, split into:

- `src/app/createAppComponents.ts`
- `src/app/createAppRuntimeCoordinator.ts`

Where:

- `createAppComponents` builds refs
- `createAppRuntimeCoordinator` wires behavior and startup flow

### Acceptance criteria

- `createGameApp` becomes short and phase-oriented
- no `let topMenu`, `let crashMenu`, `let frameLoop` placeholders remain in `createGameApp`
- runtime wiring is localized instead of spread across `createGameApp`
- init order is explicit and documented in code by the factory structure
- no behavior changes

### Risks

- creating a giant `createAppComponents` file that just relocates complexity
- introducing circular dependencies between component factory and runtime coordinator
- accidentally changing startup order for menu mode vs scenario mode

### Guardrails

- prefer one directional flow: config -> runtime state -> components -> start
- keep `frameLoop` as a runtime consumer, not the owner of app initialization
- do not mix reset/reload logic into component construction

## Recommended implementation order

Implement in this order:

1. create `createAppConfigContext.ts` and switch `createGameApp` to use it
2. create `createInitialAppRuntimeState.ts` and switch `createGameApp` to use it
3. create `createAppComponents.ts` and move pure construction only
4. move event wiring and startup branching into the same file or into `createAppRuntimeCoordinator.ts`
5. reduce `createGameApp` to orchestration only

Commit after each step if the diff stays behavior-preserving.

## Non-goals for this pass

Do not do these in the same refactor unless needed to keep the code compiling:

- redesign the frame loop algorithm
- redesign `runtimeActions`
- redesign the high-level action mediator
- change gameplay rules
- split `AppRuntimeState` into multiple runtime objects

Those can come after the init/runtime boundaries are cleaner.

## Follow-up opportunities after phases 1-3

Once phases 1-3 are done, the next safe cleanup steps are:

- split `frameLoop` into explicit update and render helpers
- extract a dedicated runtime state mutation layer from `runtimeActions`
- decide whether `AppRuntimeState` should later become `runtimeState + uiState + scenarioState`
- decide whether high-level actions should become plain functions instead of mediator registration

## Open questions

- Should `appMode` remain a small mutable local in the coordinator, or move into a dedicated app-level state object?
- Should `readUserSettings()` stay in config creation, or move to a higher bootstrap layer later?
- Is `syncRuntimeScenarioDirectives()` conceptually part of initial state creation, runtime update, or both?
- Should `keyboardInput` be considered a component dependency or part of runtime state?

## Status

Resolved.


The main refactor described here has landed. `createGameApp` now acts as a small orchestrator over config creation, initial runtime state creation, component construction, initialization, and start.

Some cleanup opportunities still remain, but they are follow-up improvements rather than open work for this refactor plan.
