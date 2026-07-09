# Mobile HUD Overlay Zoom Suppression

Issue: https://github.com/chmurson/space-web-game/issues/218

## What Changed

- Added a shared `installNativeTouchZoomSuppression()` helper for gameplay UI roots.
- Applied the helper to the top HUD, bottom HUD notices, scenario prompt backdrop, in-game controls menu, and UI settings dialog.
- The helper sets `touch-action: none` on each guarded root, prevents default browser behavior for multi-touch events, Safari `gesture*` events, and `dblclick`, and does not stop event propagation.
- Added focused Playwright coverage for the shared guard behavior and for installation on the gameplay HUD/overlay roots.

## Why

Mobile browsers can interpret rapid taps or pinch gestures over HUD and overlay controls as native page zoom. That page zoom can leave the WebGL camera projection and HUD placement visually inconsistent after zooming back out. The fix scopes browser-default suppression to UI surfaces that sit above the app-owned full-screen touch-control layer instead of adding a document-level blocker.

## Key Files

- `src/ui/nativeTouchZoomSuppression.ts`: owns the shared scoped browser zoom suppression helper.
- `src/ui/overlayUI/createOverlayUi.ts`: installs the helper on the top HUD, bottom HUD notices, and scenario prompt backdrop.
- `src/ui/createInGameControlsMenu.ts`: installs the helper on the in-game controls menu.
- `src/ui/createUiSettingsDialog.ts`: installs the helper on the UI settings dialog.
- `tests/gui/mobileTouchZoomSuppression.spec.ts`: covers default prevention, event propagation, and guard installation.

## Decisions

- Kept the existing `createTouchControls.ts` playfield gesture path unchanged because it already owns camera pinch zoom, double-tap/drag zoom, camera pan, touch-control reveal, and thrust/selector gestures.
- Avoided preventing default on single-touch `touchstart`/`touchend` in the new overlay helper so click-driven buttons keep their existing activation path.
- Used `touch-action: none` on guarded roots because `touch-action: manipulation` can still allow pinch zoom.
- Added Safari `gesture*` default prevention as a narrow compatibility guard for pinch zoom on UI surfaces.
- Did not add a document-level listener or a new gesture abstraction.

## Validation

- `npx playwright test --config playwright.config.ts tests/gui/mobileTouchZoomSuppression.spec.ts --project=mobile-chromium`: passed after fixing the test syntax/import pattern.
- `npm run test:gui`: 50 mobile Chromium tests passed.
- `npx biome check src/ui/nativeTouchZoomSuppression.ts tests/gui/mobileTouchZoomSuppression.spec.ts src/ui/createInGameControlsMenu.ts src/ui/createUiSettingsDialog.ts src/ui/overlayUI/createOverlayUi.ts`: passed.
- `git diff --check`: passed.
- `npm run build`: passed after final formatting; Vite reported the existing large chunk warning.
- Screenshot artifacts inspected:
  - `tmp/playwright-results/mobileHudScreenshot-captur-144e3-menu-open-over-gameplay-HUD-mobile-chromium/mobile-in-game-controls-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-ui-settings-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`
- `coderabbit --base main --agent` connected and reached review heartbeats, but did not produce findings or a completion result after several minutes; the run was interrupted and treated as an automated-review timeout.

## Follow-Ups

- None currently known.
