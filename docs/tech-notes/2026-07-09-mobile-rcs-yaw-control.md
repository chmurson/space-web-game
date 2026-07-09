# Mobile RCS Yaw Control

## What Changed

- Added a mobile-only edge-reveal RCS yaw control separate from the Burn/Main Thrust control.
- Added a horizontal analog slider with a centered neutral thumb, proportional left/right yaw, cyan glass styling, center mark, and center-to-thumb energy fill.
- Added an analog virtual-turn path on `KeyboardInput` so touch RCS can feed `ControlInput.turn` without approximating with binary virtual keys.

## Why

Issue #222 requests temporary mobile rotational maneuvering that feels like a precise cockpit RCS control, not a sticky thrust throttle. `ControlInput.turn` was already numeric, so the smallest compatible change was to add an analog virtual turn value and route the new touch control through the existing mobile touch-control session flow.

## Key Files

- `src/input/keyboardInput.ts` owns the clamped analog virtual-turn input and clears it with other virtual controls.
- `src/ui/touchControls/createTouchControls.ts` owns reveal placement, gesture session integration, and clear-on-release/close behavior.
- `src/ui/touchControls/rcsYawControl.tsx` and `rcsYawControl.css` own the RCS DOM, visuals, and touch drag rendering.
- `src/ui/touchControls/rcsYawControlModel.ts` owns pure track geometry and sign mapping.

## Decisions

- The RCS reveal defaults to the left edge so it remains visually and functionally separate from the existing right-edge Burn control.
- Left drag maps to positive `turn`, matching existing `turnLeft`; right drag maps to negative `turn`, matching existing `turnRight`.
- The RCS slider track declares itself as an edge-reveal gesture owner so horizontal yaw drags do not close the panel. A small `X` affordance closes the panel and clears turn input.
- Desktop keyboard behavior is unchanged; keyboard left/right keys still do not produce manual turn.

## Validation

Performed before handoff:

- `npx vitest run --config vite.config.ts tests/input/keyboardInput.test.ts tests/ui/rcsYawControlModel.test.ts`
- `npx playwright test --config playwright.config.ts tests/gui/rcsYawControl.spec.ts`
- `npm test`
- `npm run build`
- `npx biome lint src tests scripts`
- `git diff --check`
- `npm run test:gui`; inspected `tmp/playwright-results/mobileHudScreenshot-captur-89d5a-bile-RCS-yaw-control-reveal-mobile-chromium/mobile-rcs-yaw-control.png`.
- `coderabbit --base main --agent`; applied valid RCS findings and skipped unrelated desktop HUD overlay findings.

## Follow-Ups

- None currently known.
