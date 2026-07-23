# Automatic Target Trajectory Stability

## What Changed

- Automatic assist targeting now holds its current body while a long-horizon
  trajectory is rebuilding for that body.
- The trajectory runtime reports whether the far prediction belongs to the
  current prediction target. Short, non-split predictions remain complete
  without a far tier.
- Once the matching far prediction arrives, the existing trajectory-center
  comparison and switch hysteresis immediately resume. Initial selection also
  remains available before the first far prediction.
- Focused tests cover the automatic selection lifecycle and the target-matching
  prediction readiness signal.

## Why It Changed

The 48-hour prediction in the reported Earth-to-Moon save selected Moon. That
target change invalidated the target-specific far tier, temporarily leaving
only a synchronous 10-minute prediction that selected Earth. Switching back
then rebuilt the long prediction, which selected Moon again. Repeating this
feedback loop caused frame-frequency target/HUD flicker and hid the
target-relative trajectory whenever the selected target did not match the
prediction target.

## Key Files and Ownership

- `src/runtime/gameQueries.ts` owns the automatic target latch and existing
  switch hysteresis.
- `src/runtime/trajectoryPredictionRuntime.ts` owns whether a split prediction
  has a far tier for its current target.
- `src/app/createAppComponents.ts` connects prediction readiness to automatic
  target selection.
- `tests/runtime/gameQueries.test.ts` verifies that an incomplete replacement
  prediction cannot immediately reverse a completed automatic switch.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` verifies that target
  changes are incomplete until the matching far-worker result arrives.

## Important Decisions

- The fix gates target switching at the shared game-query boundary instead of
  debouncing HUD or trajectory presentation updates.
- The current target is resolved from the live simulation body list while held,
  so its moving position and velocity do not become stale.
- A cached far tier for the previous target does not count as complete. A
  matching retained-stale tier does count, preserving useful automatic
  selection during ordinary prediction refresh coalescing.
- No new timer, switch threshold, dependency, or UI state was introduced.

## Validation

- Focused Vitest coverage passed: 3 files / 57 tests across game queries,
  trajectory runtime, and the DevTools bridge.
- The supplied `tmp/trajecotory-flickering-snaphost.json` replay remained on
  Moon across 40 samples over two seconds with 960 rendered prediction points.
  Far visibility remained current and refreshes settled to 2–4 ordinary
  timed/spacecraft/body updates per second instead of recurring target changes.
- The replay screenshot showed the Moon target pill, a visible prediction
  trajectory, and matching Moon debug state.
- Full product Vitest coverage passed: 64 files / 628 tests.
- All 16 automation task-claim tests passed.
- The release build passed, including configuration validation, TypeScript,
  and the Vite release bundle. Vite emitted only its existing large-chunk
  advisory.
- The aggregate `npm test` command remains red because the unchanged
  automation-workflow suite passes 2/3 tests and expects a missing
  `rocket`-reaction policy sentence in
  `docs/automation-prompts/engineer-workflow.md`. This is a current-`main`
  baseline failure unrelated to the targeting changes.
- Focused Biome checks and `git diff --check` passed.

## Follow-Ups and Known Gaps

- A long-horizon automatic target now remains on its current body if a matching
  far-worker prediction cannot complete. This is the intentional fail-stable
  behavior; normal switching resumes immediately after recovery.
- The unrelated automation-workflow policy/test mismatch remains outside this
  fix.
