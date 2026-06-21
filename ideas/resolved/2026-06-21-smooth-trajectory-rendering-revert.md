# Smooth trajectory rendering revert

## Status
Resolved by reverting `1107055`.

## Context
Commit `1107055` introduced smooth trajectory tip rendering so newly refreshed
prediction lines would blend and reveal their endpoints gradually.

After comparing staging builds around the trajectory changes, the smoother
presentation was not the desired baseline for the current trajectory behavior.
The branch `codex/revert-smooth-trajectory-rendering` restores the direct
prediction-line rendering path.

## Resolution
Reverted `1107055` with commit `ad8824e`.

The revert removes the smoothing helper and test coverage that were specific to
the blended/revealed tip behavior. The trajectory presentation now renders the
current target-relative prediction points directly again, including the endpoint
marker and impact gradient.

## Follow-Up Criteria
If trajectory smoothing is reconsidered later, it should come back with a
specific reproduction case and visual comparison coverage for:

- short and long prediction horizons
- high time-warp refresh cadence
- endpoint marker alignment
- desktop and mobile viewport screenshots

## Status Note
This note is resolved because the current branch intentionally rolls back the
smooth tip behavior instead of iterating on it.
