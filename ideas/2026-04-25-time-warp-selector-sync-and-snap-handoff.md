# Time warp selector sync and snap handoff

## Context

The selector-style mobile time-warp control now uses duration labels, but two interaction issues remain.

First, the selector can drift from the real runtime time-warp value. The HUD time pill stays correct because `hudPresentation.update()` reads `runtime.simulation.timeWarpIndex` every frame. The selector only refreshes through its own touch lifecycle, resize handling, and a few cancellation paths. If time warp changes outside the selector, the selector can keep showing stale values.

Second, the selector gesture still behaves like a discrete step trigger. Once the swipe crosses the current threshold, it commits immediately and plays a bump animation. The desired interaction is more like a physical snap control:

- drag toward the next or previous value
- preview the target while dragging
- release below threshold to snap back
- release beyond threshold to commit
- animate smoothly between current and preview rather than jumping step-by-step

These are related but should not be treated as the same problem. The sync issue is correctness. The swipe/snap issue is interaction design and needs a stronger internal state model.

## Current implementation notes

Likely relevant files:

- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/timeWarpControlTypes.ts`
- `src/ui/touchControls/selectorTimeWarpControl/createSelectorTimeWarpControl.ts`
- `src/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControlModel.ts`
- `src/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControlPresenter.ts`
- `src/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControlView.ts`
- `src/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControl.css`
- `src/runtime/timeWarpFeedbackPolicy.ts`
- `src/app/createAppComponents.ts`
- `src/presentation/hudPresentation.ts`

Current selector behavior:

- `createSelectorTimeWarpControl` reads runtime values through `getCurrentTimeWarp()` and preview helpers.
- `syncUi` is currently just `render`.
- `updateGesture` commits as soon as `Math.abs(deltaY) >= swipeCommitDistancePx`.
- `finishGesture` does not decide whether to commit; the commit has already happened.
- The model stores one snapshot containing current value, adjacent previews, and a short step animation direction.
- The view renders fixed value slots and toggles step classes; it does not know about continuous drag progress.

## Problem statement

There are two risks to avoid.

### 1. Blind frame sync can fight active gestures

Calling `timeWarpControl.syncUi()` every frame is attractive because many things can change time warp:

- scenario directive updates
- high-level runtime actions
- keyboard or other control paths
- thrust/turn/manual-control clamps
- crash/recovery/menu state changes

But blindly replacing the selector model every frame is unsafe once the control has internal gesture state. It can stomp drag progress, preview target, snap-back animation, or release-to-commit animation.

The control should receive frequent runtime sync opportunities, but it should decide whether to apply them immediately.

### 2. Immediate commit prevents preview/snap behavior

The current threshold-crossing commit is simple, but it cannot support the intended interaction. A swipe that crosses the threshold already changed runtime state before release, so there is no meaningful "release below threshold snaps back, release above threshold commits" model.

The desired behavior needs commit-on-release.

### 3. Relative commit actions can race with runtime changes

The current touch-control API commits by dispatching a relative action:

- `increaseTimeWarp`
- `decreaseTimeWarp`

That is safe for immediate threshold-crossing commits, but it is risky for release-to-commit.

Example:

- the user starts dragging from `x1m` toward `x5m`
- runtime changes to `x5m` before release because of another action or sync path
- releasing the gesture dispatches `increaseTimeWarp`
- runtime interprets that as "one step above the current `x5m`", not "settle to the previewed `x5m`"

The implementation must not dispatch a stale relative action after the runtime base value has changed. Either introduce an absolute commit API for selector gestures, or guard relative dispatch so it only happens when the latest runtime current value still matches the gesture-start committed value.

## Recommended direction

Refactor the selector around three explicit state domains:

### Runtime snapshot

Represents the latest committed game state visible to the control:

- current committed time-warp value
- decrease preview steps
- increase preview steps
- any blocked/available preview reasons

This should be derived from the existing `getCurrentTimeWarp`, `getTimeWarpPreview`, and `getTimeWarpPreviews` callbacks.

### Gesture state

Represents an active local drag:

- start position
- current delta
- normalized progress
- preview direction, if any
- preview target value, if any
- whether release would commit

This state must not be overwritten by routine frame sync.

### Animation state

Represents temporary visual settling:

- snap-back after release below threshold
- commit-settle after release above threshold
- optional blocked resistance animation

This should replace or subsume the current one-shot `animationDirection` bump.

## Sync policy

Add a public sync path that can safely be called from the frame/HUD update loop.

Suggested external shape:

- expose `touchControls.syncUi()` on the returned `TouchControls`
- have `hudPresentation.update()` or the main frame presentation path call it every frame
- keep DOM work cheap by skipping render if the computed selector render state has not changed

Suggested selector behavior:

- if no gesture or settling animation is active, apply the latest runtime snapshot immediately
- if a gesture is active, record the latest runtime snapshot but do not stomp the drag state
- if a snap/commit animation is active, either defer external replacement until the animation finishes or apply only if the runtime value changed in a way that invalidates the animation
- if reduced-motion is active, skip JS-managed settling animation and render the final valid state immediately

This gives the control frame-level freshness without making frame sync authoritative over local interaction state.

## Gesture policy

Recommended behavior:

- begin gesture: capture the runtime snapshot at gesture start
- move gesture: update drag progress and preview direction from `deltaY`
- below threshold: show partial movement toward the near preview and mark release as snap-back
- beyond threshold: show the near preview as the release target and mark release as commit
- release below threshold: do not dispatch runtime action; animate back to current committed value
- release beyond threshold: re-resolve against the latest runtime snapshot, then commit only if the intended target is still valid
- cancellation paths: `finishGesture(..., false)`, `touchcancel`, pinch takeover, and any forced clear must never dispatch a time-warp action

Commit should happen on release, not on threshold crossing.

Release-time commit must be target-safe:

- preferred: commit an absolute target value or target index through a runtime/policy API
- acceptable fallback: dispatch the relative action only if the latest runtime current value still equals the gesture-start current value
- if the latest runtime current value has changed, do not dispatch a relative action; snap or refresh to the latest valid runtime state instead
- blocked previews must never dispatch, even if the drag crosses the threshold

## External runtime changes during drag

If runtime time warp or constraints change while the user is dragging:

- keep the drag visual stable during the active gesture
- store the latest runtime snapshot in the model
- on release, resolve the action against the latest runtime state, not only the gesture-start state
- if the preview target or current value is no longer valid, snap back and refresh to the closest valid value

The "closest valid value" should be resolved by clamping to the currently valid time-warp range. In practice, use the same min/max and scenario/control constraints already represented by preview policy rather than inventing a second clamp rule in the view.

The current selector callback shape does not expose enough information to do this safely by itself. It has `getCurrentTimeWarp`, `getTimeWarpPreview`, and `getTimeWarpPreviews`, but not the configured ladder, current index, or a resolver for arbitrary target values. Do not fill that gap with view-local ladder math.

Recommended API direction:

- add a runtime/policy-level resolver that can answer whether a requested target value or index is still valid
- or add an absolute selector commit callback such as `commitTimeWarpTarget(valueOrIndex)` that returns the resolved committed value
- if that is too large for this pass, narrow the behavior to "snap back and refresh from the latest committed runtime value" rather than attempting nearest-value clamping in the view

Examples:

- if the user was previewing `x5m` and a scenario cap drops the max to `x1m`, release should not commit `x5m`; it should settle to `x1m` or the nearest valid current runtime value
- if active controls clamp warp while dragging, the selector should visually reconcile to the clamped valid value after release/cancel
- if the ladder bounds change, the selected/previewed value should clamp to the nearest available configured tier

## Suggested execution plan

### Phase 1: introduce selector runtime snapshot state

Goal:

- separate committed runtime state from gesture-local state

Acceptance criteria:

- selector model stores a runtime snapshot separately from animation/gesture state
- runtime snapshot records enough identity to detect stale commits, such as current value plus current index or an explicit revision token
- render output is unchanged or nearly unchanged
- existing selector tests still pass after being adapted to the new model shape
- no behavior change is required yet

### Phase 2: add safe frame sync

Goal:

- keep selector display synchronized with runtime changes outside the selector

Acceptance criteria:

- `TouchControls` exposes a `syncUi()` method
- frame/HUD update calls `touchControls.syncUi()`
- selector updates when runtime time warp changes outside the selector
- selector does not overwrite an active drag state during sync
- repeated sync without state changes does not cause unnecessary DOM churn
- sync can record a deferred runtime snapshot while dragging without changing the active drag visual

### Phase 3: change gesture commit semantics

Goal:

- switch from threshold-crossing commit to release-after-threshold commit

Acceptance criteria:

- crossing the threshold only changes preview state
- release beyond threshold commits only if the intended target is still valid against the latest runtime snapshot
- release below threshold does not dispatch
- blocked previews never dispatch
- release re-resolves against latest runtime/previews before committing
- relative `increaseTimeWarp` / `decreaseTimeWarp` dispatch is guarded against stale base values, or replaced with an absolute target commit path
- `finishGesture(..., false)` and all cancellation paths never dispatch a time-warp action

### Phase 4: implement continuous preview and snap animation

Goal:

- make the selector move smoothly between current and preview values

Acceptance criteria:

- drag progress is represented in render state
- CSS or view logic interpolates value positions using progress
- below-threshold release animates back to current value
- above-threshold release animates into the committed value
- reduced-motion mode avoids continuous/settling animation while preserving correctness
- reduced-motion is handled in the control/model path, not only by CSS transitions, so JS timers or animation states do not delay reconciliation

### Phase 5: add target-safe reconciliation if needed

Goal:

- avoid duplicated clamp logic while still handling runtime changes during a drag

Acceptance criteria:

- selector uses a runtime/policy resolver or absolute commit callback for target validation
- view code does not inspect or clamp against the configured time-warp ladder directly
- if no resolver is added, invalid release falls back to the latest committed runtime snapshot instead of guessing the nearest tier

## Testing strategy

Priority tests:

- selector sync updates current label when `getCurrentTimeWarp()` changes externally
- sync during an active gesture does not replace drag progress
- deferred external snapshot is applied after gesture cancel/release
- release below threshold does not call `commitTimeWarp`
- release above threshold calls `commitTimeWarp` once
- blocked preview above threshold does not commit
- runtime cap change during drag clamps/snap-refreshes to the nearest valid value
- presenter/view render drag progress and threshold state correctly
- release after runtime current value changes does not dispatch a stale relative action
- cancellation through `touchcancel` or `finishGesture(..., false)` never commits
- reduced-motion mode skips JS settling delays and immediately renders a reconciled state

Useful test locations:

- `tests/ui/touchControls/selectorTimeWarpControlPresenter.test.ts`
- add model tests for selector runtime/gesture state if none exist
- add or extend integration-style touch control tests if the project already has touch gesture coverage

## Review points

The main review points are:

- frame sync should be frequent but not destructive
- gesture state and runtime state should not be collapsed into one `currentValue`
- commit-on-release should not accidentally dispatch stale actions
- clamping should reuse runtime/preview policy rather than duplicating constraint rules in DOM code
- relative actions are unsafe after a delayed release unless guarded by the gesture-start runtime snapshot
- cancellation paths should be visually graceful but behaviorally non-committing
- reduced-motion behavior should remain functional and should not be delayed by JS animation timers

## Status

Ready for review by a higher model. The preferred direction is to split selector state first, then add safe frame sync, then implement release-to-commit snap animation.
