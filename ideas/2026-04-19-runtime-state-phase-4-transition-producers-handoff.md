# Runtime state Phase 4 transition producers handoff

## Relevance check

Phase 4 is still relevant.

The code already moved partway toward transition-based scenario updates:

- `advance`
- `acknowledgePrompt`
- `reopenPrompt`

already return `ScenarioRuntimeTransition` data in many cases.

But the ownership model is still incomplete. Scenario code still mutates live runtime state before or alongside those returned transitions.

Current concrete leaks:

- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts` mutates `runtime.targetHeading` and `runtime.assistMode` inside `setStepId`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts` mutates the live simulation world in `positionMoonForPhaseTwo(runtime)`
- `src/scenario/scenarioDirectives.ts` both computes directive state and applies scenario transitions, so runtime/scenario ownership is still blurred
- `src/runtime/frameLoop.ts` and `src/runtime/runtimeActions.ts` still know the details of how scenario transitions get requested and committed

That means the transition API exists, but it is not yet the sole path for scenario-driven runtime changes.

## Preconditions

Do Phase 4 after Phase 3, not before it.

Phase 3 tightens the runtime typing boundary. Phase 4 should build on that and stay focused on ownership and readability, not mixed typing cleanup.

## Goal

Scenario code should decide what changed.

Runtime code should apply those changes in one explicit place.

## Constraints

- keep gameplay behavior unchanged
- do not redesign the whole app action system
- do not bundle unrelated runtime-state shape work into this phase
- do not move generic non-scenario runtime actions into the scenario transition model
- keep prompt actions like `start-free-roam` and `exit-to-menu` separate from runtime-state transitions for now
- prefer explicit typed fields over callback-based effect payloads

## Main design decision

Keep `ScenarioRuntimeTransition<TState>` as the main scenario-to-runtime contract, but make it rich enough to describe the runtime changes that tutorial code currently performs imperatively.

Recommended direction:

```ts
export type ScenarioRuntimeTransition<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  checkpoint?: RuntimeScenarioCheckpoint | null
  completed?: boolean
  nextState?: TState
  runtime?: {
    assistMode?: AssistMode
    state?: SimulationState
    targetHeading?: number | null
  }
}
```

Why this shape:

- it covers the current tutorial leaks directly
- it avoids callback effects hidden inside the transition
- it keeps scenario logic declarative enough for a smaller model to follow
- it does not pull high-level app navigation into the runtime contract

Do not start with a giant union of effect objects unless the implementation truly needs it. For this repo, a small `runtime` patch object is easier to apply and review.

## Keep app-level prompt effects separate

Do not fold `start-free-roam` and `exit-to-menu` into `ScenarioRuntimeTransition` in this phase.

Those are app/high-level actions, not runtime-state mutations. They are already consumed in `src/app/createAppComponents.ts` and routed through the high-level action mediator.

For Phase 4, the cleaner split is:

- `ScenarioRuntimeTransition` for runtime-owned state changes
- existing prompt `effect` result for app-level navigation actions

That keeps the boundary clearer and avoids dragging app-mode control into a runtime refactor.

## Target architecture after Phase 4

After this phase:

- scenario functions return transition data only
- tutorial onboarding helpers return state/effect descriptions, not runtime mutations
- tutorial phase advancement returns a world replacement when the world must change
- runtime-owned helpers apply scenario transitions and resync directives centrally
- `frameLoop` and `runtimeActions` orchestrate scenario progression through runtime helpers rather than applying scenario changes themselves

## Execution plan

### 1. Expand `ScenarioRuntimeTransition` to carry runtime-owned changes

Touch first:

- `src/scenario/scenarioRuntimeTransition.ts`

Work:

- add a small optional `runtime` patch field
- include only fields needed by the current scenario code:
  - `assistMode`
  - `targetHeading`
  - `state`

Do not:

- add `viewportSize`, `timeWarpIndex`, or unrelated knobs unless a concrete scenario flow already needs them
- replace the existing `nextState`, `checkpoint`, or `completed` fields

### 2. Move transition application into a runtime-owned helper

Touch next:

- `src/runtime/runtimeStateTransitions.ts`
- `src/scenario/scenarioDirectives.ts`

Work:

- make runtime own applying `ScenarioRuntimeTransition`
- apply, in order:
  - `runtime.state` patch if present
  - `runtime.assistMode` patch if present
  - `runtime.targetHeading` patch if present
  - scenario session fields (`nextState`, `checkpoint`, `completed`)
  - directive reconciliation
- return a boolean indicating whether a transition was applied

Recommended outcome:

- `applyScenarioRuntimeTransition` lives in `src/runtime/runtimeStateTransitions.ts`
- `src/scenario/scenarioDirectives.ts` keeps directive resolution and constraint logic, but no longer owns scenario-transition application

This is an important ownership cleanup. Runtime-owned apply logic should not live in a scenario helper module.

### 3. Replace tutorial onboarding runtime mutations with transition data

Touch next:

- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

Current problem:

- `setStepId` mutates `runtime.targetHeading`
- `setStepId` mutates `runtime.assistMode`

Recommended approach:

- introduce a small onboarding result type, for example:

```ts
type TutorialOnboardingAdvanceResult = {
  onboarding: TutorialOnboardingState
  runtime?: {
    assistMode?: AssistMode
    targetHeading?: number | null
  }
}
```

- make `setStepId`, `advanceToNextStep`, `goBackToPreviousStep`, `advanceTutorialOnboarding`, and `acknowledgeTutorialOnboardingPrompt` return that result shape when needed
- let `tutorialScenario.ts` fold that runtime patch into the returned `ScenarioRuntimeTransition`

Important:

- keep the onboarding progression rules unchanged
- keep the step sequencing unchanged
- keep using live runtime reads for decision-making
- only remove the direct writes

### 4. Replace tutorial world mutation with an explicit world result

Touch next:

- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`

Current problem:

- `positionMoonForPhaseTwo(runtime)` mutates the live simulation world before a transition is returned

Recommended approach:

- replace it with a pure helper that returns the next simulation state
- suggested shape:

```ts
const createPhaseTwoSimulationState = (
  state: SimulationState,
): SimulationState => SimulationState
```

- the transition for moving from `escape-earth` to `reach-moon` should include:
  - `runtime.state`
  - `checkpoint`
  - `nextState`

Important ordering rule:

- when a transition changes world state and also captures a checkpoint, compute the checkpoint from the same next world that will be applied, not from the pre-transition world

That avoids subtle mismatch between checkpoint contents and the world visible after the transition.

### 5. Add runtime-owned orchestration helpers for the main scenario entry points

Touch next:

- `src/runtime/runtimeStateTransitions.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/frameLoop.ts`
- optionally `src/scenario/scenarioRegistry.ts` if small registry wrappers help

Recommended runtime helpers:

- `advanceRuntimeScenario(...)`
- `acknowledgeRuntimeScenarioPrompt(...)`
- `reopenRuntimeScenarioPrompt(...)`

Each helper should:

- ask scenario code for a transition/result
- apply the returned transition through the runtime-owned apply helper
- return only the small result the caller still needs

Suggested split:

- `frameLoop` should call a runtime helper that advances the active scenario
- `runtimeActions` should call runtime helpers for prompt acknowledgement and prompt replay
- `runtimeActions` should not manually call `applyScenarioRuntimeTransition` itself

The main point is to make runtime orchestration consistent in one home.

### 6. Keep tutorial-specific changes local; do not generalize too early

This phase should make tutorial logic cleaner because tutorial is the richest scenario.

But do not over-generalize from one scenario.

Good generalization:

- richer `ScenarioRuntimeTransition`
- runtime-owned transition apply helper

Premature generalization:

- a whole new reducer framework
- a scenario-id keyed command registry
- callback-based effect interpreters

## File impact map

### Required

- `src/scenario/scenarioRuntimeTransition.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/frameLoop.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`

### Possibly touched

- `src/scenario/scenarioRegistry.ts`
- `src/app/createAppComponents.ts`

`createAppComponents.ts` should only need changes if result plumbing becomes slightly cleaner. It should not need an ownership redesign.

## Acceptance criteria

Phase 4 is complete when:

- tutorial scenario logic no longer mutates live runtime state before returning transitions
- onboarding step changes no longer write `runtime.targetHeading` or `runtime.assistMode` directly
- the phase-2 moon repositioning path returns a world change through the transition instead of mutating `runtime.state`
- scenario transitions are applied by runtime-owned code in one place
- `frameLoop` and `runtimeActions` no longer manually combine "get transition" and "apply transition" logic
- directive resync still happens centrally after transition application
- gameplay behavior remains unchanged

## Risks and guardrails

### Risk: mixing this with a broad action-system redesign

The repository already has high-level actions for app navigation. Phase 4 does not need to replace them.

Guardrail:

- keep app-level prompt `effect` separate
- only move runtime-state changes into the richer scenario transition

### Risk: introducing callback-based runtime effects

It is tempting to return functions from scenario code because it is quick.

Guardrail:

- do not return callbacks or imperative closures in transitions
- return explicit typed data only

### Risk: checkpoint/world mismatch

Tutorial phase changes may both modify the world and capture a checkpoint.

Guardrail:

- compute checkpoint data from the same next world placed into the transition

### Risk: moving too much logic out of tutorial at once

The target is ownership cleanup, not a full gameplay rewrite.

Guardrail:

- keep phase conditions, prompt rules, and onboarding progression exactly as they are
- only refactor how changes are represented and applied

## Suggested commit order

1. extend `ScenarioRuntimeTransition` and move transition apply logic under `src/runtime`
2. refactor tutorial onboarding helpers to return runtime patch data instead of mutating runtime
3. refactor tutorial phase-2 world repositioning to return next world state in the transition
4. add runtime-owned scenario advance/acknowledge/reopen helpers and migrate `frameLoop` and `runtimeActions`

## Test plan

Run targeted suites during the pass:

```bash
npm run test -- src/runtime/runtimeStateTransitions.test.ts src/runtime/runtimeActions.test.ts src/scenario/scenarioDirectives.test.ts src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts
```

Then run full verification:

```bash
npm run test
npm run build
```

## Manual checks

- start tutorial and confirm the first blocking prompt
- progress through the onboarding steps that set up the outward heading/time-warp guidance
- advance from `escape-earth` to `reach-moon` and confirm the moon repositioning behavior still matches current gameplay
- reopen a previously acknowledged tutorial prompt
- finish the tutorial and confirm the `start-free-roam` action still routes through the existing high-level action path

## Suggested handoff prompt

Use this if handing Phase 4 to another model:

```text
Implement Phase 4 of the runtime-state ownership refactor: turn scenario logic into typed transition producers.

This phase is still relevant because tutorial scenario code still mutates live runtime state in places before returning transitions.

Rules:
- Keep the work narrow and behavior-preserving.
- Do not redesign the app action system.
- Keep prompt navigation effects like `start-free-roam` / `exit-to-menu` separate from runtime-state transitions.
- Do not use callback-based effect payloads.

Main tasks:
1. Extend `src/scenario/scenarioRuntimeTransition.ts` so a transition can carry a small runtime patch for `assistMode`, `targetHeading`, and `state`.
2. Move scenario-transition application into `src/runtime/runtimeStateTransitions.ts`, including central directive resync after apply.
3. Remove direct runtime writes from `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts` by returning onboarding state plus any needed runtime patch data.
4. In `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`, replace the phase-2 moon repositioning mutation with a pure helper that returns the next world state and include that in the transition.
5. Add runtime-owned helpers for scenario `advance`, prompt `acknowledge`, and prompt `reopen`, then migrate `src/runtime/frameLoop.ts` and `src/runtime/runtimeActions.ts` to use them.

Important:
- Keep tutorial progression rules unchanged.
- Keep checkpoint creation aligned with the same next world state that gets applied.
- Keep directive sync centralized after scenario transition application.

Run:
- `npm run test -- src/runtime/runtimeStateTransitions.test.ts src/runtime/runtimeActions.test.ts src/scenario/scenarioDirectives.test.ts src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts src/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `npm run test`
- `npm run build`
```

## Status

Planned.
