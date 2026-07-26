# Desktop camera input routing

Date: 2026-07-26

Issue: [#314](https://github.com/chmurson/space-web-game/issues/314)

PR: [#317](https://github.com/chmurson/space-web-game/pull/317)

Shipit state:
`.codex/shipit-workflows/automation/issue-313-desktop-camera-pan-settings.md`

## What changed

- Fine-pointer camera input now reads the persisted `wheel`, `drag`, or `edge`
  mode for every desktop wheel and mouse-pan gesture.
- Wheel mode pans from both platform `deltaX` and `deltaY`, including diagonal
  movement. Pixel, line, and page delta modes are normalized independently for
  each axis.
- The persisted wheel speed applies a `0.6`, `1`, or `1.6` multiplier for
  `slow`, `normal`, or `fast`; the same multiplier is applied to both axes
  without changing the platform-provided sign.
- Ctrl/Cmd plus wheel zooms in wheel mode. Drag and edge modes retain
  unmodified-wheel zoom and leave modified wheel gestures to the browser.
- Wheel mode keeps left-button movement out of camera pan and adds right-button
  drag after the existing 8 px movement tolerance.
- A stationary or below-tolerance right click keeps the normal context menu.
  Context menu suppression occurs only after `onCameraPan` accepts a
  right-button drag.
- Accepted right-button fallback drags suppress context-menu events at the
  window capture boundary, including events that target another in-game DOM
  layer instead of the renderer canvas.
- The renderer uses the `move` cursor from accepted wheel-mode right-button
  press until pointer up, cancellation, or interaction loss. This active-drag
  cursor takes priority over frame-by-frame edge-cursor cleanup.
- Wheel handling is bound to the renderer canvas instead of the whole window.
  Open menus, dialogs, controls, and scrollable UI therefore retain their native
  wheel events, while an explicit desktop interaction gate also blocks canvas
  gestures while those game surfaces are open.
- Fine-pointer mode routing is separate from the coarse-pointer path, preserving
  the existing touch drag and coarse-pointer wheel-zoom behavior.

## Why

Issue #313 established the persisted settings and accessible settings surface,
but its default `wheel` mode could not ship until the camera input path honored
that contract. Issue #314 supplies that release gate while keeping existing
drag, edge, camera-lock, and mobile behavior intact.

## Ownership boundaries

- `src/input/pointerCameraInput.ts` owns delta normalization, per-mode wheel and
  pointer routing, drag tolerance, pointer capture, and context-menu
  suppression.
- `src/app/createAppComponents.ts` owns persisted-speed mapping and the
  fine-pointer/menu/dialog/scenario interaction gates passed into camera input.
- `tests/input/pointerCameraInput.test.ts` owns focused mode, axis, speed, lock,
  touch, and context-menu boundary coverage.
- `tests/gui/browserZoomIsolation.spec.ts` owns browser-level wheel ownership,
  modified zoom, diagonal pan, right-button cursor/context-menu ownership, and
  menu/dialog conflict coverage.
- Existing camera GUI tests use the accepted default-wheel gestures where they
  need to reposition or zoom the camera.

## Important decisions

- Canvas-local wheel binding is the native ownership boundary: events targeting
  UI do not need a selector allowlist and cannot accidentally become camera
  input as new controls are added.
- Wheel pan uses the same screen-to-world projection as drag and edge pan,
  keeping response consistent with the current camera angle and zoom.
- The app passes numeric speed multipliers into input instead of coupling the
  pointer module to settings labels or persistence updates.
- Right-drag context suppression follows the successful pan result rather than
  movement alone, so camera locks and rejected pans do not remove the browser
  context menu.
- Context-menu ownership is checked at the window capture boundary because the
  right-button gesture begins on the renderer but its menu event can target a
  different in-game layer. A later pointer press clears any unconsumed
  post-release suppression state so unrelated menus remain native.
- No target-heading planning behavior or API was added.
- No visual-system change was needed; implementation remains aligned with
  `DESIGN.md`.

## Validation

- Targeted Biome checks cover every changed source, test, and note file.
- The release build validates configuration, TypeScript, and the production
  Vite bundle.
- Focused pointer-input Vitest covers 37 mode and boundary cases.
- Focused Chromium checks cover diagonal wheel pan, Ctrl/Cmd wheel zoom,
  right-button cursor/context-menu ownership, menu/dialog/scroll ownership,
  touch drag, edge pan, and default-wheel updates to existing camera navigation
  tests.
- Full product Vitest passes 694/694. Claim-helper tests pass 16/16 and
  automation-workflow tests pass 4/4.
- Full Playwright passes 86/88. One failure is the unchanged leaderboard
  assertion expecting `Time 7h30m` while the rendered accessible name is
  `Time 07h30m`; this exact mismatch predates issue #314. The other was the
  existing timing-sensitive Time Warp fling check, which passed immediately in
  isolation.
- The generated 480 × 720 wheel settings screenshot shows the selected mode and
  complete speed row. The edge screenshot confirms the selected radio but
  crops the lower speed row at that narrow viewport; the source UI is unchanged
  from #313, and the live 1280 × 720 browser playtest shows the complete edge
  speed group.
- A live fine-pointer Chromium playtest confirmed two-axis camera movement from
  diagonal wheel input and unchanged camera marker styles while the paused UI
  settings dialog owned the same gesture.
- A live fine-pointer Chromium playtest also confirmed `move` from right-button
  press through accepted pan, original-cursor restoration on release,
  cross-layer context-menu suppression for the handled drag, and native
  stationary and subsequent context menus.

## Follow-up and known gaps

Issue [#315](https://github.com/chmurson/space-web-game/issues/315) owns broad
manual device and browser verification, including physical macOS trackpads,
conventional wheels, Magic Mouse axes, and Safari. No part of that manual matrix
is claimed as completed here.

The narrow 480 × 720 edge-settings crop is a pre-existing #313/PR #317 visual
gap and was not expanded into this runtime-input issue.
