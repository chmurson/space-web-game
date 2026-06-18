# Crash-State UI And Inspection Camera

## What Changed

- Replaced the small crashed-state action stack with a crash result panel that names the crashed body when available and prioritizes restart from checkpoint.
- Suppressed normal HUD/control chrome while crashed, but left the WebGL scene visible so the player can see where the spacecraft crashed.
- Split gameplay input from camera input so target selection stays disabled after a crash while camera pan/zoom remains available.
- Framed the camera on the spacecraft at the crash transition with the spacecraft above the bottom crash panel, then unlocked it for inspection.
- Fixed the crash-menu checkpoint button to call the same direct checkpoint restore path used by the persistent scenario prompt, dismiss active replay prompts, and close crash UI immediately after a successful restore.

## Why

Issue #12 asked for clearer crash feedback and less misleading pause-state presentation. The follow-up behavior needed both a visible game state and an unlocked inspection camera after crash, while keeping recovery actions obvious.

## Key Files

- `src/ui/createCrashMenu.ts` owns the crash result panel, action ordering, focus handling, and keyboard shortcuts.
- `src/app/createAppComponents.ts` owns crash-state synchronization, camera/gameplay input gates, app-level crashed styling state, and the checkpoint restart callback wiring.
- `src/input/pointerCameraInput.ts` separates camera controls from target-heading selection.
- `src/runtime/runtimeActions.ts` owns the crash inspection camera unlock and upper-viewport framing helper.
- `src/presentation/hudPresentation.ts` pauses the time icon hand while crashed.
- `src/style.css` owns crash-state overlay layout and HUD/control suppression.
- `tests/runtime/runtimeActions.test.ts` covers camera unlock behavior.

## Validation

- `git diff --check`
- `npm test`
- `npm run build`
- Browser component check for crash-menu checkpoint click, `R`, `Escape`, title, visibility, and focus state.
- Browser crash layout checks on desktop and mobile with forced crash DOM state.
- Browser pointer-camera gating check that zoom remains available while target selection is disabled.
- Actual-app debug snapshot check: booted into a checkpointed crash, opened the replay prompt while crashed, clicked the crash-menu checkpoint button, and verified crash UI was hidden, `app-crashed` was removed, the active prompt was cleared, and simulation time advanced.
- Runtime camera test verifies the crash inspection pan offset frames the spacecraft above the bottom crash panel.
- Actual-app framing check verifies the crash camera adapts to the visible crash panel top and keeps the spacecraft above it in a short viewport.
- CodeRabbit review completed with 0 findings after the regression fix.
- Netlify staging deploy: `https://space-web-game-woven-moth.netlify.app`
