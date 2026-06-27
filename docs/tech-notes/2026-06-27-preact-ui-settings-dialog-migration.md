# Preact UI Settings Dialog Migration

## What Changed

- Moved the UI settings dialog markup and segmented-control rendering into `src/ui/components/UiSettingsDialogSurface.tsx`.
- Kept `createUiSettingsDialog` as the adapter returning `element`, `open`, `close`, and `syncState`.
- Preserved the existing dialog class hooks, Escape close, backdrop/close-button close, open-time state sync, focus restoration, and keyboard focus trap.
- Skipped focus restoration when the previous focus target is inside a hidden subtree, which prevents the dialog from restoring focus into a closed controls menu.
- Deleted the now-unused imperative `createDialog.ts` and `segmentedControl.ts` helpers.
- Added Playwright coverage for dialog state, focus behavior, selected segmented-control state, change callbacks, and a mobile screenshot opened through the in-game controls menu.

## Why It Changed

Issue #69 continues the Preact DOM UI migration after the main menu, crash menu, top menu, and in-game controls menu. The UI settings dialog is a contained, low-frequency surface, and the existing adapter boundary is enough to migrate it without introducing a generic modal or settings framework.

## Key Files

- `src/ui/components/UiSettingsDialogSurface.tsx` owns the typed Preact-rendered dialog DOM, labels, ARIA attributes, segmented-control selected state, and touch-control side callbacks.
- `src/ui/createUiSettingsDialog.ts` owns the adapter contract, state reads, open/close lifecycle, `onOpenChange`, document-level Escape/Tab handling, backdrop close behavior, and focus restoration.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the migrated adapter behavior and the open UI settings dialog screenshot state.

## Decisions

- Preserved the existing `.app-dialog*`, `.ui-settings-dialog`, and `.segmented-control*` class hooks so the current CSS and visual treatment remain unchanged.
- Kept focus and open/close behavior in the adapter because it is lifecycle behavior around the rendered surface, not reusable dialog framework work.
- Did not add a generic app-wide Preact root, modal framework, settings schema, or reusable segmented-control abstraction. This slice only needs one typed component plus the existing adapter.

## Validation

- `npx biome check --write src/ui/createUiSettingsDialog.ts src/ui/components/UiSettingsDialogSurface.tsx tests/gui/mobileHudScreenshot.spec.ts` passed with no fixes applied.
- `npm run test` passed: 47 files, 319 tests.
- `npm run build` passed with the existing Vite chunk-size warning.
- `git diff --check` passed.
- `npm run test:gui` passed: 15 mobile Chromium tests.
- GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-ui-settings-dialog.png`.
- CodeRabbit review found one valid focus restoration issue; it was fixed and covered.
- CodeRabbit rerun with `coderabbit --base main --agent` completed with 0 findings.
- `npm run deploy:netlify` passed:
  - Staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a403a12e8aa004c36617442--fanciful-bunny-d77b4b.netlify.app`

## Follow-Ups

- None known.
