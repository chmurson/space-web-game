# Horizontal Time Warp Prototype

## Summary

- Added a temporary second mobile Time Warp selector labeled `Time Warp control 2`.
- Kept the existing Time Warp selector visible and usable in its original reveal panel.
- Put the horizontal prototype in a separate reveal panel so the two controls can be compared independently.
- Made control 2 use horizontal left/right drag distance while keeping its labels upright.
- Made control 2's commit animation move in the finger direction, including left drag left and right drag right.
- Lengthened the horizontal control slightly to give its values more space.
- Disabled control 2's edge-panel slide-away gesture so horizontal drags belong exclusively to the selector.
- Routed both controls through the same existing Time Warp commit, current-value, and preview APIs.

## Context

Issue #226 asks for a comparison prototype after the broader horizontal redesign from #224 was paused. This keeps the original mobile control available while adding a smaller horizontal experiment that can be removed once a direction is chosen.

## Key Files

- `src/ui/touchControls/createTouchControls.ts` owns the separate Time Warp reveal-panel wiring, including the prototype-only disabled content slide-away gesture, gesture routing, and mouse drag bridge for open step selectors.
- `src/ui/touchControls/createTimeWarpControl.ts` owns the temporary control 2 factory.
- `src/ui/touchControls/stepSelectorControl/*` owns the shared selector axis math, view class, and horizontal styling.
- `tests/gui/timeWarpPrototypeControl.spec.ts` covers shared-state routing for the horizontal prototype.

## Decisions

- The step selector now has a vertical default and an optional horizontal axis so trajectory horizon and the original Time Warp control keep their existing behavior.
- Control 2 uses a separate internal gesture ID, `time-warp-2`, because routing two DOM controls through one active gesture ID would send drag updates to the wrong view.
- Control 2 also uses a separate reveal dock/control so its horizontal panel can open independently from the original Time Warp panel.
- The edge reveal control exposes a narrow opt-out for content swipe closing; only control 2 uses it because its content owns horizontal drag gestures.
- The prototype is intentionally concentrated in the Time Warp touch-control boundary, with a `ponytail` comment marking the temporary factory.

## Validation

- `npx vitest run --config vite.config.ts tests/ui/touchControls/createStepSelectorControl.test.ts` passed: 1 file, 5 tests.
- `npm run build` passed after config validation and TypeScript checks. Vite still reports the existing chunk-size warning.
- `npm run test:gui` passed: 51 mobile Chromium GUI tests.
- `npx biome check` on edited source and test files passed after formatting.
- `git diff --check` passed.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`; both controls were visible, readable, upright, and did not overlap the HUD or bottom controls.

## Follow-Ups

- Remove `Time Warp control 2` and the temporary factory once the preferred mobile Time Warp direction is chosen.
