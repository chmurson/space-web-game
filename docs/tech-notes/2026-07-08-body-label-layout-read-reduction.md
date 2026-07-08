# Body Label Layout Read Reduction

## What Changed

- Extracted `updateBodyLabels()` into `src/presentation/bodyPresentation/updateBodyLabels.ts`.
- Guarded body-label `textContent`, title, aria-label, class, display, visibility, and transform writes so unchanged values do not dirty the DOM every frame.
- Cached label width/height per label element by viewport size, label text, distance-context mode, and mobile-wrap mode.
- Lazily measured the telemetry strip only when at least one visible body label needs vertical clamping.
- Moved per-frame label placement from `left`/`top` writes to `transform` writes.
- Added body-label CSS containment and transform hinting while preserving the shipped glass-label styling.
- Replaced stale-label cleanup's repeated body scan with a per-update active body ID set.
- Follow-up review fix: normalized distance-context bounds cache keys by numeric text shape and enabled tabular numerals so changing distance values reuse cached dimensions when their display shape is unchanged.

## Why

`updateBodyLabels()` runs during visual updates and was the current hottest presentation function. The previous flow changed label text and classes, forced `display: block`, read `getBoundingClientRect()`, then wrote `left` and `top` on every visible label. That mixes layout-affecting writes with forced layout reads, so stable labels still paid layout and recalculation cost every frame.

The new flow keeps the same visibility, distance-context, mobile wrapping, and viewport clamping behavior, but stable labels reuse cached bounds and update only their transform position.

## Key Files

- `src/presentation/bodyPresentation.ts`: delegates body-label work to the sibling module.
- `src/presentation/bodyPresentation/updateBodyLabels.ts`: owns body-label DOM state, sizing cache, placement, and opt-in measurement.
- `src/style.css`: anchors body labels at the viewport origin and contains their layout/paint work.

## Decisions

- Kept the cache local to body-label presentation instead of adding a shared layout registry.
- Bounded each element's bounds cache to 32 entries to cover stable body names and coarse distance labels without unbounded growth.
- Included viewport size, text, distance-context mode, and wrap mode in the cache key because each can affect label dimensions.
- Kept `getBoundingClientRect()` for cache misses so browser-measured text wrapping remains the source of truth.
- Added opt-in timing through `window.__measureBodyLabelRects`, matching the prior offscreen indicator measurement pattern.

## Validation

- `npm run build`
- `npx biome check --write src/presentation/bodyPresentation.ts src/presentation/bodyPresentation/updateBodyLabels.ts src/style.css`
- `npm run test:gui` passed 43 tests and failed `tests/gui/cameraDragInputRegression.spec.ts:149`; this is the same mobile camera-drag failure recorded in the offscreen indicator tech note and does not exercise body-label placement.
- Inspected `tmp/playwright-results/turnPlanningInput-mobile-t-6211d--and-confirms-on-second-tap-mobile-chromium/mobile-turn-plan-active.png`; the Earth distance label stayed correctly positioned and clear of the HUD/touch controls.
- `npm run deploy:netlify` deployed the non-`main` branch to `https://fanciful-bunny-d77b4b.netlify.app` with unique deploy `https://6a4e9012da954a9debbe8461--fanciful-bunny-d77b4b.netlify.app`.
- After the CodeRabbit nitpick fix: `npm run build`, `npx vitest run --config vite.config.ts tests/presentation/offscreenIndicatorPlacement.test.ts`, `npx biome check src/presentation/bodyPresentation/updateBodyLabels.ts src/presentation/bodyPresentation/updateOffscreenIndicators.ts src/style.css`, and `coderabbit --base main --agent` passed. `npm run test:gui` again passed 43 tests and failed the same `tests/gui/cameraDragInputRegression.spec.ts:149` case.

## Follow-Ups

- Investigate the existing mobile camera-drag regression separately if it is not already tracked.
