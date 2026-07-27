# Trajectory render decimation

Issue: [#175](https://github.com/chmurson/space-web-game/issues/175)

Shipit state:
`.codex/shipit-workflows/automation/issue-175-trajectory-decimation.md`

## What changed

- Added a pure trajectory render selector that converts the current viewport
  size into a minimum world-space vertex spacing through the shared
  `viewportSampling` interpolation helper.
- Trajectory presentation now sends deterministic subsets of coast and assisted
  prediction points to the Three.js line geometries.
- The selector always keeps each rendered segment's first and last source
  points. It also keeps near/far tier boundaries, the first retained stale-far
  point, and the impact-gradient start point.
- Zoom changes rerun presentation selection against the complete accepted
  prediction, so useful detail returns without refreshing or recalculating
  physics.
- The in-game debug panel now reports coast and assisted source-to-selected
  render-point counts, stale-line selections, total retention, and the current
  minimum world-space sample distance for manual density tuning.
- Added a screen-derived chord-error guard that retains intermediate source
  points before a straight rendered segment visibly cuts across a tight curve.
- Cached selected source indices until the prediction arrays, tier state,
  impact-gradient boundary, viewport size, or viewport height changes.

## Why

Long-accepted predictions can contain many more points than are visually useful
when the camera shows an orbit or the wider Earth-Moon system. Uploading every
point to `LineGeometry` adds avoidable geometry work even though adjacent
vertices may be only a few screen pixels apart. Decimating at the presentation
boundary lowers that rendered vertex count while keeping the prediction result
and all simulation decisions intact.

## Ownership and implementation decisions

- `src/presentation/trajectoryRenderSelection.ts` owns the deterministic,
  viewport-dependent index selection. Its trajectory-specific density stops
  target roughly five to eight vertical screen pixels between source samples
  across close, orbit, and system views.
- Selection uses traveled path distance rather than only the straight-line
  displacement from the last retained point. This keeps curved paths from
  becoming eligible for a large shortcut merely because they bend back toward
  an earlier point.
- The chord-error guard measures source-path deviation from a candidate
  rendered chord and allows at most 0.25 screen pixels of deviation. It is
  particularly important for tight circular or high-curvature arcs, where
  distance-only selection can otherwise reveal a polygonal silhouette.
- Cached selection shares the same complete source arrays and required-point
  rules as uncached selection; only the selected index lists are reused between
  unchanged visual inputs.
- Retained stale-far trimming and bridge eligibility are evaluated against the
  complete source path before density selection. Sparse geometry therefore
  cannot make an implausible stale seam appear bridgeable.
- `src/presentation/trajectoryPresentation.ts` still computes the existing
  combined-path fade from every accepted coast point, then selects matching
  colors by source index. Debug near/far colors keep the same source-tier
  ownership.
- Render diagnostics are collected only while the in-game debug panel is
  enabled and reuse cached selection lengths. Normal gameplay does not allocate
  diagnostic data for this reporting; its selected-index cache still prevents
  repeated selection work between unchanged visual inputs.
- Impact-gradient geometry remains at its existing short 18-point maximum. Its
  first and last points are unchanged, and the gradient start is mandatory in
  the underlying prediction line so the visual transition remains continuous.
- Pe/Ap markers, prediction-end metadata, impact metadata, coach anchors, and
  assist queries continue to read the complete runtime prediction. They do not
  depend on selected line vertices.
- Predictor sampling, integration precision, worker/cache behavior, accepted
  runtime arrays, bound-loop limits, and the historical spacecraft trail are
  unchanged.
- `DESIGN.md` remains accurate; this changes line geometry density without
  changing the trajectory's visual language or UI layout.

## Validation

- Biome passed for the selector, presentation integration, unit tests, and GUI
  coverage.
- Focused Vitest passed 25 trajectory selector and presentation tests,
  including density reduction, mandatory points, near/far slicing, stale-far
  trim/bridge behavior, impact endpoints, and detail restoration after zoom.
- The complete product/automation suite passed: 674 product tests, 16
  task-claim tests, and 4 engineer-workflow tests.
- Release config validation, TypeScript, and the Vite production build passed.
- Focused Playwright coverage passed 2/2 and captured desktop and mobile close,
  orbit, and system views. All six PNGs under
  `tmp/playwright-results/trajectoryRenderDensity-*` were inspected at original
  resolution; the path stayed continuous, sparse at system zoom, detailed after
  zoom-in restoration, and clear of desktop/mobile HUD overlap.
- The full Playwright suite passed 90/92. Both unchanged `main` failures
  reproduced alone: the Pe/Ap layering test still probes the removed
  `.touch-edge-reveal-control`, and the precise-yaw test expects `-1 / 49` while
  the shipped control reports `-0.25`. The failing spec files are unchanged by
  this work.
- A live browser pass reported no console warnings or errors.
- Focused diagnostics coverage passed: debug-panel formatting includes coast,
  assisted, stale, total, spacing, and chord-error values; trajectory and HUD
  presentation tests remain green.
- Selector coverage verifies that a tight curved arc retains more source points
  than an equal-length straight path at the same viewport and source density.

## Follow-ups and known gaps

- No predictor or integration tuning is included; those remain separate
  performance concerns.
- Diagnostics are debug-panel-only; the DevTools extension does not yet expose
  an equivalent trajectory render readout.
