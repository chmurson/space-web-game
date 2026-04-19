# Runtime state Phase 3 scenario typing handoff

## Context

Phase 1 is about centralizing runtime-owned writes.

Phase 2 is about reshaping `AppRuntimeState` so the main domains are easier to read.

Phase 3 should stay narrower than both of those. Its job is to make active scenario state safer to consume during runtime execution without redesigning the whole scenario system.

Today the main weak spots are concrete:

- `src/scenario/scenarioDirectives.ts` derives common directives from loose root-level session keys like `cameraFollowBodyId`, `cameraFollowOffsetX`, `cameraFollowOffsetY`, `forcedAssistTargetId`, and `hiddenBodyIds`
- `src/scenario/specific-scenarios/menuBackgroundScenario.ts` populates those keys as unstructured session data
- `src/scenario/scenarioRegistry.ts` repeats "look up definition, validate state with `isState`, then call typed hook" in more than one helper
- `src/presentation/hudPresentation.ts` repeats the same validation pattern again for HUD content
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts` still owns its own runtime-state guard and still uses one narrow cast for prompt effects

None of those issues are catastrophic, but together they keep active scenario code closer to "validated JSON blob" than "typed runtime state".

## Goal

Keep generic session serialization compatibility, but make the active runtime boundary typed enough that ordinary scenario logic and UI consumers do not rely on loose key lookups or repeated ad hoc validation.

## Constraints

- keep `ScenarioSessionValue` for persistence/cloning compatibility
- do not redesign transition ownership here; that is Phase 4
- do not widen module APIs only to make tests easier
- do not introduce a large scenario-id-to-type meta-framework
- keep the work compile-driven and mechanical where possible
- preserve current behavior

## Proposed end state

After Phase 3:

- generic session persistence still works exactly as before
- scenarios that need common runtime directive input use one typed nested field instead of loose root keys
- scenario-state validation happens through a small shared helper instead of being repeated by hand in several modules
- prompt, replay-prompt, and HUD readers consume already-validated state
- tutorial runtime control flow has no broad or unnecessary casts

## Design choice: typed common directive input

The simplest useful improvement is to stop treating common directive-driving values as anonymous keys on arbitrary scenario state objects.

Use one typed nested field for that data.

Suggested shape:

```ts
export type RuntimeScenarioDirectiveState = {
  cameraFollowBodyId?: string
  cameraFollowOffset?: {
    x?: number
    y?: number
  }
  forcedAssistTargetId?: string
  hiddenBodyIds?: string[]
}

export type RuntimeScenarioStateWithDirectives = {
  runtimeDirectives?: RuntimeScenarioDirectiveState
}
```

Notes:

- keep this JSON-serializable
- do not move derived `RuntimeScenarioDirectives` into session state
- do not add non-directive concerns here
- prefer `cameraFollowOffset: { x, y }` over separate `cameraFollowOffsetX` and `cameraFollowOffsetY`

This phase does not require every scenario state to extend this type. It only needs scenarios that use the generic directive fallback to do so.

## Design choice: one shared validation helper

Do not build a complicated registry type map keyed by scenario id.

A simpler and safer move is:

1. keep each scenario definition's existing `isState`
2. add one shared helper that validates a raw `ScenarioSessionValue` against a `RuntimeScenarioDefinition<TState>`
3. let the helper return `TState | null`

Suggested direction:

```ts
const getValidatedScenarioState = <TState extends ScenarioSessionValue>(
  definition: RuntimeScenarioDefinition<TState>,
  value: ScenarioSessionValue,
): TState | null
```

It is acceptable if this helper contains one narrow cast after a successful `isState` check. The important rule is to remove repeated casts and repeated `isState` plumbing from call sites.

## Execution plan

### 1. Add the typed common directive input types

Touch first:

- `src/scenario/scenarioSession.ts`

Work:

- keep `ScenarioSessionValue` unchanged
- add `RuntimeScenarioDirectiveState`
- add `RuntimeScenarioStateWithDirectives`
- keep the new types shallow and serializable

Do not:

- replace `RuntimeScenarioSession<TState>`
- remove generic session typing
- move cloning logic into a new module

### 2. Move generic directive reads to the typed nested field

Touch next:

- `src/scenario/scenarioDirectives.ts`

Work:

- replace `getCommonScenarioDirectiveState`
- stop reading directive-driving values directly from arbitrary root-level keys
- read only from `state.runtimeDirectives` when the state matches `RuntimeScenarioStateWithDirectives`
- preserve the current defaults:
  - `cameraFollowBodyId: null`
  - `cameraFollowOffset: { x: 0, y: 0 }`
  - `forcedAssistTargetId: null`
  - `hiddenBodyIds: []`
- keep the merge order exactly the same:
  - default directives
  - generic common directive input
  - scenario-specific `getDirectiveOverrides`

Important:

- do not change directive constraint behavior
- do not change when directive syncing happens

### 3. Update scenarios that rely on the generic directive fallback

Touch next:

- `src/scenario/specific-scenarios/menuBackgroundScenario.ts`
- any tests or fixtures that still build loose directive keys directly into session state

Work:

- migrate menu background session state from loose root keys to `runtimeDirectives`
- update test fixtures that currently create states like:
  - `cameraFollowBodyId`
  - `cameraFollowOffsetX`
  - `cameraFollowOffsetY`
  - `forcedAssistTargetId`
  - `hiddenBodyIds`

Expected affected tests:

- `src/scenario/scenarioDirectives.test.ts`
- `src/runtime/runtimeStateTransitions.test.ts`

Keep scope narrow:

- tutorial directive overrides already come from typed scenario-specific logic and should keep doing so

### 4. Centralize scenario-state validation for registry consumers

Touch next:

- `src/scenario/scenarioRegistry.ts`

Work:

- add a small helper that validates `runtime.scenario.session.state` against a scenario definition
- use that helper in:
  - legacy prompt fallback
  - active prompt helpers where typed state is needed
  - replay prompt helpers

The main win here is not fancy type-level magic. The main win is removing repeated inline validation branches and making the boundary explicit.

### 5. Reuse the validation helper in HUD consumers

Touch next:

- `src/presentation/hudPresentation.ts`

Work:

- stop repeating the `scenarioDefinition.isState(...)` check inline
- use the same shared validation path as the registry helpers
- keep HUD fallback behavior unchanged:
  - use typed scenario HUD content when available
  - otherwise keep `runtime.scenario.activeTitle` and `runtime.scenario.activeDescription`

### 6. Do the tutorial cleanup that belongs in Phase 3, and stop there

Touch next:

- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

Work:

- keep `TutorialScenarioState` as the main active state type
- keep `isTutorialScenarioState`
- keep transition behavior unchanged
- remove the `as PromptActionEffect` cast in prompt acknowledgement
- if a shared helper makes `getTutorialScenarioState` simpler, use it; if not, leave the local guard in place

Do not turn this into Phase 4:

- do not redesign tutorial transitions
- do not move more runtime mutations out of onboarding helpers yet
- do not rewrite the whole file around a new state-machine abstraction

## File impact map

### Required

- `src/scenario/scenarioSession.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/scenario/specific-scenarios/menuBackgroundScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/presentation/hudPresentation.ts`

### Likely test updates

- `src/scenario/scenarioDirectives.test.ts`
- `src/runtime/runtimeStateTransitions.test.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`

## Risks and guardrails

### Risk: over-engineering the registry typing

The repo does not need a complex compile-time map from scenario id to scenario state for this phase.

Guardrail:

- use one small validation helper
- prefer explicit code over type gymnastics

### Risk: mixing common directive input with derived directives

Session state is input. `RuntimeScenarioDirectives` is derived runtime output.

Guardrail:

- keep them separate
- only move loose session keys into a typed nested input field

### Risk: accidentally turning this into tutorial architecture work

Tutorial logic is tempting because it is the richest scenario, but Phase 3 should only improve its runtime typing boundary.

Guardrail:

- remove casts
- improve boundary validation
- leave transition ownership and larger readability work for Phase 4

### Risk: breaking persistence-compatible session shapes too aggressively

Older tests and snapshot-like flows may still assume generic object state.

Guardrail:

- keep `ScenarioSessionValue`
- keep `RuntimeScenarioSession<TState>`
- limit schema changes to the small set of scenarios and fixtures that use generic directive fallback

## Acceptance criteria

Phase 3 is complete when:

- generic directive resolution no longer depends on loose root-level session keys
- menu background scenario state uses a typed nested directive input field
- registry and HUD consumers do not repeat ad hoc `isState` checks inline
- tutorial prompt acknowledgement no longer relies on `as PromptActionEffect`
- invalid session state is rejected close to the scenario-definition boundary
- gameplay behavior is unchanged

## Suggested commit order

1. add typed common directive input types and migrate generic directive resolution
2. migrate menu background scenario state and affected fixtures/tests
3. centralize scenario-state validation in registry helpers and HUD consumers
4. remove remaining tutorial boundary casts and update tests

## Test plan

Run narrow tests during the pass:

```bash
npm run test -- src/scenario/scenarioDirectives.test.ts src/runtime/runtimeStateTransitions.test.ts src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts
```

Then run the full checks:

```bash
npm run test
npm run build
```

## Suggested handoff prompt

Use this if handing Phase 3 to another model:

```text
Implement Phase 3 of the runtime-state ownership refactor: strengthen scenario state typing at the runtime boundary.

Rules:
- Keep the work narrow and behavior-preserving.
- Keep `ScenarioSessionValue` and `RuntimeScenarioSession<TState>` for persistence/cloning compatibility.
- Do not redesign transition ownership or tutorial architecture.
- Do not build a large scenario-id typing framework.

Main tasks:
1. In `src/scenario/scenarioSession.ts`, add typed JSON-safe types for common directive-driving session data, using one nested field such as `runtimeDirectives`.
2. In `src/scenario/scenarioDirectives.ts`, stop reading directive values from loose root-level session keys and instead read from that nested typed field.
3. Update `src/scenario/specific-scenarios/menuBackgroundScenario.ts` and affected tests/fixtures to use the nested typed field.
4. In `src/scenario/scenarioRegistry.ts`, add one small helper that validates raw session state against a scenario definition's `isState`, and use it to remove repeated inline validation logic.
5. Reuse that validation helper in `src/presentation/hudPresentation.ts`.
6. In `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`, remove the prompt-effect cast and keep the rest of the tutorial behavior unchanged.

Important:
- Keep derived `RuntimeScenarioDirectives` separate from session state input.
- Preserve directive merge order and constraint behavior.
- Update tests honestly; do not add compatibility adapters that preserve the loose root-key format.

Run:
- `npm run test -- src/scenario/scenarioDirectives.test.ts src/runtime/runtimeStateTransitions.test.ts src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `npm run test`
- `npm run build`
```

## Status

Planned.
