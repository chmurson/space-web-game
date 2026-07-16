# Mobile RCS Yaw Control

## What Changed

- Added a mobile-only edge-reveal RCS yaw control separate from the Burn/Main Thrust control.
- Added a horizontal analog slider with a centered neutral thumb, proportional left/right yaw, cyan glass styling, center mark, and center-to-thumb energy fill.
- Added an analog virtual-turn path on `KeyboardInput` so touch RCS can feed `ControlInput.turn` without approximating with binary virtual keys.
- PR #223 follow-up reversed the RCS drag mapping and added a separate actual-turn feedback arc around the spacecraft while RCS input is causing real rotation.
- The latest PR follow-up halves the maximum yaw rate again and turns the feedback into a continuous, angle-faded trail that passes 180 degrees without changing direction.

## Why

Issue #222 requests temporary mobile rotational maneuvering that feels like a precise cockpit RCS control, not a sticky thrust throttle. `ControlInput.turn` was already numeric, so the smallest compatible change was to add an analog virtual turn value and route the new touch control through the existing mobile touch-control session flow.

## Key Files

- `src/input/keyboardInput.ts` owns the clamped analog virtual-turn input and clears it with other virtual controls.
- `src/ui/touchControls/createTouchControls.ts` owns reveal placement, gesture session integration, and clear-on-release/close behavior.
- `src/ui/touchControls/rcsYawControl.tsx` and `rcsYawControl.css` own the RCS DOM, visuals, and touch drag rendering.
- `src/ui/touchControls/rcsYawControlModel.ts` owns pure track geometry and sign mapping.
- `src/runtime/rcsActualTurnFeedback.ts` owns unwrapped actual-turn accumulation, the one-revolution visible trail window, and trim after rotation stops.
- `src/runtime/frameLoop.ts`, `src/presentation/spacecraftPresentation.ts`, `src/ui/overlayUI/createOverlayUi.ts`, and `src/style.css` route and render the dedicated RCS feedback overlay independently from target-heading planning.

## Decisions

- The RCS reveal defaults to the left edge so it remains visually and functionally separate from the existing right-edge Burn control.
- Right drag now maps to positive `turn`; left drag maps to negative `turn`, per the PR #223 owner follow-up.
- The RCS slider track declares itself as an edge-reveal gesture owner so horizontal yaw drags do not close the panel. A small `X` affordance closes the panel and clears turn input.
- Desktop keyboard behavior is unchanged; keyboard left/right keys still do not produce manual turn.
- The actual-turn feedback arc is driven from the spacecraft heading delta after simulation advances. It does not read or mutate `targetHeading`, `targetHeadingTurn`, or the `headingTargetTurnSlice` element.
- The feedback arc reuses the heading-slice visual radius/path language through generic presentation geometry, but renders in its own SVG overlay and clears through its own runtime UI state.
- PR #223’s turning-response follow-up stores angular velocity on the spacecraft. The RCS knob still changes its requested turn speed immediately, while physics ramps toward that speed and brakes smoothly to rest after release; the feedback arc remains active while that residual rotation is real.
- The maximum requested RCS yaw rate is `0.225` rad/s, half of the prior `0.45` rad/s cap; acceleration and braking remain separately tuned at `0.9` and `1.8` rad/s².
- RCS feedback headings are accumulated as unwrapped signed angles. Presentation renders adjacent solid slices instead of normalizing the total arc to the shortest angle, so the trail continues through 180 degrees. Slice opacity is derived from angular distance behind the spacecraft, and the oldest edge advances after one full revolution, making fade speed follow actual turn speed without a second timer.

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

PR #223 follow-up validation:

- `npx vitest run --config vite.config.ts tests/ui/rcsYawControlModel.test.ts tests/runtime/rcsActualTurnFeedback.test.ts tests/presentation/spacecraftPresentation.test.ts tests/input/keyboardInput.test.ts`
- `npx playwright test --config playwright.config.ts tests/gui/rcsYawControl.spec.ts`
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "captures the mobile RCS yaw and thrust controls together"`; inspected `tmp/playwright-results/mobileHudScreenshot-captur-2cb93-nd-thrust-controls-together-mobile-chromium/mobile-rcs-yaw-actual-turn-feedback.png`.
- `npm test`
- `npm run build`
- `npm run test:gui`
- `npx biome check ...` on the changed source, test, and CSS files; passed with the existing `src/style.css` `!important` warnings. Markdown tech notes are ignored by the repo Biome config.
- `git diff --check`
- `coderabbit --base main --agent`; zero findings.

Turning-response follow-up validation:

- `npx vitest run --config vite.config.ts tests/simulation/physics/semiImplicitEuler.test.ts tests/runtime/simulationStep.test.ts tests/runtime/rcsActualTurnFeedback.test.ts`

Continuous-trail follow-up validation:

- `npx vitest run --config vite.config.ts tests/simulation/physics/semiImplicitEuler.test.ts tests/runtime/rcsActualTurnFeedback.test.ts tests/presentation/spacecraftPresentation.test.ts tests/presentation/hudPresentation.test.ts` (29 tests passed).
- `npm test` (522 unit tests and 16 automation-claim tests passed).
- `npm run build`.
- `npm run test:gui` (52 browser tests passed).
- The focused RCS screenshot case passed five consecutive runs. The final full-suite artifact at `tmp/playwright-results/mobileHudScreenshot-captur-2cb93-nd-thrust-controls-together-mobile-chromium/mobile-rcs-yaw-actual-turn-feedback.png` was inspected and showed a continuous greater-than-180-degree trail, angle-based tail fade, normal 1x HUD state, and unchanged RCS/thrust control styling.
- Focused `npx biome check ...` passed with only the three pre-existing `src/style.css` `!important` warnings; `git diff --check` passed.
- `coderabbit --base main --agent` was attempted, but the execution environment blocked uploading unpublished local diff content. The Ponytail and local self-review completed without additional findings; normal PR automation remains the external review path.

## Follow-Ups

- No product follow-up is currently known. CodeRabbit local-agent review remains unavailable in this execution environment because of its external-data policy.
