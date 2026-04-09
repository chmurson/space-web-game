# Auto target switching by surface distance

## Context
Current/future auto target switching should not be based on strongest gravity influence. Early tests suggest distance-based target switching may feel better.

## Proposal
Switch the selected target based on distance to the nearest surface, not distance to the center of the body.

Use:

```text
surfaceDistance = max(0, distanceToCenter - bodyRadius)
```

Auto switching should have a threshold based on body size:

```text
switchRange = bodyRadius * X
```

Initial value to test:

```text
X = 20..50
```

## Hysteresis / anti-flicker rule
If two bodies are both relatively close, do not auto-switch too eagerly.

Example:

```text
body A: 20x radius away
body B: 50x radius away
```

In this kind of situation, allow the player to switch manually between them and avoid automatic switching.

The difference must be much larger before auto-switching happens.

## Possible rule
Only auto-switch if the new target is clearly dominant, for example:

```text
newNormalizedDistance < currentNormalizedDistance * 0.5
```

Where:

```text
normalizedDistance = surfaceDistance / bodyRadius
```

This means the new body must be at least 2x closer in radius-scaled terms before auto-switching.

## Open questions
- What should the first `X` value be: 20, 30, 50?
- Should auto-switching happen only when assist is off?
- Should manual target selection lock the target for some time?
- Should the HUD show when auto-targeting is paused due to ambiguity?

## Status
Rough / promising
