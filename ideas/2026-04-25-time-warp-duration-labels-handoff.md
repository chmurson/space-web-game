# Time warp duration labels handoff

## Status

Resolved. The implementation is present in the codebase; this document is retained as a completion record and rationale for the choices made.

Implemented behavior:

- the default warp ladder is `[1, 10, 30, 60, 300, 1800, 3600, 7200, 18000]`
- player-facing warp labels render as `x1s`, `x10s`, `x30s`, `x1m`, `x5m`, `x30m`, `x1h`, `x2h`, and `x5h`
- HUD, selector control, and swipe feedback all use the shared `formatTimeWarpLabel` formatter
- menu mode starts at the nearest configured warp at or below the `300` second target, which is `x5m` for the default ladder
- active-control clamping resolves the highest configured warp at or below `maxControlWarp`, so the default `100` cap resolves to `x1m`
- tutorial onboarding now uses `x1m` copy and a high-warp threshold of `60`

Verification status:

- Not recorded in this handoff whether `npm test` and `npm run build` were run at implementation time.
- Not recorded in this handoff whether a Netlify deploy was performed after implementation.

## Context

Before this change, the time-warp system was functionally centralized but presentation was still multiplier-based.

The previous default warp ladder was:

- `1`
- `10`
- `50`
- `100`
- `500`
- `2000`
- `8000`

And the UI rendered those values as `x1`, `x10`, `x50`, and so on.

That worked mechanically, but it was not how players reason about it. A player can interpret `x1h` or `x30m` quickly. `x2000` and `x8000` require translation.

The requested direction was to replace those raw multipliers with a duration-oriented ladder and display format:

- `x1s`
- `x10s`
- `x30s`
- `x1m`
- `x5m`
- `x30m`
- `x1h`
- `x2h`
- `x5h`

The affected surfaces are:

- the time-warp pill
- the touch gesture feedback overlay
- the selector-style time-warp control

This was not a large architectural rewrite. The main work was making one shared formatter, updating the configured ladder, and cleaning up a few places that assumed old exact values.

## Problem statement

The visible problem was copy, but there were a few implementation couplings behind it:

- the time pill formatted the active warp as `${value}x`
- the selector control formatted adjacent/current values as `x${value}`
- the touch feedback presenter formatted preview/confirmation labels as `>> x${value}` and `<< x${value}`
- menu startup assumed `500` existed in the ladder
- active-controls clamping assumed the control-safe cap existed exactly in the ladder
- tutorial copy and progression were written around `100x`

So this could not be done as a blind config edit.

If the ladder changed without the small logic fixes:

- menu mode could default to the wrong starting warp
- control-based clamping could silently stop applying when thrust/turn is active
- tutorial text would be wrong even if the mechanics still worked
- tests would fail in several places because labels and fixtures still expected `x...`

## Implementation Summary

This was handled as a small refactor with one explicit goal:

- make time warp read as duration-based everywhere players see it

The implementation used four linked changes:

### 1. Shared time-warp formatter

A UI-facing formatter converts numeric warp values into display labels:

- `1` -> `x1s`
- `10` -> `x10s`
- `30` -> `x30s`
- `60` -> `x1m`
- `300` -> `x5m`
- `1800` -> `x30m`
- `3600` -> `x1h`
- `7200` -> `x2h`
- `18000` -> `x5h`

This formatter is reused by:

- HUD time pill
- selector control
- touch feedback presenter

Separate player-facing warp formatting logic should not be reintroduced in individual UI paths.

### 2. Configured warp ladder

The default `timeWarps` config is:

- `[1, 10, 30, 60, 300, 1800, 3600, 7200, 18000]`

The rest of the runtime reads from the configured array, so stepping behavior remains ladder-driven.

### 3. Exact-value assumptions removed

Two places needed real logic attention:

#### Menu startup default

Previous menu initialization looked for `500` exactly.

That is now a rule based on intent rather than the old literal value:

- target `300` seconds / `x5m`
- choose the nearest configured warp at or below that target

This stops menu startup from assuming `500` exists.

#### Active-controls clamp

Previous control-safe clamping looked up `maxControlWarp` with `timeWarps.indexOf(maxControlWarp)`.

That is fragile when the list does not contain the cap exactly.

The implementation resolves the highest configured index whose warp value is `<= maxControlWarp`.

That preserves the intent:

- while thrust/turn/manual controls are active, clamp to a safe warp tier

With the implemented ladder and the existing `defaultMaxControlWarp = 100`, the effective control-safe cap is `x1m` because `60` is the highest configured value at or below `100`.

That is a deliberate behavior choice, not an accidental side effect.

### 4. Tutorial copy and progression

Tutorial onboarding now requires a high-warp threshold of `60`, displayed as `x1m`.

Updated copy:

- `Increase time warp until the time pill reaches at least x1m.`
- `Burn At x1m`
- `Keep time warp at x1m or higher...`

## Concrete Refactor Targets

Implementation files:

- `config/base.yml`
- `src/presentation/hudPresentation.ts`
- `src/ui/formatters.ts`
- `src/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControlPresenter.ts`
- `src/ui/touchControls/swipeTimeWarpControl/timeWarpFeedbackPresenter.ts`
- `src/runtime/simulationStep.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/config.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`

Related tests:

- `tests/ui/formatters.test.ts`
- `tests/ui/touchControls/selectorTimeWarpControlPresenter.test.ts`
- `tests/ui/touchControls/timeWarpFeedbackPresenter.test.ts`
- `tests/ui/touchControls/timeWarpFeedbackView.test.ts`
- `tests/runtime/timeWarpFeedbackPolicy.test.ts`
- `tests/runtime/simulationStep.test.ts`
- `tests/app/createInitialAppRuntimeState.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

## Historical Execution Plan

This was the execution plan for the completed refactor.

### Phase 1: add a shared display formatter

Goal:

- eliminate duplicated `x${value}` formatting

Acceptance criteria:

- one formatter is used by pill, selector, and touch feedback
- labels render as `x1s`, `x5m`, `x1h`, etc.
- no UI path still constructs raw `x${value}` strings directly

### Phase 2: switch the default ladder

Goal:

- move the game onto the new duration-oriented warp values

Acceptance criteria:

- default config uses `[1, 10, 30, 60, 300, 1800, 3600, 7200, 18000]`
- stepping controls still move through the whole ladder in order
- preview/confirmation still show the resolved target value

### Phase 3: harden exact-value logic

Goal:

- keep behavior correct after removing `100` and `500`

Acceptance criteria:

- menu startup no longer depends on `indexOf(500)`
- active-controls clamp no longer depends on `indexOf(maxControlWarp)`
- clamp behavior is covered by tests for ladders that do not contain the exact cap

### Phase 4: align tutorial copy and progression

Goal:

- keep onboarding consistent with the new visible warp language

Acceptance criteria:

- tutorial text no longer says `100x`
- the high-warp threshold is updated intentionally
- progression tests cover the new threshold

## Recommended threshold choices

These choices were used unless there is a later product reason to revisit them.

### Tutorial high-warp requirement

Implemented change:

- from `100`
- to `60`

Reason:

- `100` no longer exists in the ladder
- `60` is the nearest simple step and reads cleanly as `x1m`
- it preserves the tutorial intent of "use a meaningfully high warp before combining it with thrust"

Updated copy:

- `Increase time warp until the time pill reaches at least x1m.`
- `Burn At x1m`
- `Keep time warp at x1m or higher...`

### Menu-mode default

Implemented change:

- target `300` / `x5m`

Reason:

- it is closest in spirit to the current `500` choice
- it is fast enough to keep background motion interesting without jumping straight to hour-scale pacing

## Expected Verification

Priority behavior covered by tests:

- formatter converts second-based values to the new labels correctly
- HUD pill shows elapsed time plus the formatted warp label
- selector control renders formatted current/next values
- touch feedback presenter renders `>> x1m` / `<< x30s` style labels
- control-safe clamp picks the highest configured warp at or below the cap when the exact cap is missing
- menu mode chooses the intended default warp under the new ladder
- tutorial progression advances at the new high-warp threshold

Expected verification commands after implementation:

- `npm test`
- `npm run build`

Deploy policy:

- if this lands on a non-`main` branch, deploy to staging before handoff completion because the visible UI changes affect shipped behavior
- if this lands on `main`, deploy to the production Netlify site after the relevant commit

## Risks and review points

The main review points are:

- duplicated formatting logic left behind in one UI surface
- control clamping regressing when manual controls are active
- tutorial copy updated without updating the progression threshold
- menu background becoming too slow or too fast after the default warp change

Scope boundary for future follow-ups: do not redesign time-warp mechanics, touch interaction patterns, or scenario directive APIs as part of duration-label cleanup.
