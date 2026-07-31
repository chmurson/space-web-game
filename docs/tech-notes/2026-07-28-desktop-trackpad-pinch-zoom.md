# Desktop Trackpad Pinch Zoom

Issue: https://github.com/chmurson/space-web-game/issues/325

## What Changed

- Routed Ctrl/Cmd-modified desktop `wheel` events to camera zoom in all three Pan Camera modes: `wheel`, `drag`, and `edge`.
- Applied twice the browser-reported logarithmic pinch strength to Chromium modified-wheel and Safari gesture-scale input while keeping ordinary wheel zoom sensitivity unchanged.
- Added canvas-scoped handling for Safari/WebKit `gesturestart`, `gesturechange`, and `gestureend`.
- Converted WebKit's cumulative gesture scale into bounded incremental zoom factors.
- Added focused input tests for all pan modes, ownership gates, normalization, clamping, end-state reset, and locked-camera behavior.
- Added desktop Chromium Playwright coverage that exercises the running game camera in every pan mode.

## Why

Chromium represents a trackpad pinch as a Ctrl-modified `WheelEvent`, while Safari exposes pinch through its non-standard `GestureEvent` family. The game previously accepted the modified-wheel path only in `wheel` mode and did not turn WebKit gesture scale into camera zoom. As a result, desktop pinch behavior depended on both browser and Pan Camera preference.

The browser does not expose a reliable signal that distinguishes generated pinch events from physical Ctrl/Cmd+wheel input. Supporting pinch in every mode therefore also means that physical Ctrl/Cmd+wheel zooms the game camera in every mode. Existing wheel-mode ownership remains unchanged; `drag` and `edge` now use the same modified-wheel ownership.

[Chromium's touchpad pinch event queue](https://chromium.googlesource.com/chromium/src/+/main/content/browser/renderer_host/input/touchpad_pinch_event_queue.cc) encodes each touchpad pinch scale update as `deltaY = -100 * log(scale)` in the DOM wheel event. The initial implementation passed that value through the ordinary `0.0015` wheel sensitivity, reproducing only 15% of the reported logarithmic scale and making both zoom directions feel too soft. A first correction recovered the browser-reported scale with `1 / 100`; human review then requested twice that strength in both browsers. Desktop pinch now doubles logarithmic strength, so Chromium uses `2 / 100` and Safari squares each incremental scale ratio. This keeps zoom-in and zoom-out reciprocal.

## Key Files and Ownership

- `src/input/pointerCameraInput.ts` owns desktop canvas wheel, pointer, edge-pan, and WebKit gesture routing.
- `tests/input/pointerCameraInput.test.ts` verifies the input boundary without widening the production module API.
- `tests/gui/browserZoomIsolation.spec.ts` verifies Chromium's modified-wheel path against the running camera state.
- `src/ui/nativeTouchZoomSuppression.ts` remains unchanged and continues to own the app-wide mobile browser-zoom policy established by issue #256.

## Decisions

- Kept one camera zoom callback and added only browser-event adapters; there is no second pinch controller or dependency.
- Used one private `2` strength multiplier for both desktop browser paths rather than user-agent sniffing. Chromium multiplies its decoded logarithmic wheel sensitivity by that value; Safari raises each incremental scale ratio to that power. The same Chromium sensitivity applies to the short wheel-mode modifier-release tail, while ordinary unmodified wheel zoom keeps its existing sensitivity.
- Used `(previousScale / currentScale) ** 2` for each WebKit `gesturechange`. Safari reports scale cumulatively from gesture start, so using the incremental ratio prevents compounding jumps while the exponent doubles logarithmic zoom strength. Each amplified ratio is clamped to the existing per-event zoom range of `0.75` through `1.35`.
- Installed the WebKit listeners directly on the renderer canvas with `{ passive: false }`. They call `preventDefault()` only after the existing game, desktop-pointer, and desktop-camera interaction gates accept the gesture.
- Kept camera-lock semantics unchanged: lock blocks pan/follow/recenter changes, while zoom remains available as it was for wheel and touch input.
- Kept the 125 ms modifier-release tail only in `wheel` mode. `drag` and `edge` already map ordinary unmodified scrolling to zoom and do not need gesture-tail state.
- Preserved ordinary scroll behavior: unmodified wheel input still pans in `wheel` mode and zooms in `drag` and `edge`.
- Preserved mobile touch pinch routing and the existing fixed-game-surface native zoom suppression policy.
- Did not update `DESIGN.md` because this changes no visible UI, copy, layout, or interaction affordance.

## Browser Limits

- Chromium desktop is covered with a synthetic Ctrl-modified `WheelEvent`, matching the browser's trackpad-pinch event model.
- Chromium does not expose whether a modified-wheel event came from trackpad pinch or physical Ctrl/Cmd+wheel, so both use the doubled strength on the game-owned route.
- Firefox is expected to use the same standards-based modified-wheel boundary, but this repository has no Firefox Playwright project for this task.
- WebKit's `GestureEvent` API is non-standard and not constructible as a real trackpad gesture in Chromium automation. Focused unit tests cover routing and normalization; a human must verify physical Safari trackpad behavior.
- Synthetic wheel events cannot prove that a particular physical device generated the event, only that the browser-facing input contract is handled.

## Validation

- `npx vitest run --config vite.config.ts tests/input/pointerCameraInput.test.ts`: 51 tests passed, including doubled Chromium and Safari pinch strength in both zoom directions and unchanged ordinary wheel sensitivity.
- `npx playwright test --config playwright.config.ts tests/gui/browserZoomIsolation.spec.ts --project=mobile-chromium`: 5 tests passed in an explicit desktop browser context, including doubled zoom-in and zoom-out camera scale assertions in all three pan modes.
- `npm test`: 768 product tests, 16 automation-claim tests, and 4 workflow-prompt tests passed.
- Interactive local Chromium check: Ctrl-modified wheel zoom-in and zoom-out changed the rendered game camera while `visualViewport.scale` remained `1`.
- `npm run build`: configuration validation, TypeScript, and the release Vite bundle passed with only the existing non-fatal chunk-size warning.
- `npx biome check src/input/pointerCameraInput.ts tests/input/pointerCameraInput.test.ts tests/gui/browserZoomIsolation.spec.ts`: passed.
- `git diff --check`: passed.
- Original full `npm run test:gui`: 91 of 94 tests passed. All feature-relevant desktop pinch, wheel/edge pan, menu/dialog isolation, mobile pinch, and mobile browser-zoom tests passed. Two untouched debug-snapshot-detail tests and the existing leaderboard `7h30m` display assertion failed.
- Visually inspected the generated `mobile-pinch-before.png` and `mobile-pinch-after.png` artifacts. The world zoomed around the off-center focal point while the HUD and command dock remained coherent.

## Manual Trackpad Verification

On a Mac with a trackpad and desktop Chrome/Chromium plus Safari:

1. Start a gameplay scenario and choose each Pan Camera mode in UI settings.
2. Pinch in and out over the unobstructed game canvas with comparable finger travel; confirm both browsers feel twice as responsive as the prior PR preview and neither browser page-zooms.
3. Confirm ordinary two-finger scrolling still pans in `wheel` mode and zooms in `drag` and `edge`.
4. Open the in-game controls and UI settings surfaces; confirm pinch over them does not move the game camera.
5. Confirm physical Ctrl/Cmd+wheel remains acceptable; browsers do not identify whether a modified-wheel event came from pinch or a physical modifier.
6. Repeat during a disabled interaction state and a camera-locked scenario state; confirm ownership matches existing wheel/touch behavior.
7. Recheck a mobile device or simulator to confirm touch pinch still zooms normally.

## Follow-Ups

- Keep the WebKit listener isolated in the input boundary. If Safari adopts a standards-based pinch event in the future, remove the non-standard branch rather than layering another abstraction over it.
