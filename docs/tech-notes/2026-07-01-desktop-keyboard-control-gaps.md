# Desktop Keyboard Control Gaps

Issue: https://github.com/chmurson/space-web-game/issues/43
Branch: `codex/issue-43-desktop-keyboard-controls`
Shipit state: `.codex/shipit-workflows/codex-issue-43-desktop-keyboard-controls.md`

## What changed

- Added a desktop main-thrust latch to `src/input/keyboardInput.ts`: double-tap `W` or `ArrowUp` latches main thrust on, pressing the thrust key again cancels after release, reverse thrust cancels immediately, and `keyboardInput.clear()` clears the latch.
- Mapped `Shift+[` and `Shift+]` in `src/input/keyboardShortcuts.ts` to the existing trajectory horizon runtime actions while preserving plain `[` and `]` for time warp.
- Cleared keyboard input after the existing keyboard and top-menu reset paths so latched thrust cannot survive a direct scenario reset.
- Added compact desktop-only keyboard hints to the existing in-game controls popover, including hold-burn, burn latch, cancel burn, mouse turning, time warp, and trajectory horizon shortcuts.

## Why

Desktop play already had momentary thrust, time warp, target, assist mode, and zoom bindings, but trajectory horizon was only reachable from debug shortcuts and touch UI. Main thrust also required holding a key for long burns. This keeps the fix in the existing keyboard and runtime action boundaries instead of introducing a controls redesign or remapping system.

## Key files and ownership

- `src/input/keyboardInput.ts` owns held and latched keyboard-derived control state.
- `src/input/bindKeyboardShortcuts.ts` owns the browser event to input/action adapter.
- `src/input/keyboardShortcuts.ts` owns one-shot desktop shortcut mapping.
- `src/app/createAppComponents.ts` owns top-menu reset dispatch cleanup for keyboard input.
- `src/runtime/runtimeActions.ts` remains the trajectory horizon behavior owner; this change only reuses its existing actions.
- `src/ui/components/InGameControlsMenuSurface.tsx` and `src/ui/overlayUI/overlayUIStyles.css` own the visible shortcut hints in the existing controls popover.

## Decisions

- Used the issue-recommended `Shift+[` and `Shift+]` bindings because plain brackets are already time warp controls.
- Kept debug `Digit4` and `Digit5` behavior unchanged for existing debug users.
- Made the hint block desktop-only through the existing responsive CSS rather than adding a new overlay or persistent HUD element.
- Used the same `ControlInput.main` state for latched thrust visibility; no separate UI state was added.

## Validation

- `npx vitest run --config vite.config.ts tests/input/keyboardInput.test.ts tests/input/keyboardShortcuts.test.ts tests/input/bindKeyboardShortcuts.test.ts` passed.
- `npm test` passed: 57 Vitest files / 394 tests, plus 16 automation-claim tests.
- `npm run build` passed after config validation, TypeScript, and Vite release build. Vite emitted the existing large chunk warning.
- `npm run test:gui` passed: 26 Playwright tests.
- GUI screenshots inspected:
  - `tmp/playwright-results/mobileHudScreenshot-captur-86be2-ame-controls-keyboard-hints-mobile-chromium/wide-in-game-controls-keyboard-hints.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-144e3-menu-open-over-gameplay-HUD-mobile-chromium/mobile-in-game-controls-menu.png`
- `coderabbit --base main --agent` completed with one minor finding in untouched `src/prediction/trajectoryPrediction.ts`; skipped as unrelated to this keyboard-control branch.

## Follow-ups

None planned for this issue. Full shortcut help, remapping, and broader control redesign remain non-goals.
