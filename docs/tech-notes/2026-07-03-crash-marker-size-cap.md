# Crash Marker Size Cap

## What Changed

- Capped the prediction end marker's screen-space fill diameter at approximately 30px.
- Preserved the existing minimum screen-radius behavior while the marker is below that cap.
- Added a focused presentation regression that verifies normal marker sizing and the close-zoom cap.

## Why

The predicted-impact crash marker is rendered on celestial bodies as the same `predictionEndMarker` used by trajectory presentation. At very close zoom levels, its fixed world-space radius could dominate the screen and make the red crash dot look much larger than the spacecraft marker.

## Key Files

- `src/presentation/trajectoryPresentation.ts` owns the runtime marker scale calculation and applies the cap before updating the Three.js group scale.
- `src/scene/createGameScene.ts` still owns marker mesh construction, materials, and render order; no scene construction changes were needed.
- `tests/presentation/trajectoryPresentation.test.ts` covers the presentation behavior through the existing public presentation update path.

## Decisions

- Kept the cap as a local presentation constant because issue #166 requests one fixed visual limit and there is no current need for user or scenario configuration.
- Capped the final fill diameter rather than changing the marker geometry, preserving smaller-size behavior and avoiding changes to Pe/Ap marker rendering.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts`
- `npm run build`
- `npm run test:gui`
- `npx biome check src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryPresentation.test.ts docs/tech-notes/2026-07-03-crash-marker-size-cap.md`
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png` for general world-render sanity. The existing GUI suite does not stage the predicted-impact crash marker, so the exact cap is covered by the presentation regression test.
- `coderabbit --base main --agent` was attempted, but the command hung after entering analysis and was interrupted with no findings emitted.

## Follow-Ups

- None known.
