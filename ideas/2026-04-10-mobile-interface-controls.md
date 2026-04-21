# Mobile interface controls

## Context

The mobile controls shipped once already, but the note below was left behind in an older state.

The code today does not match the old "top swipe for time, left swipe for rotation, hold anywhere for thrust" description cleanly enough to keep using that as the source of truth.

This note now serves two purposes:

- record what is already implemented
- replace the current control direction with the new side-based plan

## Current state in code

### Implemented today

- Double tap sets a target heading.
- The spacecraft rotates smoothly toward that target heading and clears it once aligned.
- Touch press-and-hold enables main thrust after a short hold delay.
- Single-finger horizontal drag nudges target heading in steps.
- Single-finger vertical drag changes time warp in discrete steps.
- Pinch zoom and double-tap-drag zoom are implemented on touch devices.
- Keyboard `A`/`D` and `ArrowLeft`/`ArrowRight` still provide manual turning.

### Not implemented today

- Right-side-only thrust interaction.
- A visible round thrust control that can be snapped on and left visible.
- Left-side horizontal time-warp control.
- Floating `>> x10` / `<< x10` time-warp feedback that tracks the gesture and fades away.
- Heading visualization for double-tap targeting:
  - dashed line from spacecraft to tapped point
  - shrinking circle slice from current heading to desired heading
- Removal of slide-based rotation.
- Removal of left/right key-based manual rotation.

## Updated high-level plan

This replaces the old mobile scheme.

### Rotation

- Rotation target is set only by double tap on the gameplay area.
- Swipe-based heading nudging is removed.
- Left/right keyboard turning is removed as part of the same control simplification.
- After double tap, show a dashed line from the spacecraft to the tapped location.
- Also show a circle slice that starts at current heading and ends at desired heading.
- As the spacecraft rotates, the slice should close and shrink with the remaining heading error.
- When the spacecraft reaches the target heading and the target clears, both visuals disappear.

### Thrust

- The right side of the screen is reserved for thrust interaction.
- Touching the right side spawns a round thrust control a little above the touch point.
- Sliding upward while keeping contact on the right side snaps the control into the ON position.
- This should feel like a vertical iOS-style toggle, but with an actual drag gesture required.
- When ON, thrust remains active after release and the button stays visible.
- When the visible ON button is touched and slid down, it snaps into the OFF position.
- When OFF, releasing touch hides the control.
- When the control is hidden and the user starts again, the control appears slightly above the new touch point.

### Time warp

- The left side of the screen is reserved for time-warp changes.
- Sliding right increases time pace.
- Sliding left decreases time pace.
- Time warp still snaps to the already supported discrete warp steps.
- A transient feedback element follows the gesture and shows either `>> x10` or `<< x10`.
- That feedback fades away after the interaction ends.

### Interaction rules

- Thrust and time-warp interactions should still be able to exist on opposite sides of the screen without visible joystick UI.
- Double tap for heading selection should continue to work across the gameplay area.
- Touch zones should stay generous and forgiving.
- Safe-area padding still matters near OS gesture edges.
- Haptics should remain where the platform supports them.

## Consequences of this plan

- The currently shipped touch control state machine in `src/ui/touchControls/createTouchControls.ts` is no longer the target design.
- The current "manual turn cancels target heading" path stays relevant for autopilot logic, but manual turn input itself should stop being exposed to the player.
- This change affects both mobile gesture behavior and desktop/manual keyboard turning unless that keyboard removal is explicitly deferred.

## Implementation plan

### 1. Rewrite touch interaction ownership around explicit left/right zones

Touch first:

- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/touchControls.css`

Work:

- Replace the generic full-screen drag interpretation with explicit side-based gesture routing.
- Keep double-tap heading selection.
- Keep pinch zoom and double-tap-drag zoom unless they conflict with the new scheme.
- Remove horizontal swipe heading nudging.
- Replace vertical single-finger time-warp stepping with left-side horizontal stepping.
- Add the sticky thrust button state machine on the right side.
- Make the thrust button persist only while snapped ON.
- Add transient time-warp feedback that follows the gesture and fades after release.

Do not:

- redesign the existing time-warp values
- redesign assist-mode logic
- bundle unrelated HUD cleanup into this pass

### 2. Remove manual left/right turn as a player input

Touch next:

- `src/input/keyboardInput.ts`
- `src/runtime/simulationStep.ts`
- related tests

Work:

- Stop exposing `A`/`D` and `ArrowLeft`/`ArrowRight` as player turn input.
- Make sure touch controls also stop using any virtual left/right turn path.
- Preserve target-heading rotation and assist-driven rotation.
- Preserve the existing physics-side `controls.turn` field because autopilot still needs it.

Important:

- This is an input-policy change, not a simulation-model rewrite.
- Avoid broad refactors that remove `turn` from simulation state entirely.

### 3. Add heading-target visualization for the double-tap flow

Touch next:

- `src/ui/overlayUI/createOverlayUi.ts`
- `src/presentation/spacecraftPresentation.ts`
- `src/style.css`

Work:

- Add overlay elements for:
  - a dashed line from spacecraft screen position to the selected tap point
  - an arc or circle-slice indicator for current heading vs target heading
- Keep the visuals visible only while `targetHeading !== null`.
- Make the arc shrink as the spacecraft heading approaches the target heading.
- Remove the visuals immediately once target heading clears.

Recommended implementation detail:

- Keep thrust-button and time-warp feedback UI owned by `src/ui/touchControls/*`.
- Keep world-linked heading visuals owned by presentation/overlay code, because they depend on spacecraft screen position and live heading.

### 4. Add focused tests for the risky behavior changes

Touch next:

- `src/input/keyboardInput.ts` tests if present, otherwise add a focused test file
- `src/runtime/simulationStep.test.ts`
- touch-control tests if practical in the current DOM test setup

Work:

- Verify double tap still sets target heading.
- Verify manual turn keys no longer produce player turn input.
- Verify target-heading rotation still completes and clears.
- Verify time warp still steps through supported values in the new left/right gesture direction.
- Verify thrust snap-on / snap-off state survives release exactly as designed.

Important:

- Prefer testing behavior through public entry points.
- Do not widen module APIs only to make gesture tests easier.

## Smaller-model handoff

Give the smaller model this scope and these guardrails:

- Own `src/ui/touchControls/createTouchControls.ts` and `src/ui/touchControls/touchControls.css` first.
- Implement the right-side sticky thrust control and left-side horizontal time-warp feedback before touching heading visualization.
- Do not remove pinch zoom or double-tap heading selection unless a concrete conflict is found.
- Do not refactor runtime architecture while doing input changes.
- After touch input is stable, touch `src/input/keyboardInput.ts` only to remove player-facing manual turn bindings.
- Leave autopilot and assist rotation behavior intact.
- Only after input behavior is stable, add the heading overlay pieces in `src/ui/overlayUI/createOverlayUi.ts`, `src/presentation/spacecraftPresentation.ts`, and `src/style.css`.

Suggested delivery order:

1. Touch gesture rewrite plus thrust/time-warp UI.
2. Manual-turn input removal.
3. Heading arc and dashed-line visualization.
4. Focused tests and polish.

Acceptance checklist:

- Double tap is the only player-facing way to request rotation.
- Swipe rotation is gone.
- Left/right keys no longer turn the spacecraft.
- Right-side thrust can be toggled on with an upward slide and off with a downward slide.
- OFF hides the thrust control after release.
- Left-side horizontal slide changes time warp and shows fading directional feedback.
- Dashed line and shrinking heading slice appear during target-heading rotation and disappear on completion.

## Status

Needs implementation.
This note supersedes the older mobile-control spec in this file.
