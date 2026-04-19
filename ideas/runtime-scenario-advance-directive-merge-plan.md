# Runtime scenario advance/directive merge plan

## Context

The frame loop currently splits scenario runtime work across two separate concerns:

- `advanceRuntimeScenario(runtime)` in `src/scenario/scenarioRegistry.ts`
- `syncRuntimeScenarioDirectives(runtime, limits)` in `src/scenario/scenarioDirectives.ts`

Inside `src/runtime/frameLoop.ts`, directives are synced twice per frame:

1. before prompt lookup and simulation gating
2. again after simulation/scenario advancement

That creates two problems:

- the scenario process is harder to follow than it needs to be
- the duplicate directive sync makes it unclear which call is actually required

At a glance, the current `animate` flow is roughly:

```ts
syncRuntimeScenarioDirectives(...)
const activePrompt = getRuntimeActivePrompt(...)

if (!hasBlockingPrompt) {
  stepSimulationFrame(...)
  advanceRuntimeScenario(...)
}

syncRuntimeScenarioDirectives(...)
render/update presentation
```

## Main suspicion

The split between "advance scenario state" and "recompute directives" is probably too exposed at the frame-loop level.

The frame loop should not need to know:

- when a scenario definition mutates session state
- when directives derived from that state need to be recomputed
- why directives are synced once before prompt gating and again after advancement

That is scenario-runtime bookkeeping and should be owned in one place.

## What looks safe to simplify

Based on the current code, there is only one real advancing scenario path:

- `tutorial` defines `advance`
- `menu-background` does not
- `earth-moon` and `moon-capture-debug` do not

Prompt lookup itself does not depend on directives:

- `getRuntimeActivePrompt(...)` reads scenario state/session
- it does not consume `runtime.scenario.directives`

That means the early directive sync in `animate` is not needed just to decide whether the prompt is blocking.

## Important edge case

Prompt acknowledgement can mutate scenario session state between frames.

Example:

- acknowledging the tutorial intro creates onboarding state
- onboarding changes `hiddenUIElements`

If the first per-frame sync is removed, the system should still ensure that directive changes caused by prompt actions are applied immediately enough for UI state to stay coherent.

Recommended handling:

- sync directives immediately in prompt-related runtime actions after a successful scenario-state mutation
- then keep only one scenario-runtime update call inside `animate`

This keeps the frame loop simpler without depending on a stale-directive frame to repair prompt-side mutations.

## Proposal

Introduce one scenario-runtime update helper that owns:

1. optional scenario advancement
2. directive resolution
3. directive constraint application

Suggested home:

- `src/scenario/scenarioDirectives.ts`

Reason:

- it already depends on `getRuntimeScenarioDefinition(...)`
- moving the merge point there avoids creating a new cross-module coordination surface in `frameLoop`
- importing directive sync into `scenarioRegistry.ts` would create an avoidable coupling in the opposite direction

Suggested shape:

```ts
export const updateRuntimeScenario = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
  options: { shouldAdvance?: boolean } = {},
) => {
  if (options.shouldAdvance ?? true) {
    getRuntimeScenarioDefinition(runtime.scenario.session.scenarioId)
      ?.advance?.(runtime)
  }

  syncRuntimeScenarioDirectives(runtime, limits)
}
```

Exact naming can differ. The important part is that `frameLoop` calls one helper instead of coordinating both steps itself.

## Frame loop target shape

Recommended `animate` flow:

```ts
const activePrompt = getRuntimeActivePrompt(...)
const hasBlockingPrompt = activePrompt?.mode === 'blocking'

if (!hasBlockingPrompt) {
  stepSimulationFrame(...)
}

updateRuntimeScenario(runtime, limits, {
  shouldAdvance: !hasBlockingPrompt,
})

render/update presentation
```

That gives:

- zero duplicate directive syncs in `animate`
- one clear place where scenario state and directives are reconciled
- no separate `advanceRuntimeScenario(...)` call in the frame loop

## Recommended code changes

### 1. Add merged helper

Files:

- `src/scenario/scenarioDirectives.ts`
- optionally remove now-unused `advanceRuntimeScenario` from `src/scenario/scenarioRegistry.ts`

Changes:

- add the single helper that optionally advances and always syncs directives
- keep the existing lower-level directive helpers unchanged unless cleanup becomes obvious

### 2. Simplify `animate`

File:

- `src/runtime/frameLoop.ts`

Changes:

- remove the first `syncRuntimeScenarioDirectives(...)`
- remove the second direct call as well
- replace the current `advanceRuntimeScenario(...)` + explicit sync sequence with one merged helper call

### 3. Sync directives at prompt mutation boundaries

File:

- `src/runtime/runtimeActions.ts`

Changes:

- after a successful `acknowledgeRuntimeScenarioPrompt(...)`, sync scenario directives immediately
- after a successful `reopenRuntimeScenarioPrompt(...)`, sync scenario directives immediately

This is the main guardrail that keeps prompt-driven directive changes from waiting on the next frame-loop reconciliation.

## Things that should not change

- scenario transition/reset logic in `createScenarioRuntimeController.ts`
- startup directive sync in `createInitialAppRuntimeState.ts`
- directive constraint behavior
- prompt content behavior
- tutorial progression rules

This follow-up should be a local cleanup of frame/runtime ownership, not a broader scenario-system redesign.

## Verification

### Unit tests to add or update

1. `src/scenario/scenarioDirectives.test.ts`

Add coverage for the merged helper:

- sync-only path when advancement is disabled
- advance+sync path where tutorial progression changes directives

2. `src/runtime/runtimeActions.test.ts`

Add coverage that prompt acknowledgement updates directives immediately.

Good concrete case:

- tutorial `phase-one-intro` acknowledgement should create onboarding state
- onboarding should immediately update `runtime.scenario.directives.hiddenUIElements`

### Manual behavior check

Verify:

- tutorial prompt dismissal still updates overlay/UI constraints immediately
- tutorial phase progression still switches assist target / hidden bodies / viewport caps correctly
- no prompt-gated frame accidentally advances the scenario

## Acceptance criteria

- `animate` no longer calls `syncRuntimeScenarioDirectives(...)` twice
- frame-loop scenario handling is expressed through one scenario-runtime update call
- prompt acknowledgement/reopen paths leave directives coherent without depending on a second frame-loop sync
- tests cover the merged behavior and the prompt-action edge case
- no gameplay behavior regressions in tutorial progression

## Plain-language summary

The cleanup should move scenario advancement and directive syncing under one small helper so the frame loop stops orchestrating both pieces separately. The only extra care point is prompt actions: if a prompt changes scenario state, directive-derived UI state should be synced right there instead of relying on another per-frame repair pass.
