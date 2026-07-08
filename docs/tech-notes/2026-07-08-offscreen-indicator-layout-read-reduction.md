# Offscreen Indicator Layout Read Reduction

## What Changed

- Reduced per-indicator `getBoundingClientRect()` calls in `updateOffscreenIndicators()`.
- Static blocker, telemetry strip, and bottom-pill rect reads are cached for the duration of one update cycle.
- Indicator width/height measurements are cached across frames by viewport size, stack mode, and label text.
- Indicator child refs are cached so the update loop does not query `.pointer` and `.label` every cycle.
- Final overlap-collision rects are derived from resolved indicator placement plus the already measured indicator size instead of forcing another layout read.
- Mobile stacked indicator measurement now only runs when the first placement pass says stacking is needed.
- `getClientRects()` visibility probes were removed from the blocker and bottom-pill paths; the measured rect is now reused for visibility and placement.

## Why

`updateOffscreenIndicators()` runs every visual update and handles multiple bodies plus the spacecraft. Each forced layout read can become expensive because the function also mutates indicator text, classes, and position. The previous flow commonly measured each visible offscreen indicator three times, and sometimes four times, in a single cycle. After the first pass, stable labels can now reuse in-memory dimensions instead of asking layout again.

## Key Files

- `src/presentation/bodyPresentation/updateOffscreenIndicators.ts`: owns offscreen indicator DOM placement and the layout-read reduction.
- `src/utils/measuredFunction.ts`: shared opt-in timing helper used by the offscreen indicator rect instrumentation.

## Decisions

- Kept the behavior local to the offscreen indicator module instead of adding a broader layout registry.
- Preserved the existing placement solver and mobile stacking rules.
- Used the existing `transform: translate(-50%, -50%)` contract to derive final collision rects from center placement and measured width/height.
- Kept the bounds cache local and bounded per indicator to avoid a new shared layout registry or unbounded label-distance cache.
- Kept measurement opt-in through `window.__measureOffscreenIndicatorRects`.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npm run build`
- `npx biome check src/presentation/bodyPresentation/updateOffscreenIndicators.ts src/presentation/bodyPresentation.ts src/utils/measuredFunction.ts`
- `git diff --check`
- `npm run test:gui` passed 43 tests and failed `tests/gui/cameraDragInputRegression.spec.ts:149`; focused rerun reproduced the same input-planning failure, which imports `createTouchControls.ts` and does not exercise offscreen indicator placement.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts:2632`
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-bdb58-ile-active-burn-notice-pill-mobile-chromium/mobile-burn-active-notice.png`; HUD spacing remained coherent. The screenshot helper hides `.offscreen-indicator`, so this is a broader mobile HUD smoke check rather than direct indicator visual coverage.

## Follow-Ups

- Investigate the repeated mobile camera-drag regression failure separately if it is not already tracked.
