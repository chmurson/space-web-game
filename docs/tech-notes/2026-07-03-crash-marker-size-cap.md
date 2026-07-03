# Crash Marker Size Cap

## What Changed

- Capped the prediction end marker's screen-space fill diameter at approximately 11px, which is the marker's rendered size at viewport size 20.
- Preserved the existing minimum screen-radius behavior while the marker is below that cap.
- Added a focused presentation regression that verifies normal marker sizing and that closer zoom levels stop growing at the viewport-size-20 marker size.

## Why

The predicted-impact crash marker is rendered on celestial bodies as the same `predictionEndMarker` used by trajectory presentation. At very close zoom levels, its fixed world-space radius could dominate the screen. Manual review on PR #168 found the marker looks better when it stops increasing once the debug viewport size reaches 20.

## Key Files

- `src/presentation/trajectoryPresentation.ts` owns the runtime marker scale calculation and applies the cap before updating the Three.js group scale.
- `src/scene/createGameScene.ts` still owns marker mesh construction, materials, and render order; no scene construction changes were needed.
- `tests/presentation/trajectoryPresentation.test.ts` covers the presentation behavior through the existing public presentation update path.

## Decisions

- Kept the cap as a local presentation constant because issue #166 and PR #168 request one fixed visual limit and there is no current need for user or scenario configuration.
- Capped the final fill diameter rather than changing the marker geometry, preserving smaller-size behavior and avoiding changes to Pe/Ap marker rendering.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts`
- `npm run build`
- `npm run test:gui`
- `npx biome check src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryPresentation.test.ts docs/tech-notes/2026-07-03-crash-marker-size-cap.md`
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png` for general world-render sanity. The existing GUI suite does not stage the predicted-impact crash marker, so the exact cap is covered by the presentation regression test.
- `coderabbit --base main --agent` was attempted twice, but the command hung after entering analysis and was interrupted with no findings emitted.

## Follow-Ups

- None known.
