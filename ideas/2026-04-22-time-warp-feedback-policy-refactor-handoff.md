# Time warp feedback policy refactor handoff

## Context

The current staged touch-controls work improves player feedback in two useful ways:

- blocked time-warp previews stay visible instead of disappearing
- committed time-warp changes get a stronger animated confirmation

That player-facing direction looks good. The remaining issue is implementation shape.

Right now the time-warp preview and feedback path is spread across several layers:

- `src/runtime/simulationStep.ts` resolves control-based and scenario-based warp constraints
- `src/app/createAppComponents.ts` asks for a preview and now routes through a helper
- `src/ui/touchControls/touchInteractionModel.ts` stores preview state for the touch layer
- `src/ui/touchControls/createTouchControls.ts` translates preview reasons into labels, animation state, and fade timing
- `src/ui/timeWarpFeedback.css` defines shared animation variants and blocked/available visuals

The main risk is not one bug. The risk is cross-layer drift. Small behavior changes will keep forcing edits in multiple files because preview policy, display copy, animation state, and DOM timing are still coupled.

## Problem statement

The current structure still mixes three separate concerns:

- simulation policy: what warp is allowed and why
- UI messaging policy: how that reason should be shown to the player
- DOM presentation: when to show, animate, fade, and clear the overlay

Examples of current coupling:

- `createTouchControls.ts` still owns the reason-to-label mapping (`thrust`, `turn`, `control`, `max`, `min`)
- the same file also owns the distinction between preview state and committed confirmation state
- `lastTimeWarpFeedbackState` persists render state only so the commit animation can replay after the interaction model clears preview state
- the available vs blocked visual state is encoded partly in preview reason, partly in DOM dataset flags, and partly in CSS selectors

This makes future changes expensive:

- changing feedback copy means editing gesture/UI code instead of a dedicated formatter/presenter
- adding a new constraint reason means touching runtime helpers, interaction state, UI rendering, and CSS variants
- testing is uneven because policy and DOM timing are mixed in the same module

## Proposal

Extract a dedicated time-warp feedback presenter boundary with explicit inputs and outputs.

Suggested split:

### 1. Policy layer

Owns:

- requested action
- current warp index
- resolved next warp value
- blocked vs available status
- normalized display reason

Suggested file:

- `src/runtime/timeWarpFeedbackPolicy.ts`

Suggested exports:

- `type TimeWarpFeedbackReason`
- `type TimeWarpFeedbackPreview`
- `getTimeWarpFeedbackPreview(...)`
- optional `formatTimeWarpFeedbackLabel(...)`

This layer should be pure and testable. It should absorb the reason normalization currently split between `resolveSimulationTimeWarp` and the app layer.

### 2. Interaction/presentation state layer

Owns:

- preview visibility
- committed confirmation replay state
- last rendered anchor point
- fade timing state

Suggested file:

- `src/ui/touchControls/timeWarpFeedbackModel.ts`

This layer should let the interaction model clear commit eligibility without forcing the DOM adapter to keep ad hoc shadow state like `lastTimeWarpFeedbackState`.

### 3. DOM renderer layer

Owns:

- dataset attributes
- CSS class toggles
- inline position and opacity styles
- measurement and clamping

Suggested file:

- `src/ui/touchControls/timeWarpFeedbackView.ts`

This layer should take explicit render instructions and avoid embedding gameplay policy.

## Concrete refactor targets

Files likely to change:

- `src/runtime/simulationStep.ts`
- `src/runtime/simulationStep.test.ts`
- `src/app/createAppComponents.ts`
- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/touchInteractionModel.ts`
- `src/ui/touchControls/touchInteractionModel.test.ts`
- `src/ui/timeWarpFeedback.css`

Possible new files:

- `src/runtime/timeWarpFeedbackPolicy.ts`
- `src/runtime/timeWarpFeedbackPolicy.test.ts`
- `src/ui/touchControls/timeWarpFeedbackModel.ts`
- `src/ui/touchControls/timeWarpFeedbackModel.test.ts`
- `src/ui/touchControls/timeWarpFeedbackView.ts`

## Suggested phases

### Phase 1: move feedback policy into a dedicated runtime helper

Goal:

- stop leaking policy details into `createAppComponents.ts`
- make preview reason/value/status come from one pure helper

Acceptance criteria:

- `createAppComponents.ts` only forwards runtime state into the helper
- preview-reason tests live next to policy tests
- no behavior change

### Phase 2: extract time-warp feedback model from `createTouchControls.ts`

Goal:

- remove ad hoc local state related only to overlay replay and fading

Acceptance criteria:

- `lastTimeWarpFeedbackState` is removed from `createTouchControls.ts`
- preview state and commit confirmation state are explicit model states
- unit tests cover blocked preview, successful commit replay, cancel, and immediate hide

### Phase 3: extract DOM rendering helper

Goal:

- make the touch-controls file mostly event wiring

Acceptance criteria:

- class/dataset/style mutations move behind named render functions
- `createTouchControls.ts` no longer assembles label strings directly
- the renderer can be driven by plain model snapshots

### Phase 4: tighten naming and remove dead state

Goal:

- clean up leftover incidental complexity after extraction

Acceptance criteria:

- each model field is used by at least one behavior or renderer path
- preview reason types are shared from one location
- CSS selectors map cleanly to explicit render states

## Testing strategy

Priority tests:

- preview shows `global-max` and `global-min` only when already at the hard list edge
- scenario-limited preview reports blocked while still showing the constrained target value
- turning-only clamps map to the turning reason
- thrust clamps map to the thrust reason
- blocked preview does not commit on release
- successful commit replays confirmation animation from the last clamped screen position
- cancel clears preview and confirmation state fully

Verification commands after implementation:

- `npm test`
- `npm run build`

## Open questions

- Should the label formatter stay text-based (`max`, `turn`, `thrust`) or move toward iconography/color only for blocked states?
- Should committed confirmation reuse the preview overlay, or should preview and confirmation become separate render modes with separate DOM state?
- Is `touchInteractionModel.ts` still the right home for time-warp preview state once a dedicated feedback model exists?

## Status

Promising. Ready for a bounded follow-up by a smaller model.
