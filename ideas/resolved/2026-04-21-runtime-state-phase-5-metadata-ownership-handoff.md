# Runtime state Phase 5 metadata ownership handoff

## Relevance check

Phase 5 is still relevant, but it is now a smaller cleanup than the earlier phases.

The current code is already better than the original state:

- startup runtime state gets scenario title/description from the same initial transition path
- scenario resets and scenario loads update the runtime metadata fields through `applyScenarioLoadTransition`
- HUD fallback reads `runtime.scenario.activeTitle` and `runtime.scenario.activeDescription`
- debug snapshot loads also populate those runtime fields

So the app is not broken here.

The remaining issue is ownership clarity:

- runtime still stores title and description as separate scalar fields
- scenario load transitions also carry those same values
- the metadata has no dedicated type or explicit home beyond "two strings on the scenario slice"
- startup, normal scenario loads, and debug snapshot loads all participate, but the ownership story is still spread across those paths

Phase 5 should finish that cleanup and make the metadata source explicit.

## Goal

Give active scenario metadata one clear runtime owner and one clear load/apply path.

In practice, that means:

- make scenario metadata a named object, not two loose fields
- keep startup, reset, tutorial start, free-roam start, and debug-snapshot load on the same metadata path
- make HUD fallback read from that one runtime-owned metadata object

## Constraints

- keep behavior unchanged
- do not redesign scenario HUD override logic
- do not mix in Phase 4 transition work
- do not add metadata caches in multiple modules
- keep debug snapshot behavior intact
- keep the refactor mechanical where possible

## Main design decision

Do not remove runtime-owned scenario metadata entirely in this phase.

That would force a new metadata lookup path for every render and would complicate dynamic cases like debug snapshots.

Instead:

- keep runtime as the owner of the active loaded metadata
- make that ownership explicit with a dedicated type and field

Recommended shape:

```ts
export type RuntimeScenarioMetadata = {
  description: string
  title: string
}

export type AppRuntimeScenarioSlice = {
  directives: RuntimeScenarioDirectives
  metadata: RuntimeScenarioMetadata
  session: RuntimeScenarioSession
}
```

This is the smallest refactor that improves ownership without inventing a second metadata system.

## Why this is better than the current shape

Today:

- `activeTitle`
- `activeDescription`

are runtime-owned, but that ownership is implicit.

After Phase 5:

- `runtime.scenario.metadata`

becomes the obvious answer to "where does fallback scenario UI metadata live?"

That makes scenario load transitions, startup initialization, and HUD fallback easier to reason about and keeps the dynamic debug snapshot case simple.

## Execution plan

### 1. Add a dedicated runtime metadata type

Touch first:

- `src/runtime/appRuntimeState.ts`

Work:

- add `RuntimeScenarioMetadata`
- replace:
  - `activeTitle`
  - `activeDescription`
- with:
  - `metadata: RuntimeScenarioMetadata`

Important:

- keep this inside the existing `scenario` slice
- do not move metadata into session state
- do not turn metadata into a getter-only helper at this stage

### 2. Move scenario load transitions to the metadata object shape

Touch next:

- `src/runtime/createScenarioRuntimeController.ts`

Work:

- change `ScenarioRuntimeTransition` so it carries:
  - `scenario.metadata`
  - `scenario.session`
- update `createScenarioRuntimeTransition`
- update the debug snapshot load path
- keep `resolveStartupScenarioId` unchanged

Recommended shape:

```ts
type ScenarioRuntimeTransition = {
  coastPredictionHorizonHours: number
  scenario: {
    metadata: RuntimeScenarioMetadata
    session: RuntimeScenarioSession
  }
  state: SimulationState
  viewportSize: number
}
```

This keeps metadata load/apply aligned with the existing scenario transition path.

### 3. Make runtime apply logic own the metadata update

Touch next:

- `src/runtime/runtimeStateTransitions.ts`

Work:

- update `applyScenarioLoadTransition` to assign:
  - `runtime.scenario.metadata`
- instead of:
  - `runtime.scenario.activeTitle`
  - `runtime.scenario.activeDescription`

Keep the rest of the apply order unchanged:

- scenario metadata
- simulation/world values
- scenario session
- UI effect epoch
- transient cleanup
- directive sync

### 4. Update startup initialization to use the metadata object directly

Touch next:

- `src/app/createInitialAppRuntimeState.ts`

Work:

- initialize `runtime.scenario.metadata` from the initial scenario transition
- keep the menu-mode special cases exactly as they are

This step should be mechanical once the transition type is updated.

### 5. Update HUD fallback to read from the explicit metadata owner

Touch next:

- `src/presentation/hudPresentation.ts`

Work:

- keep scenario-specific `getHudContent` override behavior exactly the same
- keep fallback logic exactly the same in behavior
- replace fallback reads of:
  - `runtime.scenario.activeTitle`
  - `runtime.scenario.activeDescription`
- with:
  - `runtime.scenario.metadata.title`
  - `runtime.scenario.metadata.description`

Do not:

- merge dynamic `getHudContent` into `metadata`
- recompute metadata every frame from scenario definitions

## File impact map

### Required

- `src/runtime/appRuntimeState.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/presentation/hudPresentation.ts`

### Likely tests to update

- `src/app/createInitialAppRuntimeState.test.ts`
- `src/runtime/runtimeStateTransitions.test.ts`
- `src/runtime/runtimeActions.test.ts`
- any fixture-heavy tests that still build `AppRuntimeState` with `activeTitle` / `activeDescription`

## Acceptance criteria

Phase 5 is complete when:

- active scenario metadata has one explicit runtime owner: `runtime.scenario.metadata`
- startup, reset, free-roam start, tutorial start, and debug snapshot load all populate metadata through the same scenario-load path
- HUD fallback reads the runtime metadata object
- scenario-specific `getHudContent` overrides still work exactly as before
- no runtime code still relies on `runtime.scenario.activeTitle` or `runtime.scenario.activeDescription`
- behavior is unchanged

## Risks and guardrails

### Risk: trying to eliminate runtime metadata entirely

That sounds cleaner on paper, but it adds unnecessary lookup work and makes dynamic metadata cases harder.

Guardrail:

- keep runtime as the owner of the active loaded metadata
- only make that ownership explicit

### Risk: mixing base metadata with per-state HUD content

Tutorial and future scenarios may keep changing the visible HUD title/description by state.

Guardrail:

- `runtime.scenario.metadata` is the fallback/base metadata
- `getHudContent` remains the per-state override path

### Risk: bypassing the main scenario load path

The point of the phase is consistency.

Guardrail:

- startup, normal scenario loads, and debug snapshot loads should all use the same metadata-carrying transition shape

## Suggested commit order

1. add `RuntimeScenarioMetadata` and migrate the runtime state shape
2. update scenario load transitions and runtime apply logic to use `scenario.metadata`
3. update startup initialization and HUD fallback
4. update tests and fixtures mechanically

## Test plan

Run focused tests during the pass:

```bash
npm run test -- src/app/createInitialAppRuntimeState.test.ts src/runtime/runtimeStateTransitions.test.ts src/runtime/runtimeActions.test.ts
```

Then run the full checks:

```bash
npm run test
npm run build
```

## Suggested handoff prompt

Use this if handing Phase 5 to another model:

```text
Implement Phase 5 of the runtime-state ownership refactor: align UI/runtime metadata ownership.

Rules:
- Keep the work narrow and behavior-preserving.
- Do not redesign HUD override logic.
- Do not remove runtime-owned metadata entirely.
- Keep debug snapshot behavior intact.

Main tasks:
1. In `src/runtime/appRuntimeState.ts`, replace `runtime.scenario.activeTitle` and `runtime.scenario.activeDescription` with a dedicated `runtime.scenario.metadata` object.
2. In `src/runtime/createScenarioRuntimeController.ts`, update scenario load transitions so they carry `scenario.metadata` plus `scenario.session`.
3. In `src/runtime/runtimeStateTransitions.ts`, make `applyScenarioLoadTransition` assign `runtime.scenario.metadata`.
4. In `src/app/createInitialAppRuntimeState.ts`, initialize metadata from the initial scenario transition.
5. In `src/presentation/hudPresentation.ts`, keep `getHudContent` behavior unchanged but use `runtime.scenario.metadata` for fallback title/description.
6. Update tests and fixtures honestly; do not preserve both shapes at once.

Important:
- `runtime.scenario.metadata` is base/fallback metadata.
- `getHudContent` remains the per-state override path.
- Startup, normal scenario loads, and debug snapshot loads should all use the same metadata-carrying load path.

Run:
- `npm run test -- src/app/createInitialAppRuntimeState.test.ts src/runtime/runtimeStateTransitions.test.ts src/runtime/runtimeActions.test.ts`
- `npm run test`
- `npm run build`
```

## Suggested docs commit message

`docs: add new phase 5 detailed docs`

## Status

Resolved on 2026-04-21.

Moved to `ideas/resolved/` because the metadata ownership follow-up landed and this handoff no longer represents active work.
