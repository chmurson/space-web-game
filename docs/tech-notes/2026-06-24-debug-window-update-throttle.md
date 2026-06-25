# Debug Window Update Throttle

## What Changed

- Debug panel text and JSON content now refresh only when the panel is visible and due for a 500ms update.
- FPS indicator text, status, and graph now refresh only when the indicator is visible and either four frame-loop cycles have passed or the last frame interval exceeded roughly 1/15s.
- FPS indicator CPU and GPU timings now share one compact line in the popup.
- `frameLoop` now passes the current frame interval into `hudPresentation.update` so the FPS indicator can respond to slow frames without rebuilding hidden DOM every frame.

## Why It Changed

The debug panel and FPS indicator are diagnostic surfaces. Updating their strings, JSON payloads, graph model, and SVG DOM every frame adds work to the render loop even when the surfaces are hidden or do not need frame-perfect data.

## Key Files

- `src/presentation/hudPresentation.ts`: owns debug/FPS visibility checks and local refresh cadence state.
- `src/runtime/frameLoop.ts`: provides `frameIntervalMs` to the HUD presentation update.

## Implementation Decisions

- Keep throttle state private to HUD presentation instead of introducing shared runtime state.
- Preserve immediate refresh on first open so toggled debug surfaces do not show stale blank content.
- Reset FPS cadence while hidden so hidden surfaces do not accumulate pending work.

## Validation

- `npm test`
- `npm run build`
- `npx biome check src/presentation/hudPresentation.ts src/runtime/frameLoop.ts`
- Browser smoke via temporary headless Chrome with SwiftShader:
  - hidden debug/FPS surfaces produced zero observed content mutations
  - debug panel rendered visible content after enabling
  - FPS indicator rendered visible text and graph after enabling
  - desktop and mobile screenshots captured under `.codex/shipit-workflows/debug-window-update-throttle/`
- CodeRabbit review gate: completed; one unrelated finding targeted pre-existing `issue-8-earth-atmosphere-rim` Shipit state and was skipped.
- Netlify staging deploy: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy: `https://6a3bac48c05c062082a5039f--fanciful-bunny-d77b4b.netlify.app`
- After merging `origin/main` into `debug-window-update-throttle`:
  - `npm install` synced the newly merged Playwright dependency.
  - `npm test`: 44 files, 287 tests passed.
  - `npm run build`: passed.
  - `npm run test:gui`: passed.
  - GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`.
  - Netlify staging deploy: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy: `https://6a3c0744e027ac464a058ff0--fanciful-bunny-d77b4b.netlify.app`
- After changing the FPS indicator cadence to eight visible frame-loop cycles:
  - `npm test -- --run tests/presentation/hudPresentation.test.ts`: 4 tests passed.
  - `npx biome check src/presentation/hudPresentation.ts tests/presentation/hudPresentation.test.ts docs/tech-notes/2026-06-24-debug-window-update-throttle.md`: passed.
  - `npm test`: 44 files, 287 tests passed.
  - `npm run build`: passed.
  - `npm run test:gui`: passed.
  - GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`.
  - Netlify staging deploy: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy: `https://6a3c0bd1002ba400f7092909--fanciful-bunny-d77b4b.netlify.app`
- After combining the FPS indicator CPU/GPU timing line:
  - `npm test -- --run tests/ui/hudText.test.ts`: 12 tests passed.
  - `npx biome check src/ui/hudText.ts tests/ui/hudText.test.ts`: passed.
  - `npm run build`: passed.
  - `npm run test:gui`: passed.
  - Browser verification via local Vite dev server confirmed FPS text contains `cpu ... | gpu ...` on one rendered row.
  - Screenshot captured: `.codex/shipit-workflows/debug-window-update-throttle/fps-meter-cpu-gpu-combined.png`.
  - Netlify staging deploy: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy: `https://6a3c14ad89773926ccd42964--fanciful-bunny-d77b4b.netlify.app`
- After changing the FPS indicator cadence from eight to four visible frame-loop cycles:
  - `npm test -- --run tests/presentation/hudPresentation.test.ts`: 4 tests passed.
  - `npx biome check src/presentation/hudPresentation.ts tests/presentation/hudPresentation.test.ts`: passed.
  - `npm test`: 44 files, 287 tests passed.
  - `npm run build`: passed.
  - `npm run test:gui`: passed.
  - GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`.
  - Netlify staging deploy: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy: `https://6a3d6d7428ad867e9cd58165--fanciful-bunny-d77b4b.netlify.app`

## Follow-Ups

- None.
