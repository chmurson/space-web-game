# Desktop Keyboard Turning

Shipit state: `.codex/shipit-workflows/agent/desktop-keyboard-turning.md`

## What changed

- Left and Right Arrow now feed direct RCS-style yaw into the existing manual `ControlInput.turn` path at full power.
- Holding either Shift key reduces arrow-key yaw to 25% for precise corrections.
- Mouse clicks on the game canvas no longer start, update, or commit target-heading turn plans. Non-mouse pointer planning remains available so mobile behavior is unchanged.
- The desktop Keyboard shortcuts panel now lists both full-power and precise arrow-key turning instead of the former mouse-planning gesture.

## Why

Desktop steering previously depended on a click-move-click target-heading plan, while mobile already exposed immediate proportional RCS yaw. Direct keyboard yaw gives desktop players a faster, more predictable steering path and preserves a slower input for fine alignment.

## Key files and ownership

- `src/input/keyboardInput.ts` owns held keyboard control state and maps arrow/Shift combinations into the existing numeric turn channel.
- `src/input/pointerCameraInput.ts` owns desktop mouse gestures and now excludes mouse pointer releases from target-heading planning while preserving camera gestures and non-mouse planning.
- `src/ui/components/InGameControlsMenuSurface.tsx` owns the visible desktop shortcut reference.
- `tests/input/keyboardInput.test.ts` and `tests/input/pointerCameraInput.test.ts` cover the deterministic input behavior.
- `tests/gui/turnPlanningInput.spec.ts` covers the browser wiring, while `tests/gui/mobileHudScreenshot.spec.ts` covers the visible shortcut panel.

## Decisions

- Reused the analog `ControlInput.turn` path added for mobile RCS instead of adding a second desktop steering system.
- Matched the mobile RCS sign convention: Left Arrow is negative yaw and Right Arrow is positive yaw.
- Derived precision from the held `ShiftLeft`/`ShiftRight` key state, so changing Shift while an arrow remains held changes power immediately.
- Opposing arrow inputs cancel to neutral.
- Kept touch and pen target-heading planning intact; only `pointerType: 'mouse'` is excluded.

## Validation

- Focused Vitest input coverage passed: 25 tests across `keyboardInput.test.ts` and `pointerCameraInput.test.ts`.
- Focused Playwright desktop input coverage passed for mouse planning suppression and full/precise keyboard yaw.
- Focused Keyboard shortcuts screenshot coverage passed.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-86be2-ame-controls-keyboard-hints-mobile-chromium/wide-in-game-controls-keyboard-hints.png`; the new Turn and Precise turn rows are visible, aligned, and do not overlap the HUD or menu boundary.
- `npm test` passed: 62 Vitest files / 565 tests, 16 automation-claim tests, and 3 automation-workflow tests.
- `npm run build` passed; Vite emitted the existing large-chunk warning.
- `npm run test:gui` passed: 67 Playwright tests.
- Focused Biome checks passed for all changed source and test files, and `git diff --check` passed. A broad Biome check still reports pre-existing formatting/import-order findings in unrelated files plus the existing `src/style.css` `!important` warnings; those files were intentionally left untouched.

## Follow-ups and known gaps

- No follow-up is currently required. Control remapping and a larger shortcut-help redesign remain outside this small PR.
