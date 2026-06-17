# Shipit State

Task: Further tutorial improvement
Branch: further-tutorial-improvement
Current Mode: merge
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
- [x] PR opened/updated (not requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Scope this branch to tutorial copy and first-phase tutorial flow behavior.
- Player-facing tutorial copy should use `burn` consistently instead of mixing `burn`, `thrust`, and `burst`.
- The first `Leave Earth Orbit` prompt should stay casual and high-level: learn controls, leave Earth orbit, circle the Moon, return home.
- Remove the old manual `Burn Complete` prompt; `Keep Burning` should lead directly to `Stop The Burn`.
- `Keep Burning` should mention that speed is visible in the speed pill.
- Change the high-warp burn prompt from `x1m` to `x30s`.
- During `Burn At x30s`, keep the coach prompt floating in its original/default position.
- During `Burn At x30s`, hide the trajectory until the player starts burning, then reveal it.
- After 1 second of burn input at at least `x30s`, advance from `Burn At x30s` to the trajectory callout.
- `This Is Your Trajectory` should point to the projected trajectory line and explain its purpose.
- Defer canvas dimming / trajectory-only spotlighting to a later thread.
- Keep the trajectory prompt active until the 3-day prediction has no Earth impact and no completed Earth loop inside that 3-day window.
- A loop that would happen after the 3-day prediction window is fine.
- Keep the trajectory tooltip compact and player-facing; do not mention the internal prediction-window gate there.
- Keep the visible trajectory horizon/control cap at the tutorial's 2-hour default during this coach; use a private 72-hour prediction only for the hidden exit gate.
- Keep the initial leave-Earth zoom cap at `EARTH_VIEWPORT_SIZE`, then raise it to the midpoint between Earth and Earth-Moon viewport sizes once `This Is Your Trajectory` appears.
- After those trajectory conditions are clear for 3 seconds, advance to the completion prompt.
- Cap first-phase time warp at `x30s` during onboarding, then raise it to `x5m` once the `Escape Earth` objective is available; lift the cap further in the Moon phase.
- Keep the first-phase visible coast prediction horizon at 2 hours while the hidden trajectory gate checks 72 hours.

## Open Questions

- None.

## Validation

- [x] `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/scenarioDirectives.test.ts tests/runtime/runtimeStateTransitions.test.ts`
- [x] `npm test`
- [x] `npm run build`
- [x] `git diff --check`
- [x] `npm run deploy:netlify`

## Brainstorm Handoff

Problem statement: the early tutorial needs clearer, more casual copy and better pacing around burn, time warp, and trajectory learning.

Goals:

- Teach burn on/off, speed feedback, time warp, and trajectory reading in a natural order.
- Avoid introducing trajectory/path language before the trajectory is visible and relevant.
- Keep the high-warp burn prompt short and non-anchored.
- Make the trajectory prompt automatic and tied to actual prediction state.

Non-goals:

- No trajectory-only canvas dimming in this slice.
- No broader tutorial framework rewrite.
- No Moon-leg behavior changes except preserving the higher phase-two time warp cap.

User-facing behavior:

- Players see casual, direct copy for the initial tutorial and burn prompts.
- The trajectory stays hidden at the start of `Burn At x30s` and appears once the player burns.
- A new trajectory coach callout points at the trajectory line.
- The trajectory prompt advances only after a private 3-day prediction stops crashing into Earth and stops looping around Earth, then stays clear for 3 seconds.
- The trajectory tooltip says the line predicts path from speed and gravity, and tells the player to use it to see whether the burn is moving away from Earth.

Edge cases and failure states:

- If no trajectory prediction is available, the trajectory prompt does not advance.
- If Earth is unavailable, the trajectory prompt does not advance.
- Earth impact inside the prediction blocks progress.
- A completed net Earth loop inside the prediction blocks progress.
- Angular backtracking without a net Earth loop does not block progress.

## Design Handoff

Implementation scope:

- Update tutorial onboarding copy and step order.
- Add a floating coach layout for the high-warp burn prompt.
- Add progress fields for high-warp burn start and trajectory-clear duration.
- Expose visible trajectory prediction state and an optional private horizon prediction callback to scenario advancement.
- Add a projected DOM anchor for the canvas trajectory so the existing coach tooltip can point to it.
- Update first-phase directives to keep the visible trajectory horizon cap at 2 hours, use an `x30s` onboarding time-warp cap, and use an `x5m` post-onboarding cap.
- Update first-phase viewport directives to unlock the midpoint zoom cap at the trajectory coach step and keep it for the rest of leave-Earth.

Target files:

- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/*`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`
- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/runtime/frameLoop.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/presentation/trajectoryPresentation.ts`
- `src/presentation/hudPresentation.ts`
- `src/ui/overlayUI/createOverlayUi.ts`
- `src/ui/scenario-prompts/*`
- Focused scenario/runtime tests under `tests/`

Risks:

- Tooltip positioning depends on canvas-projected trajectory points and DOM positioning staying in sync.
- Loop detection should avoid false positives for paths that reverse direction.
- Browser screenshot QA may be blocked by local browser tooling.

Test strategy:

- Unit-test onboarding prompt copy, step progression, deferred trajectory visibility, and 3-second clear delay.
- Scenario-test Earth impact, Earth loop, non-loop backtracking, and clear trajectory advancement.
- Test scenario directives and checkpoint restore clamping with the 2-hour visible trajectory cap, private 72-hour gate horizon, and post-onboarding `x5m` cap.
- Run full tests, build, diff check, CodeRabbit, and staging deploy.

Cleanup expectations:

- Keep trajectory gating local to the tutorial scene router.
- Avoid adding broad tutorial abstractions.
- Reuse existing scenario prompt coach positioning where possible.

Expected completion criteria:

- Tutorial copy and flow match the requested language and pacing.
- Trajectory visibility and trajectory prompt advancement follow the clarified 3-day prediction rules.
- Automated validation and staging deploy complete, with any browser/CodeRabbit gaps recorded.

## Task Slices

- [x] Update tutorial copy and burn vocabulary.
- [x] Remove the old `Burn Complete` prompt.
- [x] Change high-warp requirement and copy to `x30s`.
- [x] Defer trajectory visibility until burn starts during `Burn At x30s`.
- [x] Add trajectory-line coach anchoring.
- [x] Add trajectory-clear gating with 3-second delay.
- [x] Update first-phase prediction and time-warp directives.
- [x] Add focused regression tests.
- [x] Deploy staging.

## Implementation Handoff

Changed files:

- `src/presentation/hudPresentation.ts`
- `src/presentation/trajectoryPresentation.ts`
- `src/runtime/frameLoop.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/config.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingTypes.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`
- `src/ui/overlayUI/createOverlayUi.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `tests/runtime/runtimeStateTransitions.test.ts`
- `tests/scenario/scenarioDirectives.test.ts`
- `tests/scenario/scenarioPrompts.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`

Behavior implemented:

- Casual first prompt and updated burn-focused tutorial copy.
- `Keep Burning` mentions the speed pill.
- Removed `intro-thrusting-complete`.
- `Burn At x30s` is a floating coach prompt and auto-advances after 1 second of active burn at `x30s`.
- Trajectory remains hidden during `Burn At x30s` until burn starts.
- `This Is Your Trajectory` points at a projected trajectory-line anchor.
- `This Is Your Trajectory` uses compact copy: `This line predicts your path from speed and gravity. Use it to tell whether your burn is moving you away from Earth.`
- The trajectory prompt is automatic and advances after the private 3-day prediction is clear for 3 seconds.
- Earth impact and net Earth loop inside the private 72-hour prediction block progression.
- Backtracking angular motion without a net Earth loop does not block progression.
- First phase keeps the visible trajectory horizon capped at 2 hours, uses a private 72-hour gate prediction, caps time warp at `x30s` during onboarding, then allows `x5m` after `Escape Earth` appears; phase two keeps the Moon travel cap.
- First phase keeps zoom capped at `EARTH_VIEWPORT_SIZE` until the trajectory coach, then allows the midpoint viewport cap between Earth and Earth-Moon sizes.

Deviations from design:

- None.

Blockers:

- Browser screenshot QA is blocked: Chrome DevTools MCP reports the shared profile is already running, and no installed repo Playwright/Puppeteer runner is available.
- CodeRabbit timed out with no output after about two minutes and was interrupted.

Known gaps:

- No screenshot-based playtest evidence for this slice because browser tooling is blocked.
- CodeRabbit automated review could not complete.

## Cleanup Notes

Cleanup performed:

- Kept trajectory-gate helpers local to `tutorialSceneRouter.ts`.
- Used existing scenario prompt positioning and overlay UI patterns.
- Formatted touched files with Biome.
- During review, changed loop detection to net angular wrap and added a regression test for angular backtracking.

Cleanup intentionally skipped:

- No generic trajectory coach framework; only one tutorial callout needs it.
- No canvas dimming or spotlighting; deferred by request.

Stale artifacts/docs:

- Shipit state updated with this slice.

## Review Notes

Supplied findings:

- None from the user.
- CodeRabbit did not return findings because `coderabbit --base main --agent` timed out silently after about 90 seconds and was interrupted.

Ponytail review:

- Lean already after the net-loop review fix. No extra abstraction or dependency to remove.

Self-review findings:

- Fixed loop detection to use net signed angular travel so back-and-forth motion does not count as circling Earth.
- Added regression coverage for the backtracking case.
- No further in-scope correctness issues found in the local diff review.

Solution retrospect:

- Passing trajectory prediction state through scenario advancement is the smallest practical bridge from the render/runtime prediction system to tutorial progression.
- Keeping the trajectory gate in the tutorial scene router avoids widening public APIs or creating a reusable objective framework prematurely.
- The DOM anchor is a pragmatic way to point a coach pill at a canvas line without implementing canvas dimming in this slice.

Requirement coverage:

- `Burn At x30s` disappears after 1 second of active burn at `x30s`.
- That prompt stays in the default/floating position.
- Trajectory line appears only after burn starts during that prompt.
- The next prompt points to the trajectory and explains its purpose.
- The trajectory prompt waits for no Earth impact and no Earth loop within the 3-day prediction, then delays 3 seconds before continuing.

Residual risk:

- Visual tooltip placement has automated state coverage but no screenshot verification due to browser tooling being blocked.
- CodeRabbit automated review did not complete.

Validation results:

- `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/scenarioDirectives.test.ts tests/runtime/runtimeStateTransitions.test.ts`: passed, 5 files and 67 tests.
- `npm test`: passed, 32 files and 180 tests.
- `npm run build`: passed; existing Vite large chunk warning remains.
- `git diff --check`: passed.
- `npm run deploy:netlify`: passed; deployed to `https://space-web-game-woven-moth.netlify.app` with unique URL `https://6a326c1401f9713645b5875e--space-web-game-woven-moth.netlify.app`.
- Browser smoke check: blocked by locked Chrome DevTools MCP profile; no installed repo browser runner available.
- CodeRabbit: timed out silently and was interrupted.

## Merge Review Notes

- User requested Shipit review before merging to `main`.
- Review in progress against the full branch working diff before committing and merging.

## Next Step

Run CodeRabbit, local review, validation, then commit and merge to `main` if clean.
