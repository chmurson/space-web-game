# Desktop Edge-Scroll Camera

Issue: https://github.com/chmurson/space-web-game/issues/204

## What Changed

- Desktop mouse drag remains the default camera scrolling behavior.
- Desktop fine-pointer input can optionally pan the camera when the pointer rests inside a small canvas edge band while the camera is in `unlocked` mode.
- When the camera is locked to `centered` or `target`, desktop edge hover must dwell for about 3 seconds before switching to `unlocked`; `cameraModeChangesLocked` still blocks that transition.
- The camera-unlocked notice now has a desktop edge-scroll variant.
- UI settings exposes a desktop-only `Turn on scrolling by edge pan` switch. Disabled status reads `Scrolling by dragging`; enabled status reads `Scrolling by edge pan`.
- UI settings shows the desktop-only `Edge pan speed` stepper with `Slow`, `Normal`, and `Fast` values next to the edge-pan switch while edge-pan scrolling is enabled.
- The selected edge-pan enablement persists in user settings as `desktopEdgePanEnabled`, defaulting to `false`.
- The selected speed persists in user settings as `desktopEdgePanSpeed`.
- Owner follow-up on 2026-07-09 fixed top-edge hit-testing so passive top HUD space no longer blocks upward edge-scroll.
- Active edge-scroll now sets a native direction-specific cursor for cardinal and diagonal edge directions, then restores the canvas cursor when edge-scroll is inactive.
- Owner follow-up on 2026-07-09 restored desktop drag camera scrolling as the default and made edge-scroll opt-in.
- Owner follow-up on 2026-07-10 routed edge-pan dwell through the same pointer-camera free-roam unlock path as drag unlock and added a close-to-cursor progress indicator while the edge dwell is loading free roam.
- Owner follow-up on 2026-07-10 changed the indicator into a compact label-free donut that closes around an empty core during the two-second edge dwell.

## Why

Desktop primary click is now used for turn planning, but the owner follow-up restored the previous drag camera scrolling as the default. Edge-scroll remains available for players who prefer edge-driven camera movement without consuming click/drag input.

## Key Files

- `src/input/pointerCameraInput.ts`: owns desktop pointer tracking, edge-zone detection, dwell unlock, and edge-scroll panning.
- `src/runtime/frameLoop.ts`: calls the pointer edge-scroll tick once per frame.
- `src/app/createAppComponents.ts`: wires user opt-in, fine-pointer gating, UI-blocking checks, speed persistence, and the edge-scroll unlock notice.
- `src/ui/overlayUI/overlayUIStyles.css`: keeps the top menu interactive while allowing passive top HUD space to hit-test through to the canvas.
- `src/ui/createInGameControlsMenu.ts` and `src/ui/components/InGameControlsMenuSurface.tsx`: own the in-game controls popover.
- `src/ui/createUiSettingsDialog.ts` and `src/ui/components/UiSettingsDialogSurface.tsx`: own the desktop-only edge-pan enable switch and speed control.
- `src/userSettingsStorage.ts`: owns `desktopEdgePanEnabled` and `desktopEdgePanSpeed` persistence and fallback parsing.
- `tests/input/pointerCameraInput.test.ts`, `tests/userSettingsStorage.test.ts`, and GUI specs cover the new behavior.

## Decisions

- Reused the existing frame loop instead of adding a second animation loop inside pointer input.
- Kept touch drag panning unchanged and restored mouse drag camera panning when edge-pan is disabled.
- Kept the speed setting descriptive rather than numeric to fit compact settings surfaces.
- Edge-scroll is disabled while top menu, in-game controls menu, UI settings, crash menu, or scenario prompts are active.
- Edge-scroll is opt-in. When disabled, desktop mouse drag handles camera panning; when enabled, mouse drag does not pan so edge-scroll owns desktop camera movement.
- Passive top HUD space is not treated as an interaction blocker; only the actual top menu remains pointer-interactive.
- No new shared gesture abstraction was added; the existing pointer and touch adapters remain the ownership boundary.
- Edge dwell reports pending free-roam progress through the pointer input callback; overlay UI owns DOM placement and styling so input code does not own HUD elements.

## Validation

- `npx vitest run --config vite.config.ts tests/input/pointerCameraInput.test.ts tests/userSettingsStorage.test.ts tests/app/createInitialAppRuntimeState.test.ts`: 24 tests passed.
- `npx playwright test --config playwright.config.ts tests/gui/cameraDragInputRegression.spec.ts tests/gui/mobileHudScreenshot.spec.ts -g "keeps desktop edge-scroll|keeps mobile touch camera panning|keeps the in-game controls menu adapter state"`: 3 tests passed.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "desktop edge pan speed control"`: 1 test passed.
- `npm run test:gui`: 45 tests passed.
- Inspected GUI screenshots:
  - `tmp/playwright-results/mobileHudScreenshot-captur-144e3-menu-open-over-gameplay-HUD-mobile-chromium/mobile-in-game-controls-menu.png`: mobile menu stayed within the shipped HUD style and hid the desktop-only speed row.
  - `tmp/playwright-results/mobileHudScreenshot-captur-86be2-ame-controls-keyboard-hints-mobile-chromium/wide-in-game-controls-keyboard-hints.png`: wide controls menu still fit without overlap.
  - `tmp/playwright-results/mobileHudScreenshot-captur-c87eb-n-the-in-game-controls-menu-mobile-chromium/desktop-edge-pan-speed-menu.png`: desktop speed row rendered in the existing glass stepper treatment without overlap.
- `npx biome check src/app/createAppComponents.ts src/input/pointerCameraInput.ts src/runtime/frameLoop.ts src/ui/components/InGameControlsMenuSurface.tsx src/ui/createInGameControlsMenu.ts src/ui/createTopMenu.ts src/userSettingsStorage.ts tests/app/createInitialAppRuntimeState.test.ts tests/gui/cameraDragInputRegression.spec.ts tests/gui/mobileHudScreenshot.spec.ts tests/input/pointerCameraInput.test.ts tests/userSettingsStorage.test.ts tests/presentation/spacecraftPresentation.test.ts docs/tech-notes/2026-07-08-desktop-edge-scroll-camera.md`: passed.
- `npm run build`: passed with the existing Vite large chunk warning.
- `git diff --check`: passed.
- `npm test`: 511 Vitest tests and 16 automation-claim tests passed.
- `coderabbit --base main --agent`: completed with 0 findings.

Owner follow-up validation on 2026-07-09:

- `npx vitest run --config vite.config.ts tests/input/pointerCameraInput.test.ts`: 12 tests passed.
- `npx biome check src/input/pointerCameraInput.ts src/ui/overlayUI/overlayUIStyles.css tests/input/pointerCameraInput.test.ts tests/gui/cameraDragInputRegression.spec.ts`: passed.
- `npx playwright test --config playwright.config.ts tests/gui/cameraDragInputRegression.spec.ts`: 3 tests passed.
- `npm run build`: passed with the existing Vite large chunk warning.
- `npm test`: 513 Vitest tests and 16 automation-claim tests passed.
- `git diff --check`: passed.
- `npm run test:gui`: 46 tests passed.
- Inspected GUI screenshots:
  - `tmp/playwright-results/mobileHudScreenshot-captur-c87eb-n-the-in-game-controls-menu-mobile-chromium/desktop-edge-pan-speed-menu.png`: edge pan speed menu still fit and used the existing glass stepper treatment.
  - `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`: top menu stayed interactive and readable without HUD overlap.

Owner follow-up validation on 2026-07-09 for optional edge-pan:

- `npx vitest run --config vite.config.ts tests/input/pointerCameraInput.test.ts tests/userSettingsStorage.test.ts tests/app/createAppConfigContext.test.ts tests/app/createInitialAppRuntimeState.test.ts`: 33 tests passed.
- `npx biome check src/app/createAppComponents.ts src/input/pointerCameraInput.ts src/ui/createUiSettingsDialog.ts src/ui/components/UiSettingsDialogSurface.tsx src/userSettingsStorage.ts tests/app/createAppConfigContext.test.ts tests/app/createInitialAppRuntimeState.test.ts tests/gui/mobileHudScreenshot.spec.ts tests/input/pointerCameraInput.test.ts tests/userSettingsStorage.test.ts docs/tech-notes/2026-07-08-desktop-edge-scroll-camera.md`: passed.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "UI settings dialog adapter|desktop edge pan toggle|mobile UI settings dialog"`: 3 tests passed.
- `npm run build`: passed with the existing Vite large chunk warning.
- `npm test`: 514 Vitest tests and 16 automation-claim tests passed.
- `npm run test:gui`: 47 tests passed.
- `git diff --check`: passed.
- `coderabbit --base main --agent`: completed with 0 findings.
- Inspected GUI screenshot:
  - `tmp/playwright-results/mobileHudScreenshot-captur-c816c-e-pan-toggle-in-UI-settings-mobile-chromium/desktop-edge-pan-toggle-settings.png`: desktop settings panel showed the new Camera group, the edge-pan switch, and the `Scrolling by edge pan` status without overlap.

Owner follow-up validation on 2026-07-10 for settings layout:

- `npx biome check src/app/createAppComponents.ts src/style.css src/ui/components/InGameControlsMenuSurface.tsx src/ui/components/UiSettingsDialogSurface.tsx src/ui/createInGameControlsMenu.ts src/ui/createUiSettingsDialog.ts tests/gui/mobileHudScreenshot.spec.ts docs/tech-notes/2026-07-08-desktop-edge-scroll-camera.md`: passed with existing `src/style.css` `!important` warnings.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "keeps the in-game controls menu adapter state|keeps the UI settings dialog adapter|desktop edge pan toggle and speed|mobile UI settings dialog"`: 4 tests passed.
- `npm run build`: passed with the existing Vite large chunk warning.
- `npm run test:gui`: 46 tests passed.
- `git diff --check`: passed.
- Inspected GUI screenshot:
  - `tmp/playwright-results/mobileHudScreenshot-captur-82cf3-le-and-speed-in-UI-settings-mobile-chromium/desktop-edge-pan-toggle-settings.png`: desktop settings panel showed the edge-pan switch and speed stepper together in the Camera group without overlap.

Owner follow-up validation on 2026-07-10 for edge-pan unlock parity:

- `npx vitest run --config vite.config.ts tests/input/pointerCameraInput.test.ts`: 15 tests passed.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "edge-pan free-roam progress indicator|desktop edge pan toggle|mobile UI settings dialog"`: 3 tests passed.
- `npx biome check src/app/createAppComponents.ts src/input/pointerCameraInput.ts src/ui/overlayUI/createOverlayUi.ts src/ui/overlayUI/overlayUIStyles.css tests/input/pointerCameraInput.test.ts tests/gui/mobileHudScreenshot.spec.ts tests/presentation/hudPresentation.test.ts`: passed.
- `npm run build`: passed with the existing Vite large chunk warning.
- `npm test`: 516 Vitest tests and 16 automation-claim tests passed.
- `npm run test:gui`: 47 tests passed.
- `git diff --check`: passed.
- `coderabbit --base main --agent`: completed with 3 minor findings; all were fixed by measuring the progress pill dimensions before clamping, allowing the hide transition to finish, and using the shared glass border token.
- Inspected GUI screenshot:
  - `tmp/playwright-results/mobileHudScreenshot-keeps--b910d-s-indicator-near-the-cursor-mobile-chromium/desktop-edge-pan-unlock-progress.png`: the free-roam progress pill rendered near the cursor area, remained compact, and did not overlap the menu surface.

## Follow-Ups

- None currently planned.
