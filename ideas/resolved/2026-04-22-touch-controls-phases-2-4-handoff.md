# Touch controls refactor handoff for Phases 2-4

This document assumes Phase 1 is already done.

## Status

Resolved on 2026-04-22.

Moved to `ideas/resolved/` because Phases 2 through 4 landed:

- `src/ui/touchControls/touchInteractionModel.ts` now owns thrust and time-warp interaction state
- `src/ui/touchControls/createTouchControls.ts` now uses an explicit active gesture session model
- overlay clamping now measures rendered bounds instead of relying only on fixed half-size constants

This handoff no longer represents active work.

The Phase 1 cleanup appears to be present in `src/ui/touchControls/createTouchControls.ts`:

- named teardown helpers now exist for left and right zone cleanup
- `touchend` and `touchcancel` no longer duplicate the full thrust teardown path
- current helper names include:
  - `finishLeftZoneGesture`
  - `restoreThrustUiFromLatchState`
  - `clearRightZoneGesture`
  - `clearZoneGestures`

That means the next worker should not redo Phase 1. The remaining job is to extract the interaction model, formalize gesture ownership, and replace estimated overlay clamping with measured bounds.

## Goal

Keep the current player-facing mobile behavior the same while making the touch code easier to reason about and easier to test.

Do not redesign the controls. Do not widen the public API of `createTouchControls`. Do not merge mobile and desktop input systems.

## Current behavior that must stay the same

- double tap selects target heading
- double-tap-drag zoom still works
- pinch zoom still works
- left side controls time warp preview and commits on release
- right side controls thrust
- thrust can latch
- latched thrust can be reused near the visible control
- pinch preempts single-finger zone gestures
- touch cancel clears pending gesture and tap state

## Current implementation hotspots

The remaining coupling is still concentrated in `src/ui/touchControls/createTouchControls.ts`.

State that is still spread across overlapping nullable variables:

- `doubleTapZoom`
- `twoFingerGesture`
- `leftZoneGesture`
- `rightZoneGesture`
- `thrustState`
- `lastTap`
- `pinchSuppressTapUntil`

Important logic still mixed together in one module:

- gesture recognition
- gesture ownership and arbitration
- thrust latch rules
- time-warp preview and commit rules
- haptic decisions
- DOM rendering and overlay clamping

## Recommended work split

Do the remaining work in this order:

1. Phase 2: extract `touchInteractionModel.ts` with tests.
2. Phase 3: replace multi-variable gesture ownership with an explicit session model.
3. Phase 4: move overlay clamping to measured bounds instead of fixed half-size constants.

Do not attempt all three phases in one giant rewrite. Keep behavior stable between steps.

## Phase 2: extract interaction model

### Target files

- `src/ui/touchControls/touchInteractionModel.ts`
- `src/ui/touchControls/touchInteractionModel.test.ts`

### Purpose

Move thrust and time-warp behavior rules into a testable module that does not touch the DOM directly.

`createTouchControls.ts` should still own:

- DOM creation
- DOM event listeners
- reading touch coordinates
- calling `options.onZoom`
- calling `options.onTargetHeadingSelected`
- scheduling the right-zone hold timer for now

The new interaction model should own:

- time-warp preview state
- whether a preview can commit
- thrust visible state
- thrust engaged state
- thrust latched state
- thrust anchor position
- thrust thumb offset
- whether a state transition should trigger haptics

### Suggested model shape

Use plain data and named event methods. One workable shape is:

```ts
export type TimeWarpAction = 'increaseTimeWarp' | 'decreaseTimeWarp'

export type TouchOverlayPoint = {
  x: number
  y: number
}

export type TimeWarpPreviewState = {
  action: TimeWarpAction | null
  opacity: number
  visible: boolean
  value: number | null
}

export type ThrustVisualState = {
  anchor: TouchOverlayPoint
  engaged: boolean
  latched: boolean
  offset: number
  visible: boolean
}

export type TouchInteractionSnapshot = {
  thrust: ThrustVisualState
  timeWarp: TimeWarpPreviewState
  shouldPulseHaptics: boolean
}

export type TouchInteractionModel = {
  cancelTimeWarpPreview(): TouchInteractionSnapshot
  commitTimeWarpPreview(): {
    action: TimeWarpAction | null
    snapshot: TouchInteractionSnapshot
  }
  getSnapshot(): TouchInteractionSnapshot
  hideThrust(): TouchInteractionSnapshot
  reuseLatchedThrust(startLatched: boolean): TouchInteractionSnapshot
  setPendingThrustAnchor(anchor: TouchOverlayPoint): TouchInteractionSnapshot
  showThrust(anchor: TouchOverlayPoint): TouchInteractionSnapshot
  updateThrustDrag(params: {
    currentY: number
    startLatched: boolean
    startY: number
  }): TouchInteractionSnapshot
  updateTimeWarpPreview(params: {
    action: TimeWarpAction
    canCommit: boolean
    opacity: number
    value: number
  }): TouchInteractionSnapshot
}
```

The exact API can differ, but keep it small and state-based. The important part is that `createTouchControls.ts` stops directly mutating `thrustState` and left-zone preview fields all over the file.

### Phase 2 implementation notes

- Keep `createTouchControls` options unchanged.
- Keep `tapTouches`, `lastTap`, `doubleTapZoom`, and pinch tracking local for now.
- Move current thrust constants and rules into the model where practical:
  - `thrustControlTravelPx`
  - `thrustSnapDistancePx`
- Keep DOM-specific clamp logic outside the model for now.
- Keep the hold timer in `createTouchControls.ts` for Phase 2, but when the timer fires it should call a named model method instead of mutating `thrustState` inline.
- `commitTimeWarp` should still be called from `createTouchControls.ts`. The model should return whether there is a commit-worthy action instead of dispatching it directly.
- Haptics should be driven by model transitions, not by scattered conditionals.

### Phase 2 tests to add first

Add focused unit tests for the model:

- left-zone preview stays non-committable until opacity reaches full threshold
- left-zone preview can commit one step and returns the correct action on release
- preview hides cleanly on cancel
- showing thrust makes the control visible without forcing engagement
- dragging upward past the snap distance latches thrust on
- dragging back down from a latched start can unlatch if moved far enough
- hiding thrust preserves a latched control only when current behavior expects it
- reusing a latched control starts from the latched offset

Prefer straightforward data assertions over DOM-heavy tests.

## Phase 3: formalize gesture ownership

### Target files

- update `src/ui/touchControls/createTouchControls.ts`
- add `src/ui/touchControls/touchGestureSession.ts` only if the extracted type logic becomes clearer there

### Purpose

Replace overlapping gesture flags with one explicit active session state so event handlers stop cross-checking unrelated variables.

### Suggested session shape

Use a discriminated union similar to:

```ts
type ActiveGestureSession =
  | { kind: 'none' }
  | { kind: 'double-tap-zoom'; touchId: number; startY: number; lastY: number; zooming: boolean }
  | { kind: 'pinch'; touchIds: [number, number]; lastDistance: number }
  | { kind: 'left-zone'; touchId: number; startX: number }
  | {
      kind: 'right-zone-pending'
      touchId: number
      startX: number
      startY: number
      holdTimer: number | null
    }
  | {
      kind: 'right-zone-active'
      touchId: number
      startX: number
      startY: number
      startLatched: boolean
    }
```

Exact fields can differ. What matters:

- there is one authoritative gesture owner
- impossible combinations are hard to represent
- pinch is an explicit session, not a side flag
- right-zone pending and right-zone active are distinct states

### Phase 3 implementation notes

- `tapTouches` and `lastTap` can stay separate from the active session if that is simpler.
- You can still keep a short-lived separate `pinchSuppressTapUntil` timestamp if needed.
- Session transitions should be named and local:
  - begin left-zone session
  - begin right-zone pending session
  - promote pending thrust session to active
  - begin pinch session
  - clear active session
- `touchstart`, `touchmove`, `touchend`, and `touchcancel` should branch primarily on the session `kind`, not on several nullable variables.
- When pinch begins, it should explicitly cancel left and right zone work through named helpers.
- When cancel occurs, clear both the active session and any pending tap state.

### Phase 3 acceptance checks

- no separate `leftZoneGesture` and `rightZoneGesture` top-level mutable variables
- no separate `twoFingerGesture` top-level mutable variable
- fewer early-return branches that are only protecting against overlapping impossible states
- event handlers read more like a small state machine than a bag of conditionals

## Phase 4: measured overlay bounds

### Purpose

Replace estimated half-width and half-height constants with measured DOM bounds when positioning the time-warp label and thrust control.

### Current constants to remove or demote

- `timeWarpFeedbackHalfWidthPx`
- `timeWarpFeedbackHalfHeightPx`
- `thrustControlHalfWidthPx`
- `thrustControlHalfHeightPx`

Keep spacing constants like `screenEdgePaddingPx`. Keep fallback values only if needed before first measurement.

### Recommended approach

- Add a small measurement helper in `createTouchControls.ts` or a separate view helper module.
- Measure `getBoundingClientRect()` from the actual rendered elements.
- Re-measure:
  - after the controls mount
  - after visibility changes for the thrust control
  - after text content changes for time-warp feedback
  - on resize if needed
- Clamp using measured width and height divided by two.

### Good-enough view helper shape

```ts
type OverlaySize = {
  halfWidth: number
  halfHeight: number
}

const measureOverlaySize = (element: HTMLElement, fallback: OverlaySize): OverlaySize => {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return fallback
  }

  return {
    halfWidth: rect.width / 2,
    halfHeight: rect.height / 2,
  }
}
```

If measuring hidden elements is unreliable, make the helper resilient:

- measure after the element becomes visible
- retain the last known non-zero size
- fall back to conservative defaults only before the first successful measurement

### Phase 4 acceptance checks

- overlay positions are based on actual rendered element size
- magic half-size constants are gone or only used as pre-measure fallback
- thrust control and time-warp label stay inside the viewport based on real dimensions

## Constraints for the worker

- Preserve the existing exported `TouchControls` type and `createTouchControls` function signature.
- Do not move game logic into the DOM layer.
- Do not add tests that require exporting internal helpers only for test access.
- Prefer testing through the new model's public methods.
- Keep comments sparse and only where the state transition logic is not obvious.

## Verification expectations

After code changes, run:

```sh
npm test -- src/ui/touchControls/touchInteractionModel.test.ts
npm run build
```

If the full touch refactor changes runtime behavior or shipped UI, deploy because this repository is currently on `main`:

```sh
npm run deploy:netlify
```

Share the production URL after deploy.

## Definition of done

The work is done when all of the following are true:

- `createTouchControls.ts` is materially smaller and mostly handles event wiring plus view updates
- thrust and time-warp behavior rules live in a dedicated tested model
- gesture ownership is explicit instead of spread across overlapping nullable state
- overlay clamping uses measured bounds
- tests and build pass
- deploy is completed if executable app code changed

## Paste-ready brief for a simpler model

Use this if you want to hand the task to a smaller model:

```md
Continue the touch-controls refactor starting after Phase 1.

Read:
- ideas/2026-04-22-touch-controls-interaction-model-refactor-handoff.md
- ideas/2026-04-22-touch-controls-phases-2-4-handoff.md
- src/ui/touchControls/createTouchControls.ts

Scope:
- Do Phase 2, then Phase 3, then Phase 4.
- Preserve current player-facing touch behavior.
- Do not redesign controls or change the `createTouchControls` public API.

Required outcomes:
- extract a tested `src/ui/touchControls/touchInteractionModel.ts`
- move thrust and time-warp state rules into that model
- replace overlapping gesture flags with one explicit active session model
- replace fixed overlay half-size constants with measured DOM bounds

Verification:
- run `npm test -- src/ui/touchControls/touchInteractionModel.test.ts`
- run `npm run build`
- because branch is `main`, deploy with `npm run deploy:netlify` if executable app code changed
```
