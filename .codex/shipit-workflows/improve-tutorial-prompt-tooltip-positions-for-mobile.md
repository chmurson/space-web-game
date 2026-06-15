# Shipit State

Task: Improve tutorial prompt tooltip positions for mobile
Branch: improve-tutorial-prompt-tooltip-positions-for-mobile
Current Mode: yeet
Status: in progress

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

- Branch created from `target-body-selection-ui-control` HEAD on 2026-06-14.
- User requested Shipit workflow for this branch after branch creation.
- No `.codex/shipit.config.md`, `.codex/delivery-flow.config.md`, or `.codex/workflow.config.md` is present; use the existing repository Shipit state-file pattern plus `AGENTS.md`.
- This branch is non-`main`; executable/user-visible changes should be validated and deployed to the shared staging site before handoff.
- Initial task title corrected from `tutoral` to `tutorial` in the branch/state wording.
- User clarified on 2026-06-14 that tutorial prompts requiring a button action in the prompt should move to the same mobile bottom placement as the initial tutorial prompt.
- Keep automatic, non-button coach prompts anchored to their target controls/HUD elements.
- Avoid hard-coding individual tutorial prompt ids in the UI renderer; use prompt presentation metadata and/or derived prompt properties so future button-driven tutorial prompts can opt into the same layout.
- User requested a follow-up on 2026-06-14: dismissible scenario prompts with a close button should also close when clicking the dimmed backdrop area.
- Backdrop-click dismiss should only apply when the close button has a valid prompt action; non-dismissible prompts and clicks inside the prompt card must not dismiss.

## Open Questions

- none

## Validation

- [x] Focused prompt/scenario tests
- [x] `npm test`
- [x] `npm run build`
- [x] Browser verification at narrow mobile viewport(s)
- [x] `npm run deploy:netlify` after executable/user-visible changes

## Next Step

Stage the intended changes, commit, push, open and merge a PR to `main`, then deploy production from `main`.

## Brainstorm Handoff

### Current Understanding

The feature should improve the position of tutorial prompt tooltips on mobile. The current coach prompt system resolves tutorial prompt anchors, focuses touch controls/HUD pills, and positions coach prompts with Floating UI. Mobile prompt placement likely needs better constraints around narrow viewport edges, bottom touch controls, and safe-area spacing so prompt cards do not overlap the controls they are teaching or feel detached from their anchor.

### Code Findings

- `src/ui/scenario-prompts/scenario-prompts.ts` owns prompt DOM updates and anchored coach prompt positioning.
- Coach prompt placement currently calls `computePosition(anchorElement, promptElement, { placement: 'top-end', middleware: [offset(12), flip({ padding: 10 }), shift({ padding: 10 }), arrow(...)] })` for every anchored coach prompt.
- `getAnchorElement` maps tutorial prompt anchors such as `speed-pill`, `time-warp-pill`, `thrust-pill`, `time-warp-control`, and `thrust-control` to HUD pills or edge-reveal touch controls.
- `getEdgeRevealControlAnchor` chooses the inner control only when the reveal is open and visible; otherwise it falls back to the reveal tab/control container.
- `src/ui/scenario-prompts/scenario-prompts.css` defines the coach prompt shell. On mobile it only changes the coach prompt width/max-width, not placement, arrow offset, or viewport padding.
- `src/scenario/scenarioPrompts.ts` resolves prompt definitions into mobile/desktop prompt state but does not make placement decisions beyond choosing anchors/focus targets from scenario definitions.
- `tests/scenario/scenarioPrompts.test.ts` already covers mobile prompt resolution for touch controls and HUD pills, but not DOM/Floating UI placement behavior.

### Goals

- Make tutorial coach prompts land in clearer, less obstructive positions on mobile.
- Keep prompt cards visibly related to their anchors where possible.
- Respect mobile safe areas and narrow viewport constraints.
- Avoid changing desktop prompt behavior unless needed to keep shared code correct.
- Keep the implementation small and aligned with the existing prompt updater/Floating UI approach unless evidence shows a separate mobile path is needed.

### Non-Goals

- Rewriting tutorial content or onboarding progression logic.
- Reworking touch-control interaction patterns.
- Changing blocking/modal prompt layout unless it is directly affected by mobile tooltip positioning.
- Adding new dependencies; `@floating-ui/dom` is already available.

### Candidate Design Directions

1. Use mobile-aware Floating UI options: choose placement per anchor/input mode, increase viewport padding/safe-area-aware boundaries, and use `autoPlacement` or fallback placements for bottom controls.
2. Add anchor-specific mobile placement preferences: for bottom controls, prefer top/centered placements; for top HUD pills, prefer bottom/side placements; for collapsed edge-reveal tabs, avoid placing under the tab edge.
3. Add a small pure placement-policy helper that maps `{ inputMode, anchorKey }` to placement/middleware padding. This could be unit tested without exporting internal DOM positioning functions solely for tests.
4. Add browser verification as the primary confidence check because final position depends on real DOM geometry, viewport dimensions, CSS, and Floating UI middleware.

### Edge Cases And Failure States

- Very narrow mobile widths where the prompt must shift away from the anchor to remain readable.
- Bottom edge controls and tabs near safe-area insets.
- Collapsed versus open edge-reveal controls, especially when `getEdgeRevealControlAnchor` switches anchors.
- HUD-focused prompts near the top telemetry strip and replay/info pill.
- Missing or hidden anchors, which should continue to fall back to the CSS default position.
- Resize/orientation changes, which should continue to reposition prompts without stale inline styles.

### Likely Target Files

- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- `tests/scenario/scenarioPrompts.test.ts` if prompt resolution changes
- A focused UI test file only if placement policy can be tested through existing public behavior without widening module APIs

## Design Handoff

### Requirement

On mobile, tutorial prompts that require the player to press a button inside the prompt should use the same bottom prompt placement as the initial tutorial prompt. Prompts that advance automatically based on gameplay should remain anchored coach prompts.

### Scope

- Add a prompt presentation layout concept for coach prompts so the renderer can distinguish anchored coach prompts from mobile bottom-sheet coach prompts without checking specific tutorial prompt ids.
- Mark tutorial onboarding prompts with a primary `advance-onboarding-step` button as bottom layout on mobile while keeping their existing desktop coach behavior.
- Render mobile bottom-layout coach prompts through the existing modal/bottom-sheet prompt mode so they reuse the initial prompt's mobile placement and avoid Floating UI anchor positioning.
- Keep action dispatch, replay prompt behavior, and automatic coach prompt anchoring unchanged.

### Target Files

- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioPrompts.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `tests/scenario/scenarioPrompts.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

### Risks

- Bottom-layout coach prompts still carry coach metadata for replay/resolution tests; the UI must suppress anchor positioning when their resolved layout is bottom.
- Prompt identity comparison must include the layout so switching between anchored and bottom prompt surfaces triggers DOM updates.
- Desktop behavior should remain anchored for onboarding coach prompts unless explicitly changed.

### Validation Plan

- Focused prompt resolution tests for mobile bottom layout and desktop anchored layout.
- `npm test`
- `npm run build`
- Browser verification at a narrow mobile viewport.
- `npm run deploy:netlify` before handoff because this branch changes user-visible runtime behavior.

## Task Slices

- [x] Add resolved prompt layout typing and resolver support.
- [x] Mark button-driven tutorial onboarding prompts as mobile bottom layout without hard-coded renderer ids.
- [x] Teach the prompt updater to use modal/bottom placement for resolved bottom-layout coach prompts and skip Floating UI anchoring.
- [x] Add focused tests for the bottom-layout prompt resolution.
- [x] Run cleanup, review, validation, browser verification, and staging deploy.

## Implementation Handoff

### Changed Files

- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioPrompts.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingTypes.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/presentation/hudPresentation.ts`
- `tests/scenario/scenarioPrompts.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

### Behavior Implemented

- Added `ScenarioCoachPromptLayout` with `anchored` and `bottom` options.
- Resolved coach prompts now carry a `layout`, defaulting to `anchored`.
- Tutorial onboarding definitions automatically assign mobile `bottom` layout to coach prompts that use the `advance-onboarding-step` button, while desktop remains `anchored`.
- The prompt renderer maps anchored coach prompts to existing Floating UI placement and bottom-layout coach prompts to existing modal/bottom-sheet placement.
- Mobile touch-control and HUD focus highlighting now only applies to anchored coach prompts.
- Tests cover mobile bottom layout for `intro-thrusting-complete`, `intro-trajectory`, and `intro-complete`, plus anchored desktop/no-button behavior.

### Deviations, Blockers, Known Gaps

- No deviations from design.
- No blockers.
- Browser verification used Chrome DevTools fallback because the in-app Browser connection became unavailable after an initial navigation attempt.

## Cleanup Notes

- Ran Biome formatting on touched source and test files.
- No shared helper extraction beyond the tutorial onboarding layout helper; the rule is local to tutorial action prompts and does not justify broader abstraction.
- No stale docs or generated artifacts required cleanup.

## Review Notes

### Automated Review

- CodeRabbit command: `coderabbit --base main --agent`
- Result: completed with 0 findings.

### Self-Review

- Checked that bottom-layout coach prompts delete anchor data before rendering and therefore skip Floating UI placement and arrow display.
- Checked that mobile touch/HUD focus highlighting only remains active for anchored coach prompts.
- Checked that the tutorial onboarding helper scopes the automatic bottom layout to coach prompts using the `advance-onboarding-step` button.
- No in-scope defects found during self-review.

### Retrospect

- The added `layout` field is preferable to changing `kind` from `coach` to `blocking` because it preserves prompt semantics and action handling while allowing the UI surface to change.
- The layout helper is intentionally local to tutorial onboarding; broader prompt-system automation can be considered later if other scenarios need the same rule.
- Test coverage covers resolver behavior for current button-driven tutorial prompts and default anchored behavior.
- No follow-up issues proposed.

### Validation Results

- Passed: focused prompt tests with `npm test -- --run tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- Passed: `npm test`
- Passed: `npm run build`
- Passed: `git diff --check`
- Passed browser verification at mobile-sized viewport using Chrome DevTools fallback:
  - Initial `Leave Earth Orbit` prompt rendered as `data-prompt-mode="modal"` with no anchor.
  - Seeded `intro-thrusting-complete` action prompt rendered as `data-prompt-mode="modal"`, no anchor, hidden arrow, no focused HUD/touch data, and matching bottom geometry.
- Passed staging deploy with `npm run deploy:netlify`.

### Deploy

- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a2f1bcca5cda1d872c3c93d--fanciful-bunny-d77b4b.netlify.app
- Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2f1bcca5cda1d872c3c93d

### Residual Risk

- The in-app Browser was unavailable after an initial connection drop, so browser verification used Chrome DevTools fallback instead.
- PR/commit was not requested, so yeet mode was not entered.

## Follow-Up Design Handoff: Backdrop Dismiss

### Requirement

When a scenario prompt is dismissible and shows the close button, clicking the dimmed backdrop outside the prompt card should dismiss the prompt using the same action as the close button.

### Scope

- Add a click listener to the scenario prompt backdrop in `src/app/createAppComponents.ts`.
- Dispatch the close button's serialized prompt action only when `event.target` is the backdrop element itself.
- Keep clicks inside the prompt card, confirm/secondary/restart buttons, and non-dismissible prompts unchanged.

### Task Slices

- [x] Add backdrop-click handling through the existing `dispatchPromptAction` path.
- [x] Evaluated focused tests; skipped new unit coverage because the behavior is local DOM listener wiring and browser verified without widening production APIs.
- [x] Run focused/full validation, review, browser verification, and staging deploy.

### Validation Plan

- Run focused scenario prompt tests if prompt behavior tests are updated.
- Run `npm test`.
- Run `npm run build`.
- Browser verify a replay/dismissible prompt closes on backdrop click and non-dismissible prompts do not.
- Run `npm run deploy:netlify`.

## Follow-Up Implementation Handoff: Backdrop Dismiss

### Changed Files

- `src/app/createAppComponents.ts`

### Behavior Implemented

- Added a click listener to `overlayUi.scenarioPrompt`.
- The listener dispatches the close button's existing serialized prompt action when the backdrop element itself is clicked.
- Clicks inside the prompt card are ignored by the backdrop listener.
- Non-dismissible prompts remain unchanged because their close button has no valid prompt action.

### Cleanup Notes

- Ran Biome format on `src/app/createAppComponents.ts`; no formatting changes were needed.
- No helper extraction needed because the logic is one small listener using the existing `dispatchPromptAction` path.

### Verification Notes

- Browser verified a non-dismissible initial prompt stays open after backdrop click.
- Browser verified a dismissible replay prompt stays open after prompt-card click and dismisses to the replay pill after backdrop click.
- No focused unit test was added because this behavior is wired through local DOM event listeners in `createAppComponents.ts`, and exporting those internals solely for testing would violate the repo guidance.

### Review And Validation

- Passed: focused prompt tests with `npm test -- --run tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- Passed: `npm test`
- Passed: `npm run build`
- Passed: `git diff --check`
- CodeRabbit command: `coderabbit --base main --agent`
- CodeRabbit result: completed with 0 findings.
- Staging deploy passed with `npm run deploy:netlify`.

### Follow-Up Deploy

- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a2f1e8eca224e1cdc6d6cd1--fanciful-bunny-d77b4b.netlify.app
- Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2f1e8eca224e1cdc6d6cd1
