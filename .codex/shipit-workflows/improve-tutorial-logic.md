# Shipit State

Task: Improve tutorial logic
Branch: main (merged from improve-tutorial-logic)
Current Mode: yeet
Status: completed

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [x] Merged to main

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Created branch `improve-tutorial-logic` from local `refs/heads/main` at `e162f4c`.
- Local `refs/heads/main` is ahead of `refs/remotes/origin/main`; the requested base was interpreted as the local `main` branch.
- Repository deploy guidance applies: non-`main` executable or user-visible changes should deploy to the shared staging site before handoff.
- Existing untracked files `pnpm-lock.yaml` and `pnpm-workspace.yaml` were present before this branch setup and were left untouched.
- User accepted the reveal-then-drag tutorial direction: teach the `Burn` tab first, then teach dragging the orange thrust handle.
- PR creation was not requested in this turn.
- Follow-up accepted: mobile opening copy should say to swipe inward from the edge, and speed-pill tutorial prompts should keep the thrust control visible above the dimmer.
- Follow-up accepted: dimmer should be weaker, and the time-warp tooltip should follow the Burn-control guidance pattern.
- Follow-up accepted: the high-warp burn prompt should not dim the world, and the two final Continue tooltips after that burn should pause gameplay progression.
- Follow-up accepted: the `Burn At x1m` step should not feel stuck when the player is at `x1m` and burning before the ship has fully reached the outward heading.
- User requested a Shipit review followed by a direct merge to `main`; no PR was opened.

## Open Questions

- None for the accepted implementation direction.

## Validation

- [x] `npm test -- --run tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts` passed: 3 files, 36 tests.
- [x] `npm test` passed: 29 files, 140 tests.
- [x] `npm run build` passed.
- [x] `git diff --check` passed.
- [x] Browser smoke check passed: tutorial starts on `Open Burn Control`, touch-control dimmer reports `rgba(5, 7, 13, 0.5)` and `blur(3px)`.
- [x] Browser smoke check for follow-up 3 was limited by existing browser profile state, but local mobile runtime loaded successfully and had no stale tutorial focus/dimmer attributes; focused tests cover the final prompt state.
- [x] `npm run deploy:netlify` passed.
- [x] On `main`, `npm test` passed: 29 files, 140 tests.
- [x] On `main`, `npm run build` passed.
- [x] On `main`, `npm run deploy:netlify` deployed production.

## Next Step

Done. `improve-tutorial-logic` was merged to `main` and deployed to production.

## Brainstorm Handoff

Current thrust-control tooltip observations:

- Mobile onboarding currently has two thrust-control-related prompts: `intro-show-thrust-control` and `intro-thrust`.
- `intro-show-thrust-control` still says to press and hold in the lower-right control area, but the current mobile UI exposes thrust through the edge-reveal `Burn` tab.
- In the local browser at mobile width, the tutorial advanced directly to `intro-thrust` after starting. The browser could not fully emulate coarse-pointer CSS, but source inspection explains the behavior: docked thrust controls report `interactive` and `visible` even when the reveal panel is closed.
- `intro-thrust` anchors to `thrust-control` on mobile and focuses the `burn` touch control. If the reveal panel is closed, anchor resolution falls back to `#touch-thrust-reveal`, so the tooltip points at the reveal wrapper/tab rather than the actual slider.
- Existing tests currently assert advancement from `intro-show-thrust-control` when the thrust UI state is `interactive: true` and `visible: true`, which may be too broad for an edge-reveal control.

Potential direction:

- Update the first mobile thrust prompt to teach the `Burn` tab/reveal interaction.
- Gate advancement into `intro-thrust` on a state that means the player can actually see or use the thrust slider, not merely that the docked control exists.
- Consider separate copy for the reveal-tab step and the slider-swipe step.

## Design Handoff

Scope:

- Add a runtime UI state field to distinguish the docked thrust slider existing from the `Burn` edge-reveal panel being open.
- Update mobile tutorial prompt copy so the first step teaches opening `Burn`, and the second step teaches dragging the orange slider handle upward.
- Keep desktop thrust progression compatible with keyboard thrust through the existing `hasMainThrust` path.
- Update focused tutorial tests to cover closed vs revealed mobile thrust control states and refreshed copy.

Target files:

- `src/runtime/appRuntimeState.ts`
- `src/ui/touchControls/edgeRevealControl.ts`
- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/thrustControl.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- Focused tutorial/scenario prompt tests.

Risks:

- The edge-reveal control owns open/closed state internally, so the runtime signal needs a small callback from `createEdgeRevealControl`.
- Existing tests construct `touchThrustControl` objects directly and need to include the new field.

Expected completion:

- `intro-show-thrust-control` does not advance merely because the docked thrust control is interactive.
- It advances when the `Burn` panel is revealed or desktop thrust is pressed.
- `intro-thrust` copy and anchor match the visible slider.

## Task Slices

- [x] Add `revealed` to thrust UI state and wire it from the `Burn` edge-reveal open state.
- [x] Update onboarding progression and prompt copy for reveal-then-drag behavior.
- [x] Update focused tests and any runtime fixtures for the new state field.
- [x] Run focused tests, build, Shipit review, and staging deploy.

## Implementation Handoff

Changed files:

- `src/runtime/appRuntimeState.ts`
- `src/ui/touchControls/edgeRevealControl.ts`
- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/thrustControl.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- Focused runtime/scenario test fixtures and tutorial prompt/progression tests.

Behavior implemented:

- Runtime thrust UI state now includes `revealed`, separating “control exists/is interactive” from “the `Burn` reveal panel is open.”
- `createEdgeRevealControl` reports open-state changes through `onOpenChange`.
- `createTouchControls` maps the `Burn` reveal panel open state into `touchThrustControl.revealed`.
- Mobile `intro-show-thrust-control` now says `Open Burn Control`, anchors to `thrust-control`, focuses `burn`, and tells the player to tap the `Burn` tab.
- Mobile `intro-thrust` now tells the player to drag the orange handle upward.
- Mobile `intro-thrusting-off` now tells the player to drag the orange handle back down.
- Mobile high-warp thrust copy now references opening `Burn` and holding the orange handle upward.
- Onboarding now advances from `intro-show-thrust-control` only when the `Burn` panel is revealed or desktop main thrust is active.
- The thrust-off step now completes when touch thrust is disengaged, which matches the docked edge-reveal slider.

Known gaps:

- None identified.

## Cleanup Notes

- Removed incidental formatter churn from `tutorialScenario.test.ts` so the diff stays focused.
- No reusable helper extraction was warranted; the new state signal is scoped to existing touch-control and onboarding boundaries.
- No docs update was needed beyond this Shipit state because the changed copy is in-app tutorial text.

## Review Notes

- No supplied external findings were present.
- Self-review checked the runtime state flow from edge reveal open/close through tutorial progression.
- Regression coverage added for the key bug: an interactive docked thrust control no longer advances the tutorial unless it is revealed.
- Review found one TypeScript narrowing issue in the prompt definition map; fixed by declaring the map as `Record<TutorialOnboardingStepId, PromptDefinition>`.
- Residual risk: low. The in-app browser cannot fully emulate coarse pointer CSS, but a browser smoke check verified the prompt state after tutorial start and unit tests cover the progression logic.
- Staging deploy:
  - Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a2c7f1b553821307ca72d71--fanciful-bunny-d77b4b.netlify.app`
  - Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2c7f1b553821307ca72d71`

## Follow-Up Handoff

Requested changes:

- Mobile copy should instruct players to swipe inward from the edge/Burn tab instead of tapping.
- When the tutorial prompt focuses the speed pill after thrust starts, the Burn/thrust control should remain visible above the dimmer.

Implementation plan:

- Change the mobile `intro-show-thrust-control` description to use swipe-in language.
- Add mobile `focusedTouchControl: 'burn'` to the speed-pill thrust prompts so the Burn control remains highlighted while the speed pill is focused.
- Suppress the touch-controls-owned dimmer when the app is already using the HUD-focus dimmer, so speed pill and Burn can both stay above one backdrop.
- Update focused prompt tests and rerun validation/deploy.

Follow-up implementation:

- Mobile `intro-show-thrust-control` copy now says to swipe inward from the `Burn` tab on the screen edge.
- Mobile `intro-keep-thrusting` and `intro-thrusting-complete` now keep `focusedTouchControl: 'burn'` while also focusing the speed pill.
- `.touch-controls[data-tutorial-focused-control]::before` is hidden when `#app[data-tutorial-focused-hud-element]` is active, so the HUD-focus dimmer remains the single backdrop and the Burn control can stay above it.
- Tests were updated to cover the revised copy and mobile Burn focus on speed-pill prompts.

## Follow-Up Handoff 2

Requested changes:

- Make the tutorial dimmer weaker.
- Review the time-warp tooltip and make it follow the same mobile control guidance pattern as Burn/thrust.

Implementation plan:

- Lower the opacity/blur of both tutorial dimmers.
- Add a `time-warp-control` prompt anchor that resolves to the visible time-warp selector when the `Warp` panel is open, otherwise to the `Warp` reveal control.
- Update mobile `intro-timewarp` copy to instruct swiping inward from `Warp`, then dragging the selector upward to `x1m`.
- Set mobile `intro-timewarp` to focus `warp`.
- Update focused tests and rerun validation/deploy.

Follow-up 2 implementation:

- Weakened tutorial dimmers from `rgba(5, 7, 13, 0.66)` / `blur(5px)` to `rgba(5, 7, 13, 0.5)` / `blur(3px)`.
- Added a `time-warp-control` prompt anchor and shared edge-reveal anchor resolution for Burn and Warp controls.
- Mobile `intro-timewarp` now focuses `warp`, anchors to `time-warp-control`, and tells players to swipe inward from `Warp`, then drag upward until the time pill reaches `x1m`.
- Tests were updated for the time-warp prompt anchor/focus/copy.
- Latest staging deploy:
  - Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a2c813056b5422e77d97616--fanciful-bunny-d77b4b.netlify.app`
  - Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2c813056b5422e77d97616`

## Follow-Up Handoff 3

Requested changes:

- Do not dim anything during the high-warp burn step where the player burns at `x1m`.
- Pause gameplay progression for the final two Continue tooltips after that burn.

Implementation plan:

- Remove mobile Burn focus from `intro-timewarp-thrust`, keeping the coach tooltip but avoiding touch-control dimming while the player watches the world.
- Add an explicit `pausesGameplay` prompt flag so coach prompts can pause the simulation without changing into blocking modals.
- Mark only `intro-trajectory` and `intro-complete` with `pausesGameplay: true`.
- Update focused prompt/progression tests and rerun validation/deploy.

Follow-up 3 implementation:

- `intro-timewarp-thrust` no longer sets `focusedTouchControl: 'burn'`, so mobile does not get the touch-control dimmer during the `x1m` burn step.
- Added `pausesGameplay` to prompt definitions and resolved prompt state; blocking prompts still pause by default.
- The frame loop now skips simulation stepping and scenario advancement whenever the resolved active prompt pauses gameplay.
- `intro-trajectory` and `intro-complete` are pausing coach prompts, so their Continue tooltips keep the game frozen until acknowledged.
- Tests were updated for the no-dim high-warp burn prompt, final-prompt pause flags, and default blocking-prompt pause behavior.
- Latest staging deploy:
  - Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a2c849d1db5f336b865a919--fanciful-bunny-d77b4b.netlify.app`
  - Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2c849d1db5f336b865a919`

## Follow-Up Handoff 4

Reported issue:

- The `Burn At x1m` step could appear not to progress.

Cause:

- Normal `x1` speed is not sufficient; the step requires the `x1m` time-warp notch.
- More importantly, the step also required the ship heading to be within the outward-heading tolerance before burn time accumulated. That hidden condition could reset the 2-second burn counter even while the player was visibly doing what the prompt asked.

Implementation:

- Removed the hidden outward-heading gate from `intro-timewarp-thrust` progression.
- The step now advances after 2 seconds of main thrust while the time warp multiplier is `x1m` or higher.
- Kept the tutorial behavior that points the ship outward when entering the step.
- Updated the prompt copy to describe `x1m` as the one-minute warp notch, making it clearer that normal `x1` is not enough.
- Added a regression test proving high-warp thrust progresses even while the ship is still turning outward.
- Latest staging deploy:
  - Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a2c86fcd65ff929e40321c2--fanciful-bunny-d77b4b.netlify.app`
  - Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2c86fcd65ff929e40321c2`

## Shipit Review Before Main Merge

Findings:

- No blocking defects found.
- Cleanup performed: removed the now-unused `outwardHeadingToleranceRadians` export after the high-warp burn step stopped depending on hidden heading alignment.

Self-review coverage:

- Checked tutorial prompt resolution, mobile touch-control focus, edge-reveal anchoring, prompt pause behavior, onboarding progression gates, and updated regression tests.
- Confirmed unrelated untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` are still excluded from intended changes.

Validation after review:

- `git diff --check` passed.
- `npm test -- --run tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts` passed: 3 files, 36 tests.
- `npm test` passed: 29 files, 140 tests.
- `npm run build` passed with the existing Vite chunk-size warning.

Residual risk:

- Low. Browser smoke coverage for the late tutorial sequence remains less direct than unit coverage, but prompt/progression behavior is covered through public scenario APIs and focused regression tests.

## Main Merge

- Branch commit: `6315ea674dc4ba34c13bcabfe44843f62ca2ba8f` (`feat(tutorial): improve onboarding control guidance`)
- Main merge commit: `68b89ee735e784ff24f713319aed9b25426f5e87` (`Merge branch 'improve-tutorial-logic'`)
- Main validation after merge:
  - `npm test` passed: 29 files, 140 tests.
  - `npm run build` passed with the existing Vite chunk-size warning.
- Production deploy after merge:
  - Production URL: `https://space-web-game.netlify.app`
  - Unique deploy URL: `https://6a2d03178edfb57707b86f21--space-web-game.netlify.app`
  - Build logs: `https://app.netlify.com/projects/space-web-game/deploys/6a2d03178edfb57707b86f21`
