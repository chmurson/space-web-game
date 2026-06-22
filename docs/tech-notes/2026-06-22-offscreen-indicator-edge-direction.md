# Offscreen Indicator Edge Direction

## What Changed

- Offscreen indicator arrows now point from the final placed edge label toward the projected offscreen target.
- Indicator distance labels now measure visible-viewport overflow instead of distance from the spacecraft.
- The spacecraft now has its own offscreen indicator when the camera is unlocked and the ship leaves view.
- The spacecraft indicator wins overlap priority so it is not hidden behind nearby body indicators.

## Why

Issue #36 asks for indicators to describe where objects are relative to the visible viewport edge. The previous math used the screen center for arrow direction and spacecraft-to-body world distance for labels, which became misleading once the camera could be unlocked from the spacecraft.

## Key Files

- `src/presentation/offscreenIndicatorPlacement.ts` owns edge placement plus the shared projected-target vector math.
- `src/presentation/bodyPresentation.ts` builds offscreen indicator targets, applies final-placement-based pointer rotation, and converts screen overflow back to meters with the current viewport scale.
- `src/ui/overlayUI/createOverlayUi.ts` creates the spacecraft indicator element with the existing offscreen indicator markup.
- `tests/presentation/offscreenIndicatorPlacement.test.ts` covers edge distance and arrow direction for left, right, top, bottom, and corner cases.

## Decisions

- Reused the existing offscreen indicator DOM and placement system instead of creating a parallel spacecraft-specific presenter.
- Kept distance based on projected viewport overflow so labels read near zero at the visible edge.
- Kept UI blocker avoidance intact by computing arrow/distance only after final placement.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npm test`
- `npx biome check src/presentation/bodyPresentation.ts src/presentation/offscreenIndicatorPlacement.ts src/ui/overlayUI/createOverlayUi.ts tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npx biome lint src tests scripts`
  - Exits 0 with existing `src/style.css` `!important` warnings.
- `npm run build` (passes with the existing Vite chunk-size warning)
- Browser QA through temporary Puppeteer Core and local Chrome after Browser/Chrome DevTools handles were unavailable:
  - desktop Earth-Moon unlocked-camera pan shows Moon and Spacecraft indicators on the bottom edge
  - mobile touch Earth-Moon viewport shows Moon and Spacecraft indicators with overlap suppression still active
- `coderabbit --base main --agent`
  - Final pass reported zero findings.
- `npm run deploy:netlify`
  - Staging URL: https://space-web-game-woven-moth.netlify.app
  - Unique deploy URL: https://6a38d4ef5ac75d31a2739b32--space-web-game-woven-moth.netlify.app

## Follow-Ups

- None for this issue.
