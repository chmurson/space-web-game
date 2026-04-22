# Touch controls interaction model refactor handoff

## Context

## Status

Resolved on 2026-04-22.

Moved to `ideas/resolved/` because the follow-up refactor landed:

- thrust and time-warp state rules were extracted into `src/ui/touchControls/touchInteractionModel.ts`
- touch gesture ownership is now explicit in `src/ui/touchControls/createTouchControls.ts`
- overlay clamping now uses measured element bounds

This handoff no longer represents active work.

The recent mobile control pass achieved the intended player behavior:

- double tap selects target heading
- left side owns time warp
- right side owns thrust
- pinch zoom and double-tap-drag zoom still work

That gameplay outcome is good. The implementation cost is that `src/ui/touchControls/createTouchControls.ts` now owns too many concerns at once:

- gesture recognition
- gesture conflict arbitration
- transient UI presentation state
- haptic timing
- time-warp preview and commit rules
- thrust latch and anchor behavior

The result is a file that is hard to reason about and easy to regress when tuning one interaction.

## Problem statement

The main issue is not only file size. The bigger issue is that gesture rules are encoded as overlapping mutable state with implicit coupling:

- `doubleTapZoom`
- `twoFingerGesture`
- `leftZoneGesture`
- `rightZoneGesture`
- `thrustState`
- `lastTap`
- `pinchSuppressTapUntil`

Several important invariants exist, but they are enforced by scattered conditionals instead of an explicit model:

- only one zone should own a single-finger gesture at a time
- pinch should preempt zone gestures
- thrust should not spawn while time-warp preview is active unless reusing a latched control
- time-warp should preview one step but commit only on release
- thrust anchor should stay stable once visible
- canceled touches should fully clear pending tap or gesture state

This makes regression risk high for future tuning.

## Refactor goals

### Primary goals

- separate gesture state from DOM updates
- make gesture ownership explicit
- isolate thrust behavior from time-warp behavior
- move preview and commit rules behind named functions
- reduce repeated cleanup logic in touch end and cancel paths

### Secondary goals

- remove magic layout constants where measurement is possible
- make interaction behavior easier to unit test without DOM-heavy integration tests
- make future mobile tuning local instead of cross-cutting

### Non-goals

- changing the player-facing gesture design again
- rewriting mobile controls into a framework
- merging mobile and desktop input systems

## Recommended target architecture

Split the current module into three layers.

### 1. Gesture session layer

A small state machine that consumes touch events and emits semantic intents such as:

- `start-time-warp-preview`
- `update-time-warp-preview`
- `commit-time-warp-preview`
- `cancel-time-warp-preview`
- `show-thrust`
- `update-thrust`
- `hide-thrust`
- `select-target-heading`
- `zoom-camera`

This layer should own gesture arbitration and tap timing, but not DOM mutation.

### 2. Interaction model layer

A pure-ish model that turns gesture intents into game-facing state:

- pending time-warp preview direction and target value
- thrust visibility, anchor, offset, and latched state
- haptic-worthy state transitions

This layer should expose plain state snapshots that are easy to test.

### 3. View layer

A thin DOM adapter that renders:

- time-warp feedback
- thrust hold indicator
- thrust control position, label, and thumb offset
- tutorial hint visibility

This layer should measure rendered elements for clamping instead of relying only on estimated half-width and half-height constants.

## Suggested implementation phases

## Phase 1: extract repeated teardown and UI sync helpers

Move repeated right-zone cleanup and time-warp cleanup into named helpers inside the existing file.

Acceptance criteria:

- `touchend` and `touchcancel` stop duplicating thrust teardown logic
- state reset paths have names that describe intent
- no behavior change

## Phase 2: extract a dedicated interaction model module

Suggested files:

- `src/ui/touchControls/touchInteractionModel.ts`
- `src/ui/touchControls/touchInteractionModel.test.ts`

The model should manage:

- thrust latch state
- thrust anchor and offset
- time-warp preview and commit eligibility
- gesture conflict rules that do not need direct DOM access

Acceptance criteria:

- `createTouchControls.ts` becomes mostly event wiring plus rendering
- thrust and time-warp rules gain direct unit coverage

## Phase 3: formalize gesture ownership

Replace the current many-nullable-state shape with an explicit active session model, for example:

```ts
type ActiveGestureSession =
  | { kind: 'none' }
  | { kind: 'double-tap-zoom'; touchId: number; startY: number; lastY: number }
  | { kind: 'pinch'; touchIds: [number, number]; lastDistance: number }
  | { kind: 'left-zone'; touchId: number; startX: number }
  | { kind: 'right-zone-pending'; touchId: number; startX: number; startY: number; holdTimer: number | null }
  | { kind: 'right-zone-active'; touchId: number; startX: number; startY: number; startLatched: boolean }
```

Exact structure can differ, but the important win is that ownership becomes explicit and impossible states become harder to represent.

Acceptance criteria:

- fewer cross-checks between unrelated nullable variables
- event handlers branch on one session shape rather than several partially overlapping flags

## Phase 4: replace estimated clamping with measured bounds

The overlay clamping currently relies on constants such as:

- `timeWarpFeedbackHalfWidthPx`
- `timeWarpFeedbackHalfHeightPx`
- `thrustControlHalfWidthPx`
- `thrustControlHalfHeightPx`

Replace those with measured DOM bounds after first render and when visibility changes.

Acceptance criteria:

- labels and thrust UI stay inside viewport based on actual rendered size
- magic sizing constants are reduced to spacing and fallback defaults only

## Testing strategy

Add focused tests around the new interaction model instead of trying to cover all touch behavior end to end.

Priority cases:

- left-zone preview commits only on release
- preview is capped to one time-warp step
- right-zone hold promotes to visible thrust control after delay
- latched thrust can be reused inside hit radius
- pinch preempts zone gestures
- cancel clears pending tap and gesture state
- resize preserves or intentionally clears overlay anchor behavior by explicit rule

## Recommended order

1. Phase 1 as a no-behavior-change cleanup.
2. Phase 2 to create a unit-testable model.
3. Phase 3 once the new model exists.
4. Phase 4 after behavior is stable.

## Expected payoff

If done well, this refactor should:

- cut the cognitive load of `createTouchControls.ts`
- make mobile tuning safer and faster
- reduce accidental regressions when changing one gesture rule
- improve confidence in future touch-control experiments
