# Touch Target Selector Preact Migration

## What Changed

- Migrated the touch target selector row markup to typed Preact components in `src/ui/touchControls/targetControl/targetControlView.tsx`.
- Kept `createTargetControl` as the controller that owns the public `TargetControl` contract, state reads, commit callbacks, and render-signature guard.
- Added GUI coverage for automatic/manual/forced selector states, ARIA/class hooks, target glyph styling, click activation, touch-tap activation, move tolerance, and `onCommit` behavior.

## Why

Issue #95 is part of the broader touch UI Preact migration. The selector markup now uses the same typed Preact rendering boundary as the migrated step selector while preserving the shipped target-selection behavior and CSS hooks.

## Ownership Boundary

- `createTargetControl.ts` owns runtime integration: `element`, `syncUi`, row formatting, target-state transitions, and callback ordering.
- `targetControlView.tsx` owns DOM markup for the automatic targeting row, target list, target rows, body glyph, status marks, switch track, ARIA labels, disabled states, and touch/click event binding.
- `targetControl.css` and `targetBodyGlyphs.css` remain the styling owners; no visual redesign was intended.

## Decisions

- The existing `TargetControl` API stayed unchanged so `createTouchControls` does not need to know about Preact.
- Touch-tap handling stayed local to the target view, including the 18 px move tolerance and `preventDefault`/`stopPropagation` on committed taps.
- The controller still skips renders when the target state signature has not changed, matching the prior imperative behavior.

## Validation

- Passed: `npm test`
- Passed: `npm run build`
- Passed: `npm run test:gui`
- Inspected screenshot artifact: `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`; the target selector panel matched the expected mobile UI state.
- Passed: `npm run deploy:netlify`
- Staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy URL: `https://6a40fbab855e5f292ea37103--fanciful-bunny-d77b4b.netlify.app`

## Follow-Ups

- None required for this migration. Broader cleanup of shared touch-control render helpers can wait until more controls have completed their Preact migrations.
