# Horizontal Time Warp Prototype

## Summary

- Added a temporary second mobile Time Warp selector labeled `Time Warp control 2`.
- Kept the existing Time Warp selector visible and usable in its original reveal panel.
- Put the horizontal prototype in a separate reveal panel so the two controls can be compared independently.
- Made control 2 use horizontal left/right drag distance while keeping its labels upright.
- Ordered control 2 from the lowest value on the left to the highest value on the right.
- Made control 2's whole value strip follow total finger displacement from one immutable gesture origin: left drag moves left and right drag moves right.
- Made long drags select across multiple values at symmetric half-slot thresholds, including when the drag reverses.
- Kept the gesture-start labels fixed while dragging so logical Time Warp commits cannot rebuild, recenter, or jump the strip.
- Made every held label continuously inherit the original selector's visual hierarchy from its live distance to center: centered values are largest, amber, and glowing; neighboring and farther values become progressively smaller, paler, and less visible.
- Added a lower row of vertical grip ticks aligned one-to-one with the frozen values. Each tick inherits the same live center proximity, giving the centered value a tall amber mark while neighboring and farther marks become shorter and more muted.
- Added proximity-driven breathing room around the elevated region: values on either side move outward by up to 6px while values already on the same side keep their existing pitch.
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
- The horizontal value order runs from low on the left to high on the right. Increase values sit right of the current value and decrease values sit left, so dragging left pulls a higher value toward the center while the strip follows the finger.
- Horizontal drag commits are measured from the original pointer position for the entire gesture. Crossing `0.5`, `1.5`, `2.5`, and later slot midpoints updates shared Time Warp state one step at a time; crossing those thresholds in reverse applies the inverse steps.
- Runtime snapshots committed during a horizontal gesture stay deferred in the existing step-selector model. The horizontal track renders every available gesture-start preview once and translates that stable DOM from total pointer displacement, so state changes cannot alter presentation under the pointer.
- The view publishes the same immutable displacement used by the track plus each frozen label's start offset. CSS combines those two numbers into absolute center distance, so color, size, glow, and opacity remain entirely pointer-driven while the gesture is held. At a midpoint the two adjacent labels therefore have identical presentation, independent of which logical value is committed.
- Each horizontal step owns a decorative CSS pseudo-element beneath its label, so the grip tick shares the frozen step's movement without adding DOM identity, accessibility, state, or input behavior. Tick height and width intensify as the step approaches center; color, opacity, glow, cap muting, drag timing, settle timing, and reduced-motion behavior reuse the label's existing proximity variables and transition rules.
- The same signed center distance is clamped to `-1...1` for horizontal wrapper spacing. That shifts the two sides apart smoothly as labels elevate, preserves spacing within each non-elevated side, and follows the existing drag/release timing without introducing a second state source.
- Release presentation first animates the stable track to the successfully committed integer offset, then applies the deferred runtime snapshot and resets the track without a second visible movement. Reduced-motion mode applies the result immediately.
- The immutable-track behavior is horizontal-only. The original vertical selector retains its existing full-step continuous commit and residual-preview path.
- The horizontal track positions values on one row at equal one-fifth-width intervals, preserving the inline layout and spacing while offscreen previews remain clipped inside the control. The mobile surface is 172px wide so the two enlarged midpoint labels remain separated.
- Horizontal snapshots request at most 16 previews in either direction. Together with the separately rendered current value, this exposes the complete 17-value Time Warp ladder from `x1s` through `x15h` from any starting value, while preserving the existing endpoint behavior and bounding the frozen DOM and hot-path preview work.
- Control 2 uses a separate internal gesture ID, `time-warp-2`, because routing two DOM controls through one active gesture ID would send drag updates to the wrong view.
- Control 2 also uses a separate reveal dock/control so its horizontal panel can open independently from the original Time Warp panel.
- The edge reveal control exposes a narrow opt-out for content swipe closing; only control 2 uses it because its content owns horizontal drag gestures.
- The prototype is intentionally concentrated in the Time Warp touch-control boundary, with a `ponytail` comment marking the temporary factory.

## Validation

- The focused Time Warp Playwright run passed: 3 tests covering shared-state routing, the full configured ladder, uniform left/right track motion, exact midpoint commits, a multi-step drag to the global cap, reverse crossings, immutable gesture anchors and label DOM, center-distance label/tick appearance parity, midpoint symmetry, cap muting, no overlap or clipping, committed/sub-threshold release settling, and the mobile screenshot states.
- Focused step-selector model, presenter, and gesture helper tests passed: 3 files and 8 tests.
- `npm test` passed: 60 Vitest files with 510 tests, plus all 16 automation-claim tests.
- `npm run test:gui` passed on the final application behavior: 55 mobile Chromium GUI tests, including resting, held-drag, and settled elevated-value Time Warp screenshots.
- `npm run build` passed after config validation and TypeScript checks. Vite still reports the existing chunk-size warning.
- Biome checks on all edited TypeScript, TSX, CSS, and GUI test files passed; `git diff --check` passed.
- In-app browser smoke testing reached Free Roam without console errors. Its fine-pointer environment hides touch controls, so the touch-enabled Playwright suite remains the visual authority.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`, `mobile-time-warp-control-dragging.png`, and `mobile-time-warp-control-elevated-spacing.png`; both controls are visible, readable, upright, and unobstructed. The grip ticks remain aligned beneath their labels, the held midpoint shares elevation across both matching ticks, and the settled centered tick stays clear of the clipped window edge.
- For the low-to-high order follow-up, 7 focused selector unit tests, both prototype GUI tests, the targeted Time Warp screenshot test, the full 55-test GUI suite, Biome, diff checking, and the production build passed. The three regenerated Time Warp screenshots show ascending values, finger-following drag motion, and a centered `x4s` settle without overlap.

## Follow-Ups

- Remove `Time Warp control 2` and the temporary factory once the preferred mobile Time Warp direction is chosen.
