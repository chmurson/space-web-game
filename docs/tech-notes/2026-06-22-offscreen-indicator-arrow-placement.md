# Offscreen Indicator Arrow Placement

## What Changed

- Offscreen indicators now resolve an explicit arrow side: `left` or `right`.
- Left-edge indicators force the arrow before the label; right-edge indicators force the arrow after the label.
- Top and bottom indicators choose arrow side by comparing the projected target X position with the final indicator center.
- Top and bottom arrow side uses a 10% indicator-width hysteresis band to avoid side-flip jitter near center.
- Narrow mobile stacked indicators keep the arrow aligned to the chosen side while allowing bounded label wrapping.

## Why

Issue #37 follows the edge-based indicator work from issue #36. The previous DOM order and mobile stack styling could let wrapped labels or top/bottom placement make the arrow feel detached from the viewport edge it was describing.

## Key Files

- `src/presentation/offscreenIndicatorPlacement.ts` owns pure placement, vector, and arrow-side math.
- `src/presentation/bodyPresentation.ts` reads and stores previous arrow side on each indicator element, then toggles arrow-side classes after final placement.
- `src/style.css` owns pointer/label ordering and bounded mobile wrapping for offscreen indicators.
- `tests/presentation/offscreenIndicatorPlacement.test.ts` covers fixed edge sides and top/bottom hysteresis.

## Decisions

- Reused the existing offscreen indicator system instead of adding a new DOM component.
- Kept the 10% threshold relative to the measured indicator width so the jitter band scales with wrapped label width.
- Kept mobile stacked indicators as column layout so side-edge labels remain narrow, and used arrow-side variables to align the pointer and label to the selected side.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npx biome check src/presentation/bodyPresentation.ts src/presentation/offscreenIndicatorPlacement.ts tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npx biome lint src/style.css` passed with only the existing `!important` warnings near app main-menu/crashed hiding rules.
- `npm test`
- `npm run build` passed with the existing Vite large-chunk warning.
- `git diff --check`
- `coderabbit --base main --agent` completed with zero findings.
- Browser QA through temporary `puppeteer-core` and local Chrome because the in-app Browser was unavailable and Chrome DevTools MCP was profile-locked:
  - desktop left-edge, right-edge, and bottom-edge mixed-side screenshots captured under `.codex/shipit-workflows/issue-37-offscreen-indicator-arrow-placement/screenshots/`
  - mobile stacked wrap-ready screenshot captured under `.codex/shipit-workflows/issue-37-offscreen-indicator-arrow-placement/screenshots/mobile-stacked-wrap-ready.png`
- `npm run deploy:netlify`
  - staging URL: https://space-web-game-woven-moth.netlify.app
  - unique deploy URL: https://6a39058baf6748b48853404a--space-web-game-woven-moth.netlify.app

## Follow-Ups

- None known.
