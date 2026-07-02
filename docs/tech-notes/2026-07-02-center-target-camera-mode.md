# Center Target Camera Mode

## What Changed

- Added a third camera control mode, `target`, alongside `unlocked` free roam and `centered` spacecraft follow.
- Updated the in-game controls menu camera setting from a binary switch to a three-option segmented control: Free roam, Spacecraft, and Target.
- Remapped desktop `C` to cycle camera modes and left the previous `cycleAssistMode` action unbound from that shortcut.
- Reused the bottom transient HUD notice for keyboard camera-mode changes.

## Why

Issue #159 asks players to center the camera on the active assist/navigation target without losing existing free roam or spacecraft-centered behavior. The target mode uses the runtime assist target UI state so manual, automatic, and scenario-forced target selection all feed the same camera behavior.

## Key Files

- `src/scenario/scenarioDirectiveTypes.ts` owns the camera mode union, validator, and cycle order.
- `src/runtime/runtimeActions.ts` owns camera target resolution and mode changes.
- `src/input/keyboardShortcuts.ts` owns the `C` keyboard mapping.
- `src/ui/components/InGameControlsMenuSurface.tsx` and `src/ui/createInGameControlsMenu.ts` own the in-game segmented camera control.
- `src/app/createAppComponents.ts` owns keyboard-triggered camera-mode notices.
- `src/input/pointerCameraInput.ts` and `src/ui/touchControls/createTouchControls.ts` keep drag-to-unlock behavior consistent for all follow modes.

## Decisions

- Target-centered mode reads `getAssistTargetUiState().activeTarget`; it does not use `recommendedTarget` or the transient heading marker.
- The keyboard cycle order is Free roam -> Spacecraft -> Target.
- Switching from a follow mode to free roam starts free roam at the current camera target to avoid a jump.
- No new dependency or camera abstraction was added.

## Validation

- `npx biome lint` on touched source and test files passed.
- `git diff --check` passed.
- `npm test` passed: 57 Vitest files, 427 Vitest tests, plus 16 automation-claim tests.
- `npm run build` passed, with the existing Vite large-chunk warning.
- `npm run test:gui` passed: 36 Playwright GUI tests.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-144e3-menu-open-over-gameplay-HUD-mobile-chromium/mobile-in-game-controls-menu.png` and `tmp/playwright-results/mobileHudScreenshot-captur-86be2-ame-controls-keyboard-hints-mobile-chromium/wide-in-game-controls-keyboard-hints.png`; the segmented camera control fit without overlap and the keyboard guide showed `Camera` / `C`.
- `coderabbit --base main --agent` completed with 5 findings. Fixed the two in-scope findings for this issue: validation wording in this note and camera-control copy. Skipped three Reach the Moon highscore findings as out of scope for issue #159.

## Follow-Ups

- None known.
