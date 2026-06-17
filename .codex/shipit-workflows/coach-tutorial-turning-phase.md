# Shipit State

Task: Improve coach tutorial turning and time-warp phases
Branch: coach-tutorial-turning-phase
Current Mode: review
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
- [x] PR opened/updated (not requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Created branch `coach-tutorial-turning-phase` from the current worktree HEAD, then rebased it onto `main` after the user clarified the requested branch base.
- After rebasing, `git merge-base main HEAD`, `git rev-parse main`, and `git rev-parse HEAD` all resolved to `0639db659614adc58fc9800ac552214b60ca2247` before any commit was created.
- Repository deployment guidance applies: because this is a non-`main` branch, executable or user-visible changes should deploy to the configured staging site before handoff.
- Use inline Shipit handoffs because this is a focused tutorial-flow change.
- Follow-up accepted: the double-tap turning coach should not be anchored to trajectory or any specific object; use a general playfield coach position instead.
- Follow-up accepted: add a burn-like time-warp coach sequence with a set step, a 10s `x30s` hold step anchored to the time-warp pill, fallback to set-time-warp guidance when lowered below `x30s`, and then move to `Burn At x30s`.
- Follow-up accepted: change the private `This Is Your Trajectory` prediction gate from 3 days / 72h to 2 days / 48h for user testing.

## Open Questions

- None for the accepted implementation direction.

## Validation

- [x] `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/scenarioDirectives.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts` passed: 4 files, 61 tests.
- [x] `npm test` passed: 34 files, 204 tests.
- [x] `npm run build` passed; Vite emitted the existing chunk-size warning.
- [x] `git diff --check` passed.
- [x] `coderabbit --base main --agent` completed with 0 findings for the latest time-warp follow-up.
- [x] Browser playtest via Chrome DevTools passed: reached `Set Time Warp`, set `x30s`, saw `Keep x30s` on the time-warp pill, lowered below `x30s` and returned to `Set Time Warp`, then held `x30s` and advanced to `Burn At x30s`.
- [x] Desktop/mobile screenshots captured for the turning coach and the new time-warp hold coach.
- [x] `npm run deploy:netlify` deployed staging:woven-moth after the time-warp follow-up.
- [x] Follow-up `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` passed after changing the time-warp hold from 5s to 10s: 1 file, 25 tests.
- [x] Follow-up `git diff --check` passed.
- [x] Follow-up `coderabbit --base main --agent` completed with 0 findings.
- [x] Follow-up `npm run deploy:netlify` deployed staging:woven-moth with the 10s time-warp hold.
- [x] Follow-up `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts` passed after changing the trajectory gate from 72h to 48h: 1 file, 17 tests.
- [x] Follow-up `git diff --check` passed after the 48h gate change.
- [x] Follow-up `coderabbit --base main --agent` completed with 0 findings after the 48h gate change.
- [x] Follow-up `npm run deploy:netlify` deployed staging:woven-moth with the 48h trajectory gate.

## Next Step

Done. Main-based staging deploy with the unanchored turning coach and time-warp hold coach is live at `https://space-web-game-woven-moth.netlify.app`.

## Brainstorm Handoff

Problem statement: the coach tutorial's turning and time-warp phases should be clearer and smoother for players.

Current understanding:

- The work builds on `main` after the branch-base correction.
- The turning phase is `intro-point-and-turn`.
- The time-warp setup phase is `intro-timewarp`, and the high-warp burn phase is `intro-timewarp-thrust`.

Accepted direction:

- Improve turning copy and require a meaningful heading turn before advancing.
- Make the turning coach unanchored and positioned as a general playfield prompt.
- Add a new `intro-keep-timewarp` step between setting time warp and burning at high warp.
- Require `x30s` for 10s on the hold step, explain what time warp does, and return to the set-time-warp prompt if the player drops below `x30s`.

## Design Handoff

Implementation scope:

- Update `intro-point-and-turn` copy so the coach tells the player to point away from Earth and wait while the ship rotates.
- Track accumulated heading movement during the turning step using the existing `accumulatedHeadingChangeRadians`, `lastSampleHeading`, and `requiredTurnRadians` fields.
- Advance from `intro-point-and-turn` only after a new target-heading selection, at least `requiredTurnRadians` of heading movement, and target-heading guidance has completed.
- Support optional coach anchors and a `playfield` coach layout for unanchored turning guidance.
- Add `intro-keep-timewarp` after `intro-timewarp`, requiring 10s at `x30s` before moving to `intro-timewarp-thrust`.
- Use a private 48h trajectory prediction for the `This Is Your Trajectory` gate, while keeping the visible trajectory controls capped at 2h during onboarding.
- Keep the change local to onboarding prompt/progression code, shared prompt typing/layout support, and focused tests.

Target files:

- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioPrompts.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/config.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingTypes.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

Risks:

- Angle wraparound can undercount or overcount if raw angle subtraction is used; use normalized angle delta accumulation.
- The new time-warp hold step must not duplicate completed step ids when it sends the user back to `intro-timewarp`.
- The 10s prompt still naturally advances during browser capture, so screenshots may need a local debug snapshot with an extended timer for stable visual QA.

Validation:

- Run focused onboarding/prompt tests first.
- Then run full tests, build, diff check, CodeRabbit review, browser playtest, and staging deploy per repo guidance.

## Task Slices

- [x] Update turning coach copy.
- [x] Add normalized heading-change accumulation and require `requiredTurnRadians`.
- [x] Make the turning coach use an unanchored playfield layout.
- [x] Add the time-warp set/hold/fallback sequence.
- [x] Update focused onboarding tests for the new turning and time-warp gates.
- [x] Run validation, review, browser playtest, and staging deploy.

## Implementation Handoff

Changed files:

- `src/scenario/scenarioPromptTypes.ts`
- `src/scenario/scenarioPrompts.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/config.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingTypes.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

Behavior implemented:

- The turning coach prompt now tells players to double-tap open space away from Earth and wait while the ship turns.
- `intro-point-and-turn` now accumulates normalized absolute heading movement and requires at least `requiredTurnRadians` before advancing.
- The turning step still requires a new target-heading selection and waits until target-heading guidance has finished.
- The turning coach now uses an unanchored `playfield` layout instead of anchoring to trajectory.
- Coach prompts now support optional anchors, and `playfield` prompts render as coach prompts without Floating UI anchor positioning.
- Desktop `playfield` prompts sit in the left/lower-middle playfield; mobile `playfield` prompts sit near the bottom above controls.
- `intro-timewarp` now asks the player to set the time pill to `x30s`.
- New `intro-keep-timewarp` keeps a tooltip on the time-warp pill for 10s, explains that time warp speeds up the simulation, and highlights the time-warp pill.
- If the player lowers time warp below `x30s` during `intro-keep-timewarp`, onboarding returns to `intro-timewarp` guidance instead of continuing.
- After 10s at `x30s`, onboarding advances to `Burn At x30s`.
- `This Is Your Trajectory` now uses a private 48h prediction gate instead of 72h before it can advance to `Free Flight Unlocked`.

Deviations from design:

- None.

Known gaps:

- None identified.

## Cleanup Notes

Cleanup performed:

- Ran Biome formatting on the touched onboarding files and focused test.
- Kept the angle helper local to onboarding progression because no shared math module currently owns angle deltas.
- Kept `playfield` as a named coach layout instead of special-casing `intro-point-and-turn` in the prompt DOM updater.
- Kept the time-warp hold timer as onboarding progress state rather than adding a broader tutorial timer abstraction.

Cleanup intentionally skipped:

- No helper extraction or broader tutorial refactor; the change is limited to tutorial onboarding and prompt rendering support.

## Review Notes

Supplied findings:

- CodeRabbit completed with 0 findings for the latest time-warp follow-up.
- An earlier follow-up CodeRabbit run for the unanchored playfield layout stalled and was interrupted, but the later CodeRabbit run completed cleanly against the current diff.

Self-review findings:

- Self-review found no further code changes. The implementation stays local to onboarding prompt/progression code, shared prompt typing/resolution, and scenario prompt layout CSS.
- Ponytail review lens: no new dependency or broad abstraction is justified; the local `normalizeAngleDelta` helper and optional `accumulatedTimeWarpMs` progress field are the smallest scoped solutions.
- Ponytail review lens for the prompt layout: a named `playfield` layout is smaller and clearer than adding prompt-id-specific CSS or a fake trajectory anchor.

Solution retrospect:

- The unused heading-progress fields now have a concrete role in the turning gate, so no state model change was needed.
- The strongest turning regression risk is angle wraparound math; this is handled by normalized angle deltas.
- The strongest time-warp regression risk is fallback churn or duplicate completed steps; tests cover fallback below `x30s`, and completed-step appends are now guarded against duplicates.
- The trajectory gate horizon is now covered by the tutorial scenario test expecting a private 48h prediction request while visible trajectory controls stay capped.
- Focused tests cover the changed copy, optional turning anchor, hidden UI behavior, target-heading completion wait, meaningful-turn requirement, time-warp hold step, and fallback below `x30s`.
- Optional anchors are a better model for general playfield coach prompts than making every coach prompt pretend to point at a concrete anchor.

Browser playtest:

- In-app Browser target was unavailable (`iab` could not attach), so Chrome DevTools browser automation was used.
- Turning desktop screenshot: `.codex/shipit-workflows/coach-tutorial-turning-phase-desktop-turning.png`.
- Turning mobile screenshot: `.codex/shipit-workflows/coach-tutorial-turning-phase-mobile-turning.png`.
- Time-warp hold desktop screenshot: `.codex/shipit-workflows/coach-tutorial-turning-phase-timewarp-keep-desktop.png`.
- Time-warp hold mobile screenshot: `.codex/shipit-workflows/coach-tutorial-turning-phase-timewarp-keep-mobile.png`.
- The visible tutorial path reached `Point By Double-Tapping`, `Set Time Warp`, `Keep x30s`, fallback to `Set Time Warp` after lowering below `x30s`, and `Burn At x30s` after the configured hold. Screenshots were refreshed after the hold changed to 10s.
- A local debug snapshot with an extended negative hold timer was used only to make the `Keep x30s` screenshots stable after the real flow behavior had already been verified.

Residual risk:

- Low. Browser testing used deterministic synthetic input for repeatability, while automated tests verify the progression logic directly. The in-app Browser plugin surface was unavailable, so visual checks used Chrome DevTools instead.

Deployment:

- Production URL for woven moth staging site: `https://space-web-game-woven-moth.netlify.app`
- Unique deploy URL: `https://6a32daae0b2f1d5881f7602a--space-web-game-woven-moth.netlify.app`
- Build logs: `https://app.netlify.com/projects/space-web-game-woven-moth/deploys/6a32daae0b2f1d5881f7602a`
