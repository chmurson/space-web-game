# Safari DOM Zoom Suppression

Issue: https://github.com/chmurson/space-web-game/issues/256

## What Changed

- Installed the existing native touch zoom suppression policy once on the top-level `#app` element during startup.
- Removed the repeated allowlist-style installation from selected HUD, prompt, menu, and dialog roots.
- Updated focused mobile GUI coverage to verify that all representative DOM game surfaces live under the guarded app root, browser zoom defaults are prevented, and app-owned event propagation and canvas touch behavior remain available.

## Why

The previous implementation guarded only selected gameplay HUD and overlay roots. DOM-rendered surfaces outside that list, including the main menu and loading UI, could still begin Safari pinch or double-tap browser zoom and change the viewport. The app is a fixed, full-screen game with no intended native page scrolling or zooming, so its single root is the narrowest complete ownership boundary.

## Key Files and Ownership

- `src/main.ts` installs the browser zoom policy before asynchronous game startup creates additional DOM UI.
- `src/ui/nativeTouchZoomSuppression.ts` continues to own the reusable default-prevention behavior without stopping event propagation.
- `src/ui/createInGameControlsMenu.ts`, `src/ui/createUiSettingsDialog.ts`, and `src/ui/overlayUI/createOverlayUi.ts` no longer own duplicate guard installation.
- `tests/gui/mobileTouchZoomSuppression.spec.ts` covers production wiring, representative UI containment, and event behavior.

## Decisions

- Kept the existing viewport policy in `index.html` and the Safari `gesture*`, multi-touch, and `dblclick` fallbacks in the shared helper.
- Applied `touch-action: none` at `#app`, which owns the entire non-scrolling game surface, rather than maintaining a list of current UI roots.
- Continued to call only `preventDefault()` for browser-owned zoom behavior; events still propagate to app-owned taps, drags, selectors, reveal controls, and camera handlers.
- Kept the canvas-specific `touch-action: none` policy unchanged.
- Added no gesture abstraction or dependency.

## Validation

- `npx playwright test --config playwright.config.ts tests/gui/mobileTouchZoomSuppression.spec.ts --project=mobile-chromium`: passed 2 tests.
- `npm run test:gui`: passed all 57 mobile Chromium GUI tests.
- `npm run build`: passed; Vite reported the existing large-chunk warning.
- `npx biome check src/main.ts src/ui/createInGameControlsMenu.ts src/ui/createUiSettingsDialog.ts src/ui/overlayUI/createOverlayUi.ts tests/gui/mobileTouchZoomSuppression.spec.ts docs/tech-notes/2026-07-15-safari-dom-zoom-suppression.md`: passed.
- `git diff --check`: passed.
- Inspected the following generated screenshots and found the expected coherent UI state with no visual regression:
  - `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-144e3-menu-open-over-gameplay-HUD-mobile-chromium/mobile-in-game-controls-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-ui-settings-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control-dragging.png`

## Known Gap

- This worktree does not provide a real iOS Safari device or simulator. Automated touch-event coverage and a mobile browser viewport can verify the policy and interaction routing, but final hardware Safari confirmation remains a manual verification gap.
