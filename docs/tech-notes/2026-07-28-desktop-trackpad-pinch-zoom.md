# Desktop Trackpad Pinch Zoom

Issue: https://github.com/chmurson/space-web-game/issues/325

## What Changed

- Routed Ctrl/Cmd-modified desktop `wheel` events to camera zoom in all three Pan Camera modes: `wheel`, `drag`, and `edge`.
- Added canvas-scoped handling for Safari/WebKit `gesturestart`, `gesturechange`, and `gestureend`.
- Converted WebKit's cumulative gesture scale into bounded incremental zoom factors.
- Added focused input tests for all pan modes, ownership gates, normalization, clamping, end-state reset, and locked-camera behavior.
- Added desktop Chromium Playwright coverage that exercises the running game camera in every pan mode.

## Why

Chromium represents a trackpad pinch as a Ctrl-modified `WheelEvent`, while Safari exposes pinch through its non-standard `GestureEvent` family. The game previously accepted the modified-wheel path only in `wheel` mode and did not turn WebKit gesture scale into camera zoom. As a result, desktop pinch behavior depended on both browser and Pan Camera preference.

The browser does not expose a reliable signal that distinguishes generated pinch events from physical Ctrl/Cmd+wheel input. Supporting pinch in every mode therefore also means that physical Ctrl/Cmd+wheel zooms the game camera in every mode. Existing wheel-mode behavior remains unchanged; `drag` and `edge` now use the same modified-wheel ownership.

## Key Files and Ownership

- `src/input/pointerCameraInput.ts` owns desktop canvas wheel, pointer, edge-pan, and WebKit gesture routing.
- `tests/input/pointerCameraInput.test.ts` verifies the input boundary without widening the production module API.
- `tests/gui/browserZoomIsolation.spec.ts` verifies Chromium's modified-wheel path against the running camera state.
- `src/ui/nativeTouchZoomSuppression.ts` remains unchanged and continues to own the app-wide mobile browser-zoom policy established by issue #256.

## Decisions

- Kept one camera zoom callback and added only browser-event adapters; there is no second pinch controller or dependency.
- Used `previousScale / currentScale` for each WebKit `gesturechange`. Safari reports scale cumulatively from gesture start, so using the ratio prevents compounding jumps. Each ratio is clamped to the existing per-event zoom range of `0.75` through `1.35`.
- Installed the WebKit listeners directly on the renderer canvas with `{ passive: false }`. They call `preventDefault()` only after the existing game, desktop-pointer, and desktop-camera interaction gates accept the gesture.
- Kept camera-lock semantics unchanged: lock blocks pan/follow/recenter changes, while zoom remains available as it was for wheel and touch input.
- Kept the 125 ms modifier-release tail only in `wheel` mode. `drag` and `edge` already map ordinary unmodified scrolling to zoom and do not need gesture-tail state.
- Preserved ordinary scroll behavior: unmodified wheel input still pans in `wheel` mode and zooms in `drag` and `edge`.
- Preserved mobile touch pinch routing and the existing fixed-game-surface native zoom suppression policy.
- Did not update `DESIGN.md` because this changes no visible UI, copy, layout, or interaction affordance.

## Browser Limits

- Chromium desktop is covered with a synthetic Ctrl-modified `WheelEvent`, matching the browser's trackpad-pinch event model.
- Firefox is expected to use the same standards-based modified-wheel boundary, but this repository has no Firefox Playwright project for this task.
- WebKit's `GestureEvent` API is non-standard and not constructible as a real trackpad gesture in Chromium automation. Focused unit tests cover routing and normalization; a human must verify physical Safari trackpad behavior.
- Synthetic wheel events cannot prove that a particular physical device generated the event, only that the browser-facing input contract is handled.

## Validation

- `npx vitest run --config vite.config.ts tests/input/pointerCameraInput.test.ts`: 49 tests passed.
- `npx playwright test --config playwright.config.ts tests/gui/browserZoomIsolation.spec.ts --project=mobile-chromium`: 5 tests passed in an explicit desktop browser context.
- `npm test` after rebasing onto current `origin/main`: 766 product tests, 16 automation-claim tests, and 4 workflow-prompt tests passed.
- Focused post-rebase Playwright run across browser zoom isolation, direct steering, mobile pinch, and mobile native-zoom suppression: 12 tests passed.
- Full pre-rebase `npm run test:gui`: 91 of 94 tests passed. All feature-relevant desktop pinch, wheel/edge pan, menu/dialog isolation, mobile pinch, and mobile browser-zoom tests passed. Two untouched debug-snapshot-detail tests and the existing leaderboard `7h30m` display assertion failed.
- `npx biome check src/input/pointerCameraInput.ts tests/input/pointerCameraInput.test.ts tests/gui/browserZoomIsolation.spec.ts`: passed.
- `git diff --check`: passed.
- Post-rebase `npm run build`: configuration validation passed, then the existing version-1/version-3 type mismatch in `src/ui/components/recentSnapshotFormatting.ts` and `tests/ui/recentSnapshotFormatting.test.ts` stopped TypeScript before bundling. Neither file is changed by this issue.
- Visually inspected the generated `mobile-pinch-before.png` and `mobile-pinch-after.png` artifacts. The world zoomed around the off-center focal point while the HUD and command dock remained coherent.

## Manual Safari Verification

On a Mac with a trackpad and desktop Safari:

1. Start a gameplay scenario and choose each Pan Camera mode in UI settings.
2. Pinch in and out over the unobstructed game canvas; confirm smooth camera zoom with no page zoom.
3. Confirm ordinary two-finger scrolling still pans in `wheel` mode and zooms in `drag` and `edge`.
4. Open the in-game controls and UI settings surfaces; confirm pinch over them does not move the game camera.
5. Repeat during a disabled interaction state and a camera-locked scenario state; confirm ownership matches existing wheel/touch behavior.
6. Recheck a mobile device or simulator to confirm touch pinch still zooms normally.

## Follow-Ups

- Keep the WebKit listener isolated in the input boundary. If Safari adopts a standards-based pinch event in the future, remove the non-standard branch rather than layering another abstraction over it.
