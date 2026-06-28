# Touch Controls Tutorial Hint Preact Migration

## What Changed

- Migrated the touch-controls tutorial hint root, focus frame, and label markup to a typed Preact surface.
- Kept the existing `TouchControlsTutorialHint` runtime contract with `element` and `setVisible`.
- Mounted the Preact-rendered hint under the existing `.touch-controls` panel so CSS positioning and tutorial dataset hooks remain compatible.

## Why It Changed

Issue #98 splits this small hint out of the broader touch-controls Preact migration so the tutorial affordance can move to the shared Preact surface pattern without changing touch-control behavior.

## Key Files

- `src/ui/touchControls/touchControlsTutorialHint.tsx` owns the Preact-rendered hint surface and visibility render state.
- `src/ui/touchControls/createTouchControls.ts` mounts the hint under the touch-controls panel and continues to update `dataset.target`.

## Decisions

- Reused `createPreactUiSurface` instead of adding a touch-controls-specific render helper.
- Preserved the existing copy, `display: block/none` visibility behavior, CSS class hooks, and tutorial target dataset writes.
- Did not migrate other touch controls or alter tutorial timing, scenario prompts, or targeting rules.

## Validation

- `npm run build` passed after installing dependencies in the task worktree with `npm ci`.
- `npm run test` passed: 47 Vitest files / 319 tests, plus 16 automation claim node tests.
- `npm run test:gui` passed: 20 Playwright mobile Chromium checks.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-dc18f--touch-control-after-reveal-mobile-chromium/mobile-thrust-control.png`; the revealed thrust control stayed in the expected lower-right edge panel with the central playfield clear and no UI overlap.
- `npm run deploy:netlify` deployed the branch to the shared staging site: https://fanciful-bunny-d77b4b.netlify.app.

## Follow-Ups

- None.
