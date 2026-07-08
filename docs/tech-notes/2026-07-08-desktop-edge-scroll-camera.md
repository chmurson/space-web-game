# Desktop Edge-Scroll Camera

Issue: https://github.com/chmurson/space-web-game/issues/204

## What Changed

- Desktop mouse drag no longer pans the camera.
- Desktop fine-pointer input now pans the camera when the pointer rests inside a small canvas edge band while the camera is in `unlocked` mode.
- When the camera is locked to `centered` or `target`, desktop edge hover must dwell for about 3 seconds before switching to `unlocked`; `cameraModeChangesLocked` still blocks that transition.
- The camera-unlocked notice now has a desktop edge-scroll variant.
- The in-game controls menu exposes a desktop-only `Edge pan speed` stepper with `Slow`, `Normal`, and `Fast` values.
- The selected speed persists in user settings as `desktopEdgePanSpeed`.

## Why

Desktop primary click is now used for turn planning, so camera panning should avoid hold-and-drag gestures that conflict with heading planning. Edge-scroll keeps camera movement available without consuming click/drag input.

## Key Files

- `src/input/pointerCameraInput.ts`: owns desktop pointer tracking, edge-zone detection, dwell unlock, and edge-scroll panning.
- `src/runtime/frameLoop.ts`: calls the pointer edge-scroll tick once per frame.
- `src/app/createAppComponents.ts`: wires fine-pointer gating, UI-blocking checks, speed persistence, and the edge-scroll unlock notice.
- `src/ui/createInGameControlsMenu.ts` and `src/ui/components/InGameControlsMenuSurface.tsx`: own the desktop-only menu control.
- `src/userSettingsStorage.ts`: owns `desktopEdgePanSpeed` persistence and fallback parsing.
- `tests/input/pointerCameraInput.test.ts`, `tests/userSettingsStorage.test.ts`, and GUI specs cover the new behavior.

## Decisions

- Reused the existing frame loop instead of adding a second animation loop inside pointer input.
- Kept touch drag panning unchanged by suppressing only mouse drag camera panning.
- Kept the speed setting descriptive rather than numeric to fit the compact controls menu.
- Edge-scroll is disabled while top menu, in-game controls menu, UI settings, crash menu, or scenario prompts are active.
- No new shared gesture abstraction was added; the existing pointer and touch adapters remain the ownership boundary.

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

## Follow-Ups

- None currently planned.
