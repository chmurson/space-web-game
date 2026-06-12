# Shipit State

Task: Tutorial improvement
Branch: tutorial-improvement
Current Mode: review
Status: active

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [ ] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Created `tutorial-improvement` from local `main` because existing `origin/tutorial-improvement` is already contained in local `main`.
- No executable app code has changed yet, so tests, build, and Netlify deploy are not required for this setup step.
- Entering brainstorm mode because the specific tutorial improvement scope is not defined yet.
- First scoped improvement: when a tutorial coach prompt focuses a mobile touch control, dim/blur the rest of the game while the focused control and tooltip render above the dim layer.
- Use existing tutorial prompt metadata and touch-control rendering paths rather than adding a separate tutorial overlay subsystem.
- `focusedTouchControl` is specific to touch controls and is optional on coach prompts.
- The in-app browser mobile viewport does not emulate coarse-pointer media, so DOM/z-index verification is possible there but the touch controls remain visually hidden in that environment.
- PR/commit was not requested for this slice.
- Second scoped improvement: apply the same dim/blur focus effect when tutorial coach prompts focus telemetry UI pills such as speed or thrust.
- `focusedHudElement` is separate from `focusedTouchControl` so telemetry pill focus and touch-control focus can use different DOM layering without mixing ownership.
- User accepted the current review and requested merge, but asked to keep the Shipit workflow open for further tutorial improvements.

## Open Questions

- None for this slice.

## Validation

- [x] `npm test -- --run` passed.
- [x] `npm run build` passed with the existing Vite chunk-size warning.
- [x] Scoped `npx biome check ...` for touched files passed.
- [x] `git diff --check` passed.
- [x] Browser DOM/z-index verification for focused touch control and focused telemetry pill states passed.
- [x] `npm run deploy:netlify` passed and deployed to staging.

## Next Step

Commit and merge this slice into `main`, deploy production, and keep Shipit state active for handoff/future improvements.

## Brainstorm Handoff

Problem statement: The tutorial needs improvement, but the target issue and expected player-facing behavior are still undefined.

Goals:

- Identify the tutorial friction to improve.
- Define the intended player-facing behavior before implementation.
- Keep changes scoped to tutorial-related behavior, UI, copy, or tests unless design identifies a necessary shared runtime change.

Non-goals:

- No unrelated gameplay, controls, or settings refactors.
- No deployment until executable app code, runtime behavior, or user-visible site output changes.

Accepted decisions:

- Start from local `main`.
- Use Shipit state for durable workflow tracking.

Unresolved questions: none for this slice.

User-facing behavior:

- During the decanting/tutorial thrust-control step on mobile, the focused burn control should appear above a dim/blur layer, with the coach tooltip also above that layer.

Edge cases and failure states:

- If no focus target exists or the target control is hidden, the dimming layer should not block input and should not hide the tooltip.

## Design Handoff

Implementation scope:

- Add a typed prompt presentation field for a focused mobile control target.
- Resolve that field through scenario prompt resolution and content helpers.
- Mark the relevant tutorial steps that anchor to the thrust control with the burn-control focus target.
- Extend `TouchControls` with a method that receives the focused target and toggles CSS state on the touch-controls panel/reveal control.
- Add a dim/blur layer inside the touch controls panel and z-index styling so the focus target and coach prompt render above it.

Target files:

- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioPrompts.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingTypes.ts`
- `src/presentation/hudPresentation.ts`
- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/touchControls.css`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- Existing focused tutorial tests as needed.

Data/UI flow:

- Tutorial prompt definition declares `focusedTouchControl: 'burn'` for mobile thrust-control steps.
- `resolveScenarioPrompts` resolves that field for active coach prompts.
- HUD presentation sends the active prompt focused control to `touchControls.setTutorialFocusedControl`.
- Touch controls toggles `data-tutorial-focused-control` and a focused class on the matching reveal control.
- CSS displays the touch-control dimming layer only when a focused control exists and lifts the focused reveal control plus the coach prompt above the layer.

Risks:

- Z-index ordering can regress tooltips or modal prompts if values are too broad.
- The focus overlay must stay pointer-event transparent so it does not block tutorial interaction.
- Prompt identity must include focused target to avoid stale DOM state.

Test strategy:

- Unit coverage for resolved tutorial prompt content and scenario prompt resolution.
- Build/test validation after implementation.

Cleanup expectations:

- Keep focus-target naming specific to touch controls for now.
- Avoid creating generic focus infrastructure unless another target needs it.

Expected completion criteria:

- The burn reveal/thrust control is visually above the dim layer during the focused tutorial step.
- The coach tooltip renders above the dim layer.
- No dim layer appears for non-focused prompts.

## Task Slices

- [x] Add prompt typing/resolution for focused touch controls.
- [x] Mark thrust-control tutorial steps with the burn focus target.
- [x] Propagate active focused control from HUD presentation to touch controls.
- [x] Add touch-control dim layer and focused z-index styling.
- [x] Update focused tests and run validation.
- [x] Add prompt typing/resolution for focused HUD pill targets.
- [x] Mark speed-pill tutorial prompts with focused HUD pill targets and support thrust-pill as a HUD focus target.
- [x] Add app-level dim layer and focused telemetry-pill styling.
- [x] Update focused tests and re-run validation/deploy.

## Implementation Handoff

Changed files:

- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioPrompts.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingTypes.ts`
- `src/presentation/hudPresentation.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/touchControls.css`
- `src/style.css`
- `tests/scenario/scenarioPrompts.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

Behavior implemented:

- Tutorial coach prompts can resolve an optional `focusedTouchControl`.
- Tutorial coach prompts can resolve an optional `focusedHudElement`.
- Mobile `intro-thrust` and `intro-thrusting-off` focus the burn control.
- `intro-keep-thrusting`, `intro-thrusting-complete`, and desktop `intro-thrusting-off` focus the speed HUD pill.
- HUD presentation passes active focused-control metadata to touch controls.
- Touch controls raise the focused reveal control above a dim/blur layer and mark the focused target in DOM state.
- Prompt UI raises focused telemetry pills above an app-level dim/blur layer and marks the focused target in DOM state.
- Coach prompts with a focused touch control are raised above the dim/blur layer.
- Coach prompts with a focused HUD element are raised above the dim/blur layer.
- The thrust-control coach anchor falls back to the burn reveal control when the thrust control itself is not open/measurable.

Deviations from design:

- No separate dim layer DOM element was added; the dim/blur layer uses a `::before` pseudo-element on `.touch-controls`.
- HUD pill focus also uses a pseudo-element, on `#app`, instead of adding extra runtime DOM.

Blockers:

- None.

Known gaps:

- In-app browser verification cannot visually show touch controls because the viewport override does not emulate coarse pointer media.

## Cleanup Notes

Cleanup performed:

- Kept focused-control metadata scoped to tutorial coach prompts and touch controls.
- Kept focused-HUD metadata scoped to telemetry pill targets and prompt UI.
- Used a `::before` pseudo-element for the dim layer instead of adding extra runtime DOM.
- Added thrust-control anchor fallback only where it supports the focused burn-control tutorial state.
- Ran a scoped Biome check on touched files and fixed touched-file import/format issues.
- Moved focused telemetry-pill CSS after active telemetry state styles so the focus treatment wins over thrusting/crashed variants.

Cleanup intentionally skipped:

- Did not run `npm run lint` because it uses `--write` and the repo has pre-existing import-order diagnostics outside this slice.
- Did not create generic spotlight/focus infrastructure because the current touch-control and HUD-pill targets have different DOM ownership.

Stale artifacts/docs:

- Shipit state updated inline; no separate artifacts to archive.

## Review Notes

Supplied findings:

- None.

Self-review findings:

- Fixed anchor behavior so `thrust-control` coach prompts fall back to the burn reveal control when the thrust control itself is not open/measurable.
- Fixed focused telemetry-pill CSS ordering so active telemetry variants do not override the focus treatment.
- No further in-scope code defects found in the final diff.

Solution retrospect:

- The prompt metadata approach is still the right shape for this slice because tutorial steps declare focus intent and UI owners apply DOM layering.
- A generic spotlight system is not justified yet; touch controls and HUD pills need different stacking contexts.
- Test coverage is enough for metadata resolution and tutorial content; CSS layering was verified through browser DOM/computed style checks.
- No user-facing docs are needed for this visual tutorial change.
- Shipit handoff is sufficient for another agent to continue.

Requirement coverage:

- Focused burn control is raised above a dim/blur layer for mobile thrust-control tutorial prompts.
- Focused speed HUD pill is raised above an app-level dim/blur layer for speed-pill tutorial prompts.
- Coach tooltip is raised above the dim/blur layer while focused control is active.
- Dimming is inactive when prompts do not declare a focused touch control or focused HUD element.

Residual risk:

- Full visual inspection of touch controls could not be performed in the in-app browser because its viewport override does not emulate coarse-pointer media. Touch-control visual state was verified with Chrome mobile/touch emulation.

Validation results:

- `npm test -- --run`: passed, 29 files and 130 tests.
- `npm run build`: passed; Vite reported the existing large chunk warning.
- Scoped `npx biome check` on touched files: passed.
- `git diff --check`: passed.
- Browser verification: active title `Use Thrust`, touch focus `burn`, focused reveal `touch-thrust-reveal`, dim blur `blur(5px)`, focused reveal z-index `33`, prompt z-index `99`.
- Chrome mobile/touch verification: active title `Nice!`, app HUD focus `speed-pill`, focused speed pill class `telemetry-pill-tutorial-focused`, app dim blur `blur(5px)`, app dim z-index `97`, focused pill transform `scale(1.12)`, prompt z-index `99`.
- `npm run deploy:netlify`: passed.

Deploy:

- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a2c1cce4c9d4a369033cc31--fanciful-bunny-d77b4b.netlify.app
- Deploy ID: `6a2c1cce4c9d4a369033cc31`

## Merge Notes

- Merge requested after review approval.
- Keep this workflow `active` rather than marking it completed because more tutorial improvements may follow.
