# Trajectory rendering: endpoint marker mismatch

## Status
Resolved in initial POC.

Moved to `ideas/resolved/` because the issue has a confirmed fix and the original reproduction no longer requires follow-up.

## Context
The trajectory endpoint marker is visible, but the trajectory line does not visually reach the marker.

This was observed while testing an almost straight-line travel path, where the trajectory does not loop over itself.

## Problem
The rendered line appears to stop before the endpoint marker. In this case, the issue is not caused by the line crossing or overwriting itself.

## Resolution
Fixed in the initial POC implementation.

The visible mismatch was caused by reusing the same Three.js `LineGeometry` instance while changing the trajectory point count. The JavaScript-side geometry state could report the expected endpoint and segment count, but the rendered line could still behave like an older, shorter instanced line buffer after runtime horizon changes.

The fix is to replace dynamic prediction `LineGeometry` instances on trajectory updates instead of mutating the existing geometry in place:

- create a fresh `LineGeometry`
- set the new positions/colors
- dispose the old geometry
- assign the new geometry to the `Line2`
- recompute line distances

This makes runtime trajectory recalculation behave like a clean reload, which was the state where the mismatch did not reproduce.

## Verified Behavior
Trajectory rendering now satisfies:

- the line reaches the endpoint marker
- the endpoint marker visually belongs to the trajectory
- crash endpoint rendering still works
- loop trimming does not affect near-straight trajectories

## Investigation Notes
- Dashed line phase was suspicious, but was not the root cause of the runtime mismatch.
- Debug captures showed the final line geometry endpoint and marker position matched exactly.
- The line geometry was not missing the final predicted point.
- Loop trimming did not fire for the reproduced near-straight/crash trajectory.
- The marker and line used the same target-relative transform.
- Reloading fixed the visual because it recreated Three.js line geometry from scratch.
