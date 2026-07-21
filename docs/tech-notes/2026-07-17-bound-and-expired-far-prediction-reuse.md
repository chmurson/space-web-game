# Bound and Expired-Metadata Far Prediction Reuse

> Follow-up: `2026-07-21-bound-reuse-continuity.md` replaces deferred validation with validation and seam checks on every reuse, and adds a speed-relative bound-orbit position tolerance. The cadence and tolerance details below describe the earlier implementation.

## What Changed

- Passive-coast far prediction reuse now supports stable bound trajectories whose full prediction stops at the configured angular loop limit.
- Reuse measures angular travel across the retained target-relative samples and integrates only enough new tail to restore the remaining loop-revolution budget.
- Coast samples now retain the closest approach found inside each sampling interval. Rolling a path discards elapsed interval metadata and rebuilds a partially elapsed first interval from the live state when needed.
- Elapsed closest-approach and event-marker metadata no longer force a full calculation. Closest approach and orbit event markers are rebuilt for the retained-plus-extended future window.
- Reuse diagnostics now report trimmed, retained, and extended portions in both sample points and simulated seconds. The DevTools panel keeps the latest 100 far-prediction results in its in-memory snapshot history and displays the newest 24.
- Passive-coast reuse validates the first reuse after a full calculation and then every fourth reuse; skipped rolls preserve the last validated state so the next validation covers the full unchecked interval. A named sixteen-reuse cap forces a full calculation regardless.
- `state-diverged` fallbacks now include a specific validation, seam, or extension reason plus the measured deltas and active tolerances. Validation records include spacecraft errors and the maximum absolute body-position and body-velocity errors, making the next optimization choice evidence-based without changing reuse behavior.
- Close bound-orbit validation now uses the live simulation's one-second physics-step cap, and short bound seam reconstruction uses the same cap at any orbital radius. Distant validation keeps its cheaper configured cap.
- Divergence records include explicit target-body and spacecraft-to-target relative position and velocity deltas. These measurements are marked informational and do not gate reuse yet.

## Why It Changed

The first passive-coast reuse implementation deliberately fell back for every bound path and whenever cached metadata moved behind the rolling window. Hands-on testing showed that those exclusions covered two common cases: orbiting a body and coasting outward on a long escape trajectory. The worker therefore reported `loop-trim-risk` or `expired-metadata` much more often than `trim-extend`, even when most of the future path remained compatible.

Follow-up orbit testing showed that close-orbit validation was comparing the live simulation's one-second integration against an eight-second validation integration, producing repeated 5–43 km spacecraft-position errors. Long-orbit tests also isolated inexpensive, one-sample seam mismatches from costly multi-day validation drift.

## Key Files and Ownership

- `src/prediction/trajectoryPrediction.ts` owns interval-local closest-approach metadata alongside the existing coast samples and full-result metadata.
- `src/prediction/farTrajectoryPrediction.ts` owns elapsed metadata removal, short seam reconstruction, retained angular-travel measurement, remaining loop-budget extension, and composed diagnostics.
- `src/runtime/trajectoryPredictionRuntime.ts` carries bounded far-reuse diagnostic history to DevTools without retaining trajectory geometry.
- `extension/space-web-game-devtools/` renders the current split and the recent history, including point-share comparisons for the old and current paths.
- `tests/prediction/farTrajectoryPrediction.test.ts` covers bound loop reuse, non-sample-aligned expired closest-approach reuse, expired event removal, baseline agreement, and retained conservative fallbacks.

## Important Decisions

- Bound reuse is allowed only while the cached and live requests agree on whether loop trimming applies. Crossing between bound and unbound stopping policies still falls back with `loop-trim-risk`.
- Retained angular travel is measured from the live target-relative start through the retained samples. The extension receives only the remaining configured loop angle and still stops on a sample boundary, matching the full predictor's existing loop-limit behavior.
- Each sample owns the closest approach found during its integration interval. This avoids approximating retained-middle closest approach from point density alone.
- If elapsed time cuts through the first retained interval and its closest approach is no longer valid, the worker integrates only from the live state to that first retained sample. The seam must end close to the cached point or reuse falls back with `state-diverged`.
- Expired orbit markers are dropped and markers are recomputed from the composed future samples. Cached paths that already contain an impact remain non-reusable.
- Existing compatibility, state-continuity, elapsed-window, and retained-point-count gates remain unchanged.
- `validateEveryConsecutiveCoastReuses` and `maxConsecutiveCoastReusesBeforeFullRecalculation` are intentionally adjacent constants in the far predictor so profiling can tune the performance/correctness trade-off without altering the reuse algorithm.
- Validation duration is reported independently from the current trim duration because a scheduled validation can cover multiple reuse intervals.
- Divergence classification reports the largest tolerance-relative numeric validation error after structural checks such as body count and body identity. It records all available validation measurements, not only the dominant one.
- Target-relative measurements are observational only and are labeled `info` in DevTools. They are collected before considering any target-relative or orbit-scaled tolerance policy.
- One-second validation is limited to close bound trajectories; applying it to multi-day distant validation could cost more than a full configured-step calculation. One-second seam reconstruction is safe at any bound radius because the seam spans at most one output-sample interval.
- Validation cadence and continuity tolerances remain unchanged.

## Validation

- `npx --no-install vitest run --config vite.config.ts tests/prediction/farTrajectoryPrediction.test.ts tests/prediction/trajectoryPrediction.test.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/ui/hudText.test.ts tests/presentation/trajectoryPresentation.test.ts` (6 files / 108 tests)
- `npx --no-install tsc --noEmit`
- `npx --no-install biome check src/prediction/farTrajectoryPrediction.ts src/prediction/trajectoryPrediction.ts tests/prediction/farTrajectoryPrediction.test.ts`
- `npm test` (63 Vitest files / 570 tests, 16 automation-claim tests, and 3 automation-workflow tests)
- `npm run build`
- `npm run test:gui` (63 Playwright tests)
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; the trajectory remained continuous and coherent through the Earth/Moon debug scene.
- `git diff --check`

## Follow-Ups and Known Gaps

- Reuse still performs a full calculation when the path changes between bound and unbound loop policies.
- Angular-loop accounting follows sampled target-relative points, as the existing full loop stop does. It is not continuous analytic orbit accounting.
- The worker still forces a full calculation after sixteen consecutive reuse rolls to refresh numerical state and all metadata from the live simulation.
