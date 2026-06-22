# Remove Performance Debug Toggle

## What Changed

- Removed the `performanceDebugEnabled` runtime flag, UI action, keyboard shortcut, debug panel text, and DevTools extension checkbox.
- Kept the FPS meter as the single performance surface for FPS, frame time, CPU, GPU, 60 Hz headroom, compact GC counts, and recent frame/GC graphing.
- Changed GPU timer queries and browser GC probing to run only while the FPS meter is visible.
- Moved the FPS meter below the mobile debug panel when both are open, and hid it while the debug panel is full-screen.
- Bumped the Space Web Game DevTools extension manifest from `0.1.1` to `0.1.2` because the shipped panel UI changed.

## Why

The debug-window perf toggle duplicated the newer FPS meter. Keeping both meant there were two ways to enable overlapping CPU/GPU/headroom/GC reporting, and debug mode could keep collecting GC data even when the visible FPS meter was off.

## Key Files

- `src/runtime/frameLoop.ts` owns the FPS-meter-only gates for GC probing and GPU timing.
- `src/ui/hudText.ts` owns the simplified debug text and the remaining FPS meter performance text.
- `src/presentation/hudPresentation.ts` wires debug text and FPS meter metrics to their separate UI surfaces.
- `src/runtime/appRuntimeState.ts`, `src/input/uiUserActions.ts`, `src/input/keyboardShortcuts.ts`, and `src/runtime/runtimeActions.ts` remove the obsolete runtime flag/action path.
- `src/devtools/devtoolsBridge.ts` and `extension/space-web-game-devtools/panel.html` remove the DevTools flag surface.

## Decisions

- Did not move the old detailed perf lines into the debug window unconditionally; the FPS meter already carries the performance view and graph.
- Left existing debug shortcut numbering for horizon and snapshot controls unchanged, so `Digit3` is now intentionally unassigned in debug mode.
- Added an `app-debug-panel-open` class from the HUD presenter so responsive CSS can resolve debug-panel/FPS-meter overlap without measuring DOM boxes each frame.
- Left historical resolved planning notes unchanged even though they mention the old flag.

## Validation

- `npx vitest run --config vite.config.ts tests/ui/hudText.test.ts tests/devtools/devtoolsBridge.test.ts tests/input/keyboardShortcuts.test.ts tests/runtime/browserGcProbe.test.ts tests/runtime/runtimeActions.test.ts`
- `npm test` (41 files, 265 tests)
- `npm run build`
- Confirmed `dist/space-web-game-devtools-version.json` reports `{"extensionVersion":"0.1.2"}` after the build.
- `git diff --check`
- Browser desktop smoke at `http://127.0.0.1:5173/?devtools=1`: debug window has no perf line or `browserGc` JSON, `Digit3` leaves debug state unchanged, and FPS meter shows FPS/frame/CPU/GPU/headroom/GC.
- Browser mobile smoke at `500x844`: debug window and FPS meter are both visible with zero measured overlap after the responsive placement fix.
- Screenshots saved under `tmp/remove-perf-toggle-debug-fps-desktop.png` and `tmp/remove-perf-toggle-debug-fps-mobile-fixed.png`.
- Netlify staging deploy: `https://fanciful-bunny-d77b4b.netlify.app`
- Confirmed deployed `/space-web-game-devtools-version.json` reports `{"extensionVersion":"0.1.2"}`.

## Follow-Ups

- None currently known.
