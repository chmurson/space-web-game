# Runtime scenario transition reducer plan

## Context

`ideas/resolved/2026-04-19-runtime-scenario-advance-directive-merge-plan.md` already improved ownership by moving scenario advancement and directive syncing behind `updateRuntimeScenario(...)`.

That cleanup helped, but one deeper structural issue remains:

- scenario code can still mutate `runtime` directly
- tutorial flow writes `runtime.scenario.session = ...` in many places
- directive recomputation is still tied to runtime bookkeeping instead of explicit scenario transitions

So the main problem is not only that directives are recomputed too often. The bigger problem is that scenario state changes are hard to follow because the write path is spread across scenario code and runtime code.

## Main idea

Move scenario progression toward a reducer/state-machine shape:

- scenario code should describe a transition
- runtime code should apply that transition centrally
- directives should be recomputed as part of central reconciliation, not as ad hoc side effects

This is a braver change than adding a dirty flag, but it gives stronger structural benefits:

- fewer hidden side effects
- one place that owns scenario session writes
- one place that owns directive refresh and constraint application
- easier testing because transitions become more explicit
- a cleaner path for future prompt, HUD, checkpoint, and analytics work

## Proposal

Change scenario APIs so they return transition data instead of mutating `runtime` directly.

Today the model is roughly:

```ts
definition.advance?.(runtime)
definition.acknowledgePrompt?.(runtime)
definition.reopenPrompt?.(runtime)
```

The target shape is closer to:

```ts
type ScenarioRuntimeTransition = {
  nextSession?: RuntimeScenarioSession
  checkpoint?: RuntimeScenarioCheckpoint | null
  completed?: boolean
}

type RuntimeScenarioDefinition = {
  advance?(runtime: AppRuntimeState): ScenarioRuntimeTransition | null
  acknowledgePrompt?(
    runtime: AppRuntimeState,
  ): PromptAcknowledgeResult & { transition?: ScenarioRuntimeTransition | null }
  reopenPrompt?(runtime: AppRuntimeState): ScenarioRuntimeTransition | null
}
```

The exact type names can differ. The important point is:

- scenario definitions stop performing the final write themselves
- runtime owns applying `nextSession`
- runtime immediately reconciles directives after applying a returned transition

## Why this is better than a dirty flag

A dirty flag solves the performance symptom, but it still leaves the architecture loose:

- scenario code still mutates runtime directly
- directive refresh still depends on remembering bookkeeping
- tests still need to inspect side effects after imperative calls

The reducer-style approach fixes the more important boundary:

- scenario logic decides what changed
- runtime decides how that change is committed

That means invalidation becomes implicit in the central write path. If a transition returns a new session, runtime can always recompute directives there. No extra remembering is needed.

## Scope recommendation

Do not try to convert the whole scenario system at once.

Recommended first scope:

1. Convert tutorial scenario transition paths:
   - `advance`
   - `acknowledgePrompt`
   - `reopenPrompt`

2. Keep scenario creation and transition/reset logic as they are.

3. Keep directive resolver logic as it is.

4. Only change how scenario-driven session updates are produced and applied.

This gives most of the structural benefit while keeping the refactor local.

## Suggested runtime ownership model

Add one central runtime helper that applies a scenario transition.

Suggested responsibilities:

- write `runtime.scenario.session`
- update `runtime.scenario.session.completed` if needed
- update checkpoint if transition carries checkpoint data
- recompute directives
- apply directive constraints

Possible shape:

```ts
export const applyScenarioRuntimeTransition = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
  transition: ScenarioRuntimeTransition | null,
) => {
  if (!transition) {
    return
  }

  if (transition.nextSession) {
    runtime.scenario.session = transition.nextSession
  }

  if (typeof transition.completed === 'boolean') {
    runtime.scenario.session.completed = transition.completed
  }

  syncRuntimeScenarioDirectives(runtime, limits)
}
```

This helper can start small and expand only if checkpoint or other metadata needs to move through the same path.

## Frame-loop target shape

The frame loop can stay simple:

```ts
if (!hasBlockingPrompt) {
  stepSimulationFrame(...)
}

updateRuntimeScenario(runtime, limits, {
  shouldAdvance: !hasBlockingPrompt,
})
```

But internally `updateRuntimeScenario(...)` should stop assuming `advance(...)` mutates runtime directly.

Instead:

```ts
const transition = shouldAdvance
  ? getRuntimeScenarioDefinition(... )?.advance?.(runtime) ?? null
  : null

applyScenarioRuntimeTransition(runtime, limits, transition)
```

This keeps frame-loop ownership clean while improving the contract under it.

## Tutorial migration strategy

The tutorial is the main case that matters because it currently contains the richest scenario state transitions.

Recommended approach:

### 1. Extract transition builders

Inside `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`, convert imperative blocks that currently do:

```ts
runtime.scenario.session = {
  ...runtime.scenario.session,
  state: ...
}
```

into local helpers that return:

```ts
ScenarioRuntimeTransition
```

This can be done one branch at a time.

### 2. Convert public scenario entry points

Update tutorial:

- `advanceTutorialScenario`
- prompt acknowledgement handling
- prompt reopen handling

so they return transitions instead of committing writes directly.

### 3. Apply transitions centrally

Update runtime call sites so they:

- call the scenario definition
- receive transition data
- apply it with the central runtime helper

### 4. Remove remaining direct session writes from tutorial scenario logic

The goal is that tutorial scenario code computes transitions but does not directly assign to `runtime.scenario.session`.

## Suggested implementation order

### 1. Introduce transition type and central apply helper

Files:

- `src/scenario/scenarioRegistry.ts`
- `src/scenario/scenarioDirectives.ts` or a dedicated scenario-runtime module
- `src/runtime/runtimeActions.ts`

Changes:

- add a shared transition type
- add central `applyScenarioRuntimeTransition(...)`
- update prompt action paths to apply returned transitions

### 2. Teach `updateRuntimeScenario(...)` to consume returned transitions

Files:

- `src/scenario/scenarioDirectives.ts`
- `src/runtime/frameLoop.ts` only if call shape changes

Changes:

- `advance(...)` returns transition data
- `updateRuntimeScenario(...)` applies that data centrally

### 3. Migrate tutorial scenario branches

File:

- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

Changes:

- replace direct `runtime.scenario.session` writes with returned transitions
- keep behavior the same

### 4. Clean up follow-up API debt

Files:

- whichever runtime/scenario files still assume mutation-only semantics

Changes:

- remove obsolete helper paths
- tighten tests around explicit transition outputs

## Verification

### Unit tests

1. `src/scenario/scenarioDirectives.test.ts`

- `updateRuntimeScenario(...)` applies a returned transition and syncs directives
- no-transition path leaves session and directives unchanged

2. `src/runtime/runtimeActions.test.ts`

- prompt acknowledgement applies returned transition and leaves directives coherent immediately
- prompt reopen applies returned transition and leaves directives coherent immediately

3. `src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`

- tutorial `advance` returns the expected transition for a phase/onboarding change
- tutorial prompt acknowledgement returns the expected next session state

### Manual checks

- tutorial onboarding still hides and reveals UI at the right moments
- tutorial phase progression still updates forced assist target / hidden bodies / viewport caps correctly
- prompt confirmation still updates scenario-driven UI without a stale frame
- no prompt-gated frame accidentally advances the scenario

## Tradeoffs

- this is a bigger refactor than a dirty-flag solution
- temporary mixed patterns may exist during migration
- transition types can become too wide if they try to solve every future concern at once

To keep this healthy:

- keep the first transition type narrow
- move only session/checkpoint/completed concerns first
- avoid turning the transition object into a generic dumping ground

## Open questions

- Should prompt-related return types embed transition data, or should prompt handlers return a separate structured object?
- Should checkpoint updates be included in the first transition type, or handled in a follow-up pass?
- Should directive syncing stay inside `applyScenarioRuntimeTransition(...)`, or should the helper return whether reconciliation is needed?
- Is it worth adding a small pure helper layer in tutorial scenario code so returned transitions are easy to snapshot-test?

## Status

Implemented.

## Plain-language summary

The ambitious version is to stop letting scenario code secretly rewrite runtime state. Instead, scenarios should report "here is the next session state" and runtime should apply that in one central place. That makes the code easier to follow, removes manual directive-refresh bookkeeping, and gives a better foundation for future scenario complexity.
