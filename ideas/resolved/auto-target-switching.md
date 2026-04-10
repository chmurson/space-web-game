# Auto target switching

## Context

Auto target switching used to be based on strongest gravity influence. That did not feel right enough in practice, especially when several bodies were nearby and the desired target was more about trajectory context than raw gravity share.

This idea started as a surface-distance based switcher, but testing showed that a purely radial distance heuristic was still too limited. It did not account for cases where the predicted path bends around a body and returns elsewhere.

## What was tried

### 1. Strongest gravity influence

This was the original behavior.

Problem:

- not aligned with what the player usually cares about visually or navigationally
- could choose a body that was dynamically dominant but not the body the trajectory was meaningfully heading toward

### 2. Surface-distance normalization

Tried rule:

```text
surfaceDistance = max(0, distanceToCenter - bodyRadius)
normalizedDistance = surfaceDistance / bodyRadius
```

Also tried variants with transformed normalization.

Problem:

- better than gravity influence in some cases
- still too local to the current spacecraft position
- did not capture where the current trajectory was actually going

### 3. Start/end midpoint of predicted trajectory

Tried rule:

- take current ship position
- take predicted trajectory end
- compute the midpoint between them
- pick the body closest to that midpoint

Problem:

- too lossy for curved paths
- bad when the trajectory loops or bends around a body and ends elsewhere

## Final approach

Use the whole predicted trajectory, not just ship position or end position.

The game now computes a simplified center of the predicted path by treating the trajectory as a set of line segments and finding a weighted balance point.

For each segment:

```text
segmentMid = (segmentStart + segmentEnd) / 2
segmentLength = length(segmentEnd - segmentStart)
```

Then:

```text
trajectoryCenter = sum(segmentMid * segmentLength) / sum(segmentLength)
```

This means:

- every segment contributes
- longer segments matter more than short ones
- curved paths influence the center according to the actual path shape

This gave the best feel so far in manual testing.

## Switching rule

Bodies are compared by plain center distance to `trajectoryCenter`.

The closest body becomes the candidate target.

To avoid flicker, the current target is kept unless the new candidate is clearly better.

Current rule:

```text
newDistance * switchRangeMultiplier < currentDistance
```

Current tuning:

```text
switchRangeMultiplier = 1.2
```

Interpretation:

- `1.0` means switch as soon as a new body becomes even slightly closer
- higher values make switching stickier
- with `1.2`, a new candidate must be meaningfully closer before the switch happens

## Runtime behavior

- target selection is refreshed from trajectory prediction data
- prediction currently refreshes every `0.4s`
- debug JSON shows the computed `trajectoryCenter` and per-body distances to it

## Notes

- the old `switchDominanceFactor` concept was removed
- the current heuristic is intentionally simple and testable
- this is still heuristic behavior, not a physically "correct" targeting model

## Status

Resolved for now. This is the best version tested so far and a reasonable baseline for future tuning.
