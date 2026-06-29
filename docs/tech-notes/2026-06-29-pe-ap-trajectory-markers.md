# Pe/Ap Trajectory Markers

## What Changed

- Coast trajectory prediction now emits optional target-relative event markers for sampled periapsis (`Pe`) and apoapsis (`Ap`) points.
- Trajectory presentation renders those events as small path-attached dots and only shows short labels at close zoom.
- The body distance tooltip remains body name plus altitude only.

## Why

Issue #129 moved Pe/Ap context out of dense body tooltip text and onto the rendered trajectory path. The marker positions need to follow the selected prediction horizon, so the implementation uses the same sampled prediction points that already feed the coast line.

## Key Files

- `src/prediction/trajectoryPrediction.ts` owns event selection from target-relative coast samples.
- `src/runtime/trajectoryPredictionRuntime.ts` carries event markers through the prediction state contract.
- `src/scene/createGameScene.ts` owns reusable Three.js marker primitives and close-zoom label sprites.
- `src/presentation/trajectoryPresentation.ts` positions and zoom-gates trajectory event markers.
- `tests/prediction/trajectoryPrediction.test.ts`, `tests/presentation/trajectoryPresentation.test.ts`, and `tests/presentation/bodyDistanceContext.test.ts` cover marker rules and tooltip behavior.

## Decisions

- No separate orbital-elements solver was added. Pe/Ap are derived from the rendered sample path.
- A marker is only emitted when the chosen extremum is inside the sampled path, not at the prediction horizon boundary. This keeps horizon changes meaningful and avoids labeling an event that has not been sampled yet.
- `Ap` is emitted only for bound, non-impacting coast predictions. Unbound, flyby, and impact paths do not get an apoapsis marker.
- Marker dots reuse the existing prediction end-marker circle style. Labels use the same compact glass/cyan visual language and are hidden at wider zoom levels.

## Validation

- `npx vitest run --config vite.config.ts tests/prediction/trajectoryPrediction.test.ts tests/presentation/trajectoryPresentation.test.ts tests/presentation/bodyDistanceContext.test.ts` passed.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npm test` passed.
- `npm run test:gui` passed. Inspected `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png` and `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; both preserved mobile HUD/trajectory readability without new label clutter at wide zoom.

## Follow-Ups

- None.
