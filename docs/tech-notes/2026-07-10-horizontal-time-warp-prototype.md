# Horizontal Time Warp Prototype

## Summary

- Added a temporary second mobile Time Warp selector labeled `Time Warp control 2`.
- Kept the existing Time Warp selector visible and usable in its original reveal panel.
- Put the horizontal prototype in a separate reveal panel so the two controls can be compared independently.
- Made control 2 use horizontal left/right drag distance while keeping its labels upright.
- Made control 2's whole value strip follow total finger displacement from one immutable gesture origin: left drag moves left and right drag moves right.
- Made long drags select across multiple values at symmetric half-slot thresholds, including when the drag reverses.
- Kept the gesture-start labels fixed while dragging so logical Time Warp commits cannot rebuild, recenter, or jump the strip.
- On release, smoothly settles the committed label into the center; a sub-threshold drag returns to its starting value.
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
- The horizontal value order is the clockwise rotation of the vertical selector: increase values sit left of the current value and decrease values sit right, allowing the selected value to settle into the center while the strip follows the finger.
- Horizontal drag commits are measured from the original pointer position for the entire gesture. Crossing `0.5`, `1.5`, `2.5`, and later slot midpoints updates shared Time Warp state one step at a time; crossing those thresholds in reverse applies the inverse steps.
- Runtime snapshots committed during a horizontal gesture stay deferred in the existing step-selector model. The horizontal track renders every available gesture-start preview once and translates that stable DOM from total pointer displacement, so state changes cannot alter presentation under the pointer.
- Release presentation first animates the stable track to the successfully committed integer offset, then applies the deferred runtime snapshot and resets the track without a second visible movement. Reduced-motion mode applies the result immediately.
- The immutable-track behavior is horizontal-only. The original vertical selector retains its existing full-step continuous commit and residual-preview path.
- The horizontal track positions values on one row at equal one-fifth-width intervals, preserving the inline layout and spacing while offscreen previews remain clipped inside the control.
- Control 2 uses a separate internal gesture ID, `time-warp-2`, because routing two DOM controls through one active gesture ID would send drag updates to the wrong view.
- Control 2 also uses a separate reveal dock/control so its horizontal panel can open independently from the original Time Warp panel.
- The edge reveal control exposes a narrow opt-out for content swipe closing; only control 2 uses it because its content owns horizontal drag gestures.
- The prototype is intentionally concentrated in the Time Warp touch-control boundary, with a `ponytail` comment marking the temporary factory.

## Validation

- `npx playwright test tests/gui/timeWarpPrototypeControl.spec.ts --project=mobile-chromium` passed: 2 tests covering shared-state routing, uniform left/right track motion, exact midpoint commits, a three-step drag, reverse crossings, immutable gesture anchors and label DOM, and committed/sub-threshold release settling.
- Focused step-selector model, presenter, and gesture helper tests passed: 3 files and 8 tests.
- `npm test` passed: 59 Vitest files with 509 tests, plus all 16 automation-claim tests.
- `npm run test:gui` passed on the final application behavior: 53 mobile Chromium GUI tests. A follow-up focused screenshot run also passed after adding a transform-settle assertion that prevents capturing the reveal panels mid-animation.
- `npm run build` passed after config validation and TypeScript checks. Vite still reports the existing chunk-size warning.
- Biome checks on all edited TypeScript, TSX, CSS, and GUI test files passed; `git diff --check` passed.
- In-app browser smoke testing reached Free Roam without console errors. Its fine-pointer environment hides touch controls, so the touch-enabled Playwright suite remains the visual authority.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`; both controls are visible, readable, upright, and unobstructed. Control 2's values remain on one row with no overlap in the captured mobile state.

## Follow-Ups

- Remove `Time Warp control 2` and the temporary factory once the preferred mobile Time Warp direction is chosen.
