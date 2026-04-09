# Trajectory rendering: endpoint marker mismatch

## Context
The trajectory endpoint marker is visible, but the trajectory line does not visually reach the marker.

This was observed while testing an almost straight-line travel path, where the trajectory does not loop over itself.

## Problem
The rendered line appears to stop before the endpoint marker. In this case, the issue is not caused by the line crossing or overwriting itself.

## Proposal
Investigate trajectory rendering so that:

- the line reaches the endpoint marker
- the endpoint marker visually belongs to the trajectory
- crash endpoint rendering still works
- loop trimming does not affect near-straight trajectories

## Open questions
- Is the issue caused by dashed line distance calculation?
- Is the endpoint marker using the final predicted point while the line geometry is missing that point?
- Is the line being trimmed too early?
- Is the marker rendered at a different target-relative transform than the line?

## Status
Rough / needs investigation
