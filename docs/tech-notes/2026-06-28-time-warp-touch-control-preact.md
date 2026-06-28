# Time Warp Touch Control Preact Boundary

## What Changed

- Confirmed the configured time warp selector now uses the shared typed Preact step-selector boundary from issue #96.
- Kept `createSelectorTimeWarpControl` as the time-warp adapter that maps selector directions to time-warp actions and labels.
- Moved the fallback swipe time-warp feedback label content into a typed Preact component.
- Preserved the existing feedback root element, data attributes, classes, CSS custom properties, clamped positioning, opacity, confirmation fade, and visibility behavior.

## Why It Changed

Issue #97 is part of the broader Preact UI migration. The configured time warp control composes the shared vertical step selector that landed in issue #96, while the older swipe feedback surface remains available behind the fallback control variant. Migrating the fallback feedback render boundary completes the time-warp touch-control migration without changing time warp policy, preview values, commit behavior, blocked reasons, or gesture thresholds.

## Key Files And Boundaries

- `src/ui/touchControls/stepSelectorControl/stepSelectorControlView.tsx` owns the typed Preact selector value-stack markup and preserves `.touch-step-selector` hooks from the issue #96 base.
- `src/ui/touchControls/selectorTimeWarpControl/createSelectorTimeWarpControl.ts` remains the time-warp-specific selector adapter.
- `src/ui/touchControls/swipeTimeWarpControl/timeWarpFeedbackView.tsx` owns the fallback feedback view rendering, root class/data/style hooks, anchor clamping, and fade timer.
- `src/ui/touchControls/swipeTimeWarpControl/timeWarpFeedbackPresenter.ts` remains the owner of feedback label, tone, and variant presentation.
- `src/runtime/timeWarpFeedbackPolicy.ts` remains the owner of preview/commit eligibility and blocked reasons.

## Decisions

- Kept the public `TimeWarpControl` and `TimeWarpControlOptions` contracts unchanged.
- Reused the shared step-selector Preact boundary from current `origin/main`; this branch does not change the selector implementation after rebasing onto issue #96.
- Kept the swipe feedback root outside Preact because `setVisible`, measurement, animation classes, data hooks, and CSS custom properties already depend on that stable element.
- Did not change trajectory horizon adapter code, time warp policy, gesture thresholds, reveal tabs, touch-control placement, or visual styling.

## Validation

- `npx biome check --write src/ui/touchControls/stepSelectorControl/stepSelectorControlView.tsx src/ui/touchControls/swipeTimeWarpControl/timeWarpFeedbackView.tsx tests/ui/touchControls/timeWarpFeedbackView.test.ts docs/tech-notes/2026-06-28-time-warp-touch-control-preact.md` passed.
- `npx vitest run --config vite.config.ts tests/ui/touchControls/timeWarpFeedbackView.test.ts tests/ui/touchControls/selectorTimeWarpControlPresenter.test.ts tests/ui/touchControls/createStepSelectorControl.test.ts` passed: 3 files, 7 tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- `npm test` passed: 47 Vitest files, 319 Vitest tests, and 16 automation-claim tests.
- `npm run test:gui` passed: 20 mobile Chromium Playwright checks.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`; the revealed time-warp selector stayed on the right edge, labels were aligned, and it did not overlap the top HUD, mission button, or touch tabs.
- `coderabbit --base main --agent` completed with 0 findings on the final rebased branch.
- `npm run deploy:netlify` passed and deployed the final rebased branch to staging: `https://fanciful-bunny-d77b4b.netlify.app` (unique deploy `https://6a40f88b4f2bab206e0afd0d--fanciful-bunny-d77b4b.netlify.app`).

## Follow-Ups

- None.
