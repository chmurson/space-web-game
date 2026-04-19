# Runtime state ownership refactor handoff

## Context

The current runtime/scenario flow works, but it concentrates too much responsibility in a few mutable paths:

- `src/runtime/frameLoop.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

The main problem is not file size by itself. The bigger problem is that runtime state is mutated from several directions, with important invariants enforced only by convention:

- scenario/session updates happen in more than one place
- directive recomputation is a separate concern that callers must remember to trigger
- scenario session state is generic JSON-like data at runtime
- some scenario code still depends on casts or ad hoc key lookups

That makes the system harder to read and easier to break when adding new scenarios, prompts, or runtime actions.

This note turns that concern into a concrete refactor handoff for another model or follow-up pass.

## Problem statement

Today the code has three structural weaknesses:

### 1. Runtime writes are too scattered

Examples:

- `frameLoop` writes simulation outputs back into `runtime`
- `runtimeActions` toggles many runtime fields directly
- `createScenarioRuntimeController` applies scenario loads directly
- `restoreRuntimeFromScenarioCheckpoint` mutates `runtime` directly
- scenario reconciliation is split between transition application and directive syncing

The result is that "what is allowed to change runtime state" is not obvious from the structure.

### 2. Scenario state is not strongly typed at the runtime boundary

`src/scenario/scenarioSession.ts` defines `ScenarioSessionValue` as a JSON-like union. That is reasonable for persistence, but weaker than desirable for active runtime logic.

At runtime this leads to patterns like:

- string-key reads in `src/scenario/scenarioDirectives.ts`
- scenario-specific casts in `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

That weakens safety exactly where gameplay rules and UI behavior are derived.

### 3. Runtime invariants are not centrally enforced

Important rules exist, but the code does not give them one clear home:

- after scenario session changes, directives must be reconciled
- after scenario transitions, transient runtime state must be cleared
- after checkpoint restore, runtime must become coherent again
- UI-facing metadata should stay aligned with the active scenario state

Those rules should be enforced by structure, not remembered at each call site.

## Refactor goals

### Primary goals

- make runtime state ownership obvious
- reduce direct writes to `AppRuntimeState`
- move scenario/session reconciliation behind one explicit apply path
- improve type safety for active scenario state
- make future scenario work easier to test and reason about

### Secondary goals

- shrink cognitive load in `frameLoop` and `runtimeActions`
- make tutorial logic read more like a state machine than a mutation script
- prepare the codebase for additional scenarios without growing runtime coupling

### Non-goals

- performance optimization
- gameplay retuning
- UI redesign
- rewriting the full app into a new framework
- replacing all mutable state with a third-party state library

## Target architecture

The intended end state is:

1. Runtime code may still hold mutable state, but writes flow through a smaller number of explicit helpers.
2. Scenario logic computes typed transitions or patches instead of owning final runtime writes.
3. Directive reconciliation happens as part of central scenario apply logic, not as a remembered side effect.
4. Generic JSON-like scenario state is kept at the persistence boundary, while active scenario code works with typed state.
5. `frameLoop` focuses on orchestration, not bookkeeping.

## Recommended implementation strategy

Do this in stages. Do not attempt the whole redesign in one pass.

## Phase 1: carve out a central runtime mutation surface

### Goal

Create a small runtime-owned layer that applies the most important state mutations in one place.

### Changes

- Add a dedicated runtime state helper module.
- Move repeated runtime mutation bundles into named helpers.
- Make existing high-level runtime paths delegate to those helpers instead of assigning fields inline.

### Suggested file

- `src/runtime/runtimeStateTransitions.ts`

### Suggested responsibilities

- apply simulation frame result
- apply scenario load transition
- apply checkpoint restore
- clear transient scenario state
- apply prompt/scenario transition and reconcile directives

### Concrete call sites to migrate first

- `src/runtime/frameLoop.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/scenarioRecovery.ts`

### Acceptance criteria

- direct multi-field writes to `runtime` are reduced in the files above
- repeated write bundles have names instead of being inlined
- directive reconciliation is triggered by the central scenario apply path

## Phase 2: split `AppRuntimeState` into clearer slices

### Goal

Reduce the "one object contains everything" problem without rewriting the entire app.

### Recommended shape

Keep `AppRuntimeState`, but nest it more clearly:

```ts
type AppRuntimeState = {
  simulation: {
    assistMode: AssistMode
    assistTargetIndex: number
    coastPredictionHorizonHours: number
    crashedBodyName: string | null
    state: SimulationState
    targetHeading: number | null
    timeWarpIndex: number
    viewportSize: number
  }
  scenario: {
    activeDescription: string
    activeTitle: string
    directives: RuntimeScenarioDirectives
    session: RuntimeScenarioSession
  }
  ui: {
    spacecraftLabelIntroUntil: number
    targetHeadingSelectionEpoch: number
    uiEffectEpoch: number
  }
  debug: {
    debugModeEnabled: boolean
    debugNoGravityEnabled: boolean
    debugSnapshotStatus: string
    fpsIndicatorEnabled: boolean
    performanceDebugEnabled: boolean
  }
}
```

Exact naming can differ, but the important win is separation by responsibility.

### Why this phase matters

The central mutation layer from Phase 1 helps, but readability will remain limited if every function still accepts a flat structure with unrelated fields mixed together.

### Migration rule

Do this as a compatibility refactor:

- update types first
- add mechanical field-path migrations
- avoid behavior changes in the same commits

### Acceptance criteria

- `AppRuntimeState` structure reflects domain boundaries
- runtime code reads more clearly because field groups communicate intent
- unchanged behavior is protected by existing tests plus targeted updates

## Phase 3: strengthen scenario state typing at the runtime boundary

### Goal

Stop treating active scenario state as generic JSON during core runtime execution.

Detailed handoff:

- see `ideas/2026-04-19-runtime-state-phase-3-scenario-typing-handoff.md`

### Main rule

Keep `ScenarioSessionValue` only where generic persistence or cloning truly needs it. Active scenario APIs should use typed scenario state.

### Changes

- Introduce typed helpers around scenario definition lookup.
- Avoid string-key reads for generic directives where possible.
- Replace broad casts with narrow type-checked access.

### Files to focus on

- `src/scenario/scenarioSession.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

### Recommended approach

1. Keep the generic session container type for serialization compatibility.
2. Add typed accessors per scenario definition.
3. Move generic directive extraction away from ad hoc string keys if those fields are truly common.

If camera-follow and hidden-body data are common runtime concepts, they likely belong in a typed runtime scenario metadata field rather than in loose session keys.

### Acceptance criteria

- tutorial flow no longer needs unsafe casts for ordinary control flow
- directive derivation does not depend on arbitrary string keys where a typed structure would do
- invalid scenario state is rejected closer to the boundary

## Phase 4: turn scenario logic into typed transition producers

### Goal

Scenario code should compute what changed. Runtime code should commit it.

Detailed handoff:

- see `ideas/2026-04-19-runtime-state-phase-4-transition-producers-handoff.md`

### Current direction

There is already partial movement toward transition-based scenario updates. This phase should finish that ownership model and make it the default.

### Desired pattern

Scenario entry points should return typed transition data:

- `advance`
- `acknowledgePrompt`
- `reopenPrompt`

Runtime code should centrally apply:

- next session state
- completion changes
- checkpoint updates
- follow-up directive reconciliation

### Priority scenario

- `tutorial`

It is the richest case and the one most likely to benefit from improved readability.

### Files to focus on

- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/frameLoop.ts`

### Acceptance criteria

- tutorial scenario logic reads as transition selection, not runtime mutation
- runtime owns applying scenario transitions
- scenario-related invariants are enforced in one place

## Phase 5: align UI/runtime metadata ownership

### Goal

Make sure user-facing scenario metadata comes from the active runtime scenario path, not from stale bootstrap assumptions.

### Why include this

This is not the biggest risk, but it is part of the same ownership problem. If scenario runtime ownership becomes explicit, display metadata should follow that ownership too.

### Files to review

- `src/app/createInitialAppRuntimeState.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- HUD-related presentation modules

### Acceptance criteria

- active scenario title/description have one clear runtime owner
- scenario resets, tutorial transitions, and debug snapshot flows keep metadata coherent

## Recommended work order

1. Finish Phase 1 before touching shape-heavy type changes.
2. Do Phase 2 as a mostly mechanical refactor.
3. Do Phase 3 before broad tutorial cleanup so the new scenario code can rely on safer types.
4. Do Phase 4 as the main readability pass.
5. Do Phase 5 last unless metadata issues block earlier work.

## Suggested commit boundaries

Use small commits with clear ownership:

1. add runtime transition/apply helpers and migrate current callers
2. reshape `AppRuntimeState` into nested slices
3. tighten scenario typing and remove loose runtime casts
4. migrate tutorial scenario paths to typed transitions
5. align runtime-owned scenario metadata

That makes review and rollback manageable.

## Test plan

### Keep existing tests green

Important suites already exist around:

- runtime actions
- simulation step
- scenario directives
- tutorial scenario
- tutorial onboarding progress
- startup runtime state

### Add targeted tests during the refactor

1. Central runtime apply helpers

- applying scenario transitions reconciles directives
- applying checkpoint restore leaves runtime coherent
- transient scenario cleanup happens in the right paths

2. Reshaped runtime state

- mechanical updates preserve startup state
- frame stepping still updates the expected fields

3. Scenario typing

- invalid tutorial state is rejected by type guards or boundary helpers
- directive derivation behaves correctly for typed state

4. Tutorial transition flow

- phase advancement still creates checkpoints at the same milestones
- prompt acknowledgement still updates onboarding and prompt state correctly
- completion flow still marks the scenario as complete

### Manual checks

- start free roam
- start tutorial
- dismiss tutorial prompts
- trigger checkpoint recovery after a crash
- load a debug snapshot
- return to main menu

## Risks and guardrails

### Risk: over-combining the phases

If this is attempted in one pass, the review surface will become too large and regressions will hide inside mechanical changes.

### Guardrail

Keep behavioral and structural changes separated whenever possible.

### Risk: replacing one god object with one god helper

A central apply layer is useful, but only if it stays narrow and intention-revealing.

### Guardrail

Prefer a few explicit helpers:

- `applySimulationFrameResult`
- `applyScenarioTransition`
- `applyCheckpointRestore`
- `clearTransientScenarioState`

Do not collapse everything into a single giant reducer unless the shape stays readable.

### Risk: weakening snapshot compatibility

Scenario session serialization may still rely on generic shapes.

### Guardrail

Keep generic serialization compatibility until typed runtime boundaries are in place and tested.

## Open questions

- Should common directive-driving fields such as camera follow and hidden bodies remain inside session state, or move into a typed scenario runtime field?
- Should checkpoint restore remain imperative, or also become a returned transition/effect handled by the central apply layer?
- Should `AppRuntimeState` be fully nested in one pass, or should compatibility aliases be introduced temporarily to reduce churn?
- Should prompt acknowledgement effects such as `start-free-roam` remain separate from scenario transitions, or become part of one richer effect model?

## Deliverable definition

This refactor is complete when:

- runtime ownership is easier to explain in a few sentences
- scenario progression no longer depends on scattered direct writes
- active scenario code relies on typed state more than generic JSON-like state
- the tutorial flow is easier to read end-to-end
- safety and maintainability improve without changing gameplay

## Plain-language summary

The big cleanup is to stop letting many parts of the app change runtime state in their own way. Instead, runtime and scenario updates should go through a smaller number of named, typed paths, so the next person changing tutorial or scenario behavior can understand what happens without tracing field assignments across half the codebase.

## Status

Promising
