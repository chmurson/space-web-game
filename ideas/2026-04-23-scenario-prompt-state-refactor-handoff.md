# Scenario prompt state refactor handoff

## Context

The current scenario prompt system works, but the ownership boundary is still awkward.

Today prompt-related behavior is split across several callbacks and helper paths:

- `getActivePrompt`
- `getPromptContent`
- `getReplayPromptContent`
- `reopenPrompt`
- `acknowledgePrompt`
- `getHudContent`

That creates two problems:

- scenario guidance is expressed through multiple overlapping APIs instead of one coherent model
- prompt rendering and prompt orchestration are coupled to scenario-specific callback shape

There is also one dead path worth cleaning up as part of this redesign:

- `getHudContent` is still called from `src/presentation/hudPresentation.ts`
- but its values are written into `overlayUi.hudTitle` / `overlayUi.hudDescription`
- those refs are always `null` because `src/ui/overlayUI/createOverlayUi.ts` creates an empty `hud` container with no `h1` or `p`

So prompt/HUD responsibilities should be clarified before more scenario guidance work lands in tutorial.

## Problem statement

The main issue is not only API count. The deeper issue is that the current system mixes three different concepts:

- durable scenario-owned prompt state
- prompt definitions and prompt copy
- resolved UI-ready prompt state

That leads to several implementation smells:

- replay behavior is modeled as scenario-specific reopen logic instead of generic prompt UI state
- prompt content is partly resolved in scenario helpers and partly in presenter code
- scenario definitions must expose callback shapes that reflect current UI plumbing instead of prompt semantics
- app-level prompt actions like `start-free-roam` and `exit-to-menu` still leak through special cases
- tutorial phase logic and prompt logic remain intertwined in `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

The target refactor should make prompts feel like one system with one read path and one write path.

## Proposal

Redesign scenario prompts around three layers:

### 1. Prompt definitions

Prompt definitions live next to the scenario definition and contain the real prompt copy plus presentation metadata.

Suggested shape:

```ts
type PromptButtonDefinition = {
  label: string
  tone: 'primary' | 'secondary' | 'tertiary'
  action: PromptAction
}

type PromptAction =
  | {
      kind: 'builtin'
      id:
        | 'dismiss'
        | 'dismiss_to_replay'
        | 'start_free_roam'
        | 'exit_to_menu'
    }
  | {
      kind: 'scenario'
      id: string
    }

type PromptDefinition = {
  id: string
  title: string
  shortLabel?: string
  description: string
  buttons: PromptButtonDefinition[]
  presentation:
    | { kind: 'blocking' }
    | { kind: 'coach'; anchor: AnchorableUIElements }
}
```

Notes:

- `shortLabel` is optional and is used for the replay pill
- replay label should resolve as `shortLabel ?? title`
- prompt content should not be duplicated into runtime state

### 2. Scenario-owned prompt UI state

The runtime should store only durable prompt bookkeeping.

Suggested shape:

```ts
type ScenarioPromptUiState = {
  activePromptId: string | null
  replayPromptId: string | null
}
```

Recommended location:

- store `promptUi` inside `runtime.scenario.session`
- do not bury it inside each scenario's own phase payload

Suggested session direction:

```ts
type RuntimeScenarioSession<TState> = {
  scenarioId: string
  state: TState
  promptUi: ScenarioPromptUiState
  checkpoint: RuntimeScenarioCheckpoint | null
  completed: boolean
}
```

This keeps prompt bookkeeping scenario-owned and durable without forcing every scenario state type to repeat the same fields.

### 3. Resolved prompt state

The UI should consume one derived prompt model that is not persisted.

Suggested shape:

```ts
type ResolvedPromptState = {
  active:
    | null
    | ({
        id: string
        title: string
        description: string
        buttons: Array<{
          label: string
          tone: 'primary' | 'secondary' | 'tertiary'
          action: PromptAction
        }>
      } & (
        | { kind: 'blocking' }
        | { kind: 'coach'; anchor: AnchorableUIElements }
      ))
  replay:
    | null
    | {
        id: string
        label: string
      }
}
```

This should be resolved on demand from:

- runtime session prompt state
- active scenario definition
- input mode if coach prompt copy or anchors depend on it

## Resolver boundary

Add a dedicated scenario-level prompt module that owns prompt resolution and prompt action dispatch.

Suggested file:

- `src/scenario/scenarioPrompts.ts`

Suggested exports:

```ts
resolveScenarioPrompts(
  runtime: AppRuntimeState,
  inputMode: 'desktop' | 'mobile',
): ResolvedPromptState

dispatchScenarioPromptAction(
  runtime: AppRuntimeState,
  action: PromptAction,
): {
  handled: boolean
  effect?: 'start-free-roam' | 'exit-to-menu'
  transition?: ScenarioRuntimeTransition | null
}
```

Why this boundary:

- it has access to `runtime.scenario.session`
- it can look up prompt definitions from the current scenario definition
- it keeps presenters dumb
- it avoids storing rendered prompt content in mutable runtime state

## Ownership rules

### Scenario definition owns

- prompt definitions
- which prompt ids become active or replayable
- scenario-specific prompt actions
- scenario progression after prompt actions

### Generic prompt system owns

- resolving active and replay prompt data for rendering
- built-in actions such as dismissing a prompt
- replay pill label fallback (`shortLabel ?? title`)
- keeping replay/open plumbing out of per-scenario callback clutter

### Presenter/UI layer owns

- modal vs coach rendering
- anchored positioning
- button DOM updates
- replay pill visibility

## Important design choice

Do not make `close and show next` a generic built-in action.

Reason:

- “show next” is scenario logic
- the generic prompt layer can dismiss the current prompt
- the scenario should decide whether that exposes another prompt, leaves replay state behind, or advances progression

Generic prompt plumbing should not invent scenario flow.

## Summary/HUD scope

Keep summary/HUD cleanup separate from the prompt refactor for now.

Reason:

- the current `getHudContent` path is effectively inert and can be removed later
- prompt state redesign is already a clear bounded refactor
- forcing prompt and summary redesign into one pass would widen scope unnecessarily

That means this refactor should target prompts first and leave one follow-up choice:

- either delete `getHudContent`
- or replace it with a separate summary resolver if a real summary surface comes back

## Concrete target architecture

The scenario definition API should move toward something like:

```ts
type RuntimeScenarioDefinition<TState extends ScenarioSessionValue> = {
  id: string
  createScenario(): RuntimeScenario
  prompts?: Record<string, PromptDefinition>
  getPromptUiState?(
    runtime: AppRuntimeState,
  ): ScenarioPromptUiState
  advance?(runtime: AppRuntimeState): ScenarioRuntimeTransition<TState> | null
  handleScenarioPromptAction?(
    runtime: AppRuntimeState,
    actionId: string,
  ): ScenarioPromptAcknowledgeResult<TState>
  getDirectiveOverrides?(
    state: TState,
    limits: GlobalScenarioDirectiveLimits,
  ): Partial<RuntimeScenarioDirectives>
  isState?(value: unknown): value is TState
  shouldAutoRestartOnCrash?(runtime: AppRuntimeState): boolean
}
```

Exact names can change, but the intended outcome is:

- prompt definitions are data, not ad hoc callback branches
- prompt state is stored explicitly
- prompt action dispatch uses one path
- replay behavior no longer depends on `reopenPrompt`

## Concrete refactor targets

Files likely to change:

- `src/scenario/scenarioRegistry.ts`
- `src/scenario/scenarioSession.ts`
- `src/scenario/scenarioRuntimeTransition.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/runtime/runtimeActions.ts`
- `src/presentation/hudPresentation.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/app/createAppComponents.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- tutorial onboarding prompt helpers if they currently return prompt-shaped UI copy directly

Likely new files:

- `src/scenario/scenarioPrompts.ts`
- `tests/scenario/scenarioPrompts.test.ts`

## Suggested phases

### Phase 1: introduce prompt data types and session prompt UI state

Goal:

- make prompt state explicit without changing visible behavior yet

Acceptance criteria:

- `ScenarioPromptUiState` exists
- scenario session can store prompt UI state
- prompt ids are durable state instead of being inferred from scattered fields only

### Phase 2: add prompt definitions and a central resolver

Goal:

- create one read path for prompt rendering

Acceptance criteria:

- `resolveScenarioPrompts(...)` exists
- UI prompt components consume resolved prompt state instead of old registry helpers
- replay label resolves from `shortLabel ?? title`

### Phase 3: add centralized prompt action dispatch

Goal:

- create one write path for prompt button actions

Acceptance criteria:

- built-in actions are handled in one place
- scenario-specific actions dispatch through the active scenario definition
- `reopenPrompt` callback is removed

### Phase 4: migrate tutorial to the new model

Goal:

- prove the architecture against the most complex scenario

Acceptance criteria:

- tutorial prompt definitions live as data near the tutorial scenario
- tutorial prompt state uses prompt ids instead of custom prompt fields where possible
- tutorial no longer needs `getPromptContent`, `getReplayPromptContent`, or `reopenPrompt`

### Phase 5: remove legacy prompt APIs

Goal:

- finish the migration and simplify the scenario contract

Acceptance criteria:

- `getActivePrompt` fallback over legacy prompt helpers is removed
- legacy prompt content helpers are deleted
- prompt UI renderers read only the resolved prompt model

## Testing strategy

Priority coverage:

- active blocking prompt resolves from `activePromptId`
- coach prompt resolves anchor correctly
- replay pill resolves `shortLabel` first and falls back to `title`
- built-in `dismiss` clears active prompt without forcing replay
- built-in `dismiss_to_replay` clears active prompt and sets replay prompt id
- built-in `start_free_roam` and `exit_to_menu` still return app-level effects
- scenario-specific prompt action dispatch reaches the active scenario definition
- tutorial still supports:
  - first intro prompt
  - onboarding coach prompts
  - replaying a previously dismissed prompt
  - completion prompt actions

Verification commands after implementation:

- `npm test`
- `npm run build`

## Migration notes

- Migrate tutorial first. It is the best pressure test because it uses:
  - blocking prompts
  - coach prompts
  - replay behavior
  - prompt-driven progression
- Avoid redesigning summary/HUD in the same pass.
- Avoid storing resolved prompt strings in runtime state.
- Keep app-level navigation effects (`start_free_roam`, `exit_to_menu`) separate from pure scenario state transitions, even if both are triggered from prompt buttons.

## Open questions

- Should coach prompt descriptions remain fully static data, or should prompt definitions support small runtime-derived formatters when copy needs live values?
- Should prompt definitions live directly on `RuntimeScenarioDefinition`, or under a dedicated `promptCatalog` field to keep the contract visually tidy?
- Should `promptUi` be added directly to `RuntimeScenarioSession`, or nested under a more general `ui` field in case future durable scenario-owned UI state appears?

## Status

Promising. Ready for a bounded architecture pass, with tutorial as the first migration target.
