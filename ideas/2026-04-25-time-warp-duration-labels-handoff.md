# Time warp duration labels handoff

## Context

The current time-warp system is functionally centralized but presentation is still multiplier-based.

Today the default warp ladder is:

- `1`
- `10`
- `50`
- `100`
- `500`
- `2000`
- `8000`

And the UI renders those values as `x1`, `x10`, `x50`, and so on.

That works mechanically, but it is not how players reason about it. A player can interpret `x1h` or `x30m` quickly. `x2000` and `x8000` require translation.

The requested direction is to replace those raw multipliers with a duration-oriented ladder and display format:

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

This is not a large architectural rewrite. The main work is making one shared formatter, updating the configured ladder, and cleaning up a few places that assume old exact values.

## Problem statement

The visible problem is copy, but there are a few implementation couplings behind it:

- the time pill still formats the active warp as `${value}x`
- the selector control formats adjacent/current values as `x${value}`
- the touch feedback presenter formats preview/confirmation labels as `>> x${value}` and `<< x${value}`
- menu startup assumes `500` exists in the ladder
- active-controls clamping assumes the control-safe cap exists exactly in the ladder
- tutorial copy and progression are written around `100x`

So this should not be done as a blind config edit.

If the ladder changes without the small logic fixes:

- menu mode may default to the wrong starting warp
- control-based clamping can silently stop applying when thrust/turn is active
- tutorial text will be wrong even if the mechanics still work
- tests will fail in several places because labels and fixtures still expect `x...`

## Proposal

Treat this as a small refactor with one explicit goal:

- make time warp read as duration-based everywhere players see it

Do that through three linked changes:

### 1. Introduce one shared time-warp formatter

Create a small UI-facing formatter that converts numeric warp values into display labels:

- `1` -> `x1s`
- `10` -> `x10s`
- `30` -> `x30s`
- `60` -> `x1m`
- `300` -> `x5m`
- `1800` -> `x30m`
- `3600` -> `x1h`
- `7200` -> `x2h`
- `18000` -> `x5h`

This formatter should be reused by:

- HUD time pill
- selector control
- touch feedback presenter

Do not keep separate formatting logic in each UI path.

### 2. Replace the configured warp ladder

Update the default `timeWarps` config to:

- `[1, 10, 30, 60, 300, 1800, 3600, 7200, 18000]`

The rest of the runtime already reads from the configured array, so most stepping behavior should continue to work once the exact-value assumptions are cleaned up.

### 3. Remove exact-value assumptions where needed

Two places need real logic attention:

#### Menu startup default

Current menu initialization looks for `500` exactly.

That should become a rule based on intent rather than the old literal value. Examples:

- choose `x5m` explicitly if that is the intended menu feel
- or choose the nearest configured warp at or below a target value

The important part is to stop assuming `500` exists.

#### Active-controls clamp

Current control-safe clamping looks up `maxControlWarp` with `timeWarps.indexOf(maxControlWarp)`.

That is fragile once the list changes.

Instead, resolve the highest configured index whose warp value is `<= maxControlWarp`.

That preserves the intent of:

- while thrust/turn/manual controls are active, clamp to a safe warp tier

With the proposed ladder and the existing `defaultMaxControlWarp = 100`, the effective control-safe cap becomes `x1m` because `60` is the highest configured value at or below `100`.

That is likely acceptable, but it should be treated as a deliberate behavior choice, not an accidental side effect.

## Concrete refactor targets

Likely files to change:

- `config/base.yml`
- `src/presentation/hudPresentation.ts`
- `src/ui/formatters.ts`
- `src/ui/touchControls/selectorTimeWarpControl.ts`
- `src/ui/touchControls/timeWarpFeedbackPresenter.ts`
- `src/runtime/simulationStep.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/config.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`

Likely tests to update:

- `tests/ui/touchControls/timeWarpFeedbackPresenter.test.ts`
- `tests/ui/touchControls/timeWarpFeedbackView.test.ts`
- `tests/runtime/timeWarpFeedbackPolicy.test.ts`
- `tests/runtime/simulationStep.test.ts`
- `tests/app/createInitialAppRuntimeState.test.ts`
- any tutorial tests that reference `100x` or old ladder values

## Suggested execution plan

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

The smaller model should not guess here. Use these defaults unless there is a clear product reason to choose otherwise.

### Tutorial high-warp requirement

Recommended change:

- from `100`
- to `60`

Reason:

- `100` no longer exists in the ladder
- `60` is the nearest simple step and reads cleanly as `x1m`
- it preserves the tutorial intent of "use a meaningfully high warp before combining it with thrust"

Update the copy accordingly:

- `Increase time warp until the time pill reaches at least x1m.`
- `Burn At x1m`
- `Keep time warp at x1m or higher...`

### Menu-mode default

Recommended change:

- target `300` / `x5m`

Reason:

- it is closest in spirit to the current `500` choice
- it is fast enough to keep background motion interesting without jumping straight to hour-scale pacing

## Testing strategy

Priority behavior tests:

- formatter converts second-based values to the new labels correctly
- HUD pill shows elapsed time plus the formatted warp label
- selector control renders formatted current/next values
- touch feedback presenter renders `>> x1m` / `<< x30s` style labels
- control-safe clamp picks the highest configured warp at or below the cap when the exact cap is missing
- menu mode chooses the intended default warp under the new ladder
- tutorial progression advances at the new high-warp threshold

Verification commands after implementation:

- `npm test`
- `npm run build`

Deploy note:

- if this lands on a non-`main` branch, deploy to staging before handoff completion because the visible UI changes affect shipped behavior

## Risks and review points

The main review points are:

- duplicated formatting logic left behind in one UI surface
- control clamping regressing when manual controls are active
- tutorial copy updated without updating the progression threshold
- menu background becoming too slow or too fast after the default warp change

This refactor should stay bounded. Do not redesign time-warp mechanics, touch interaction patterns, or scenario directive APIs as part of this task.

## Status

Ready for a smaller model. The task is bounded, the risky spots are identified, and the expected ladder plus threshold choices are explicit.
