# Mobile interface controls

## Context
The game should have a mobile control scheme that preserves the same core flight loop as desktop, but without visible joysticks and with large forgiving touch zones.

This version uses the top-swipe time control approach.

## Final spec

### Direction / rotation
- Double tap on the map sets target direction
- Spacecraft rotates smoothly toward that point

### Thrust
- Right 30–40% of screen
- Press and hold => thrust on
- Release => thrust off, drift continues

### Fine rotation
- Left 30–40% of screen
- Swipe left/right => incremental rotation adjustments
- Must work simultaneously with thrust

### Time control
- Top-left 40% strip
- Swipe up => increase time speed
- Swipe down => decrease time speed

Behavior:
- Continuous while dragging
- Current speed remains after release
- Uses the already implemented time warp steps
- Shows snap behavior between supported steps
- Strong swipes may jump 2–3 steps at a time

## Layout
- Center: gameplay area / double tap to orient
- Left: rotation swipe zone
- Right: thrust hold zone
- Top: time swipe zone
- Start with an educated-guess safe zone for iOS and Android top gestures

## Rules
- All inputs can work simultaneously
- No visible joysticks
- Touch zones should be large and forgiving
- Avoid conflict with OS edge gestures, especially near the top edge
- Prefer generous safe padding from the top-left system gesture area
- Use haptic feedback wherever supported on the web

## Core loop
1. Double tap to set direction
2. Hold right side to thrust
3. Swipe left/right on left side for fine heading adjustment
4. Swipe top area up/down to control time speed
5. Release thrust and continue drifting

## Status
Implementation-ready concept
