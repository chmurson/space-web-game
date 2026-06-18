# Shipit State

Task: GitHub #2 - Dismissible target recommendation notification
Branch: codex/issue-2-target-recommendation-notification
Current Mode: complete
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

- Issue target: https://github.com/chmurson/space-web-game/issues/2
- Issue #2 has no comments as of 2026-06-18, so the issue body is the source of truth.
- Avoid issues #5 and #12 because the user said they are already in progress.
- Work started in a separate worktree from `origin/main` to avoid unrelated local changes in the main checkout.
- Use the existing target selector/status patterns from prior target body selection work instead of adding a broad notification framework.
- Ponytail lens: implement the smallest stateful notification needed for this one recommendation pattern; no generic toast queue unless existing code already requires it.
- Browser verification used Chrome DevTools fallback because the in-app Browser surface reported unavailable.
- Follow-up requested by user: bottom-align the dismissible target notice with the rest of the bottom HUD, and also notify when automatic targeting changes the current target.
- Follow-up requested by user: make automatic target-change notices transient, while keeping manual recommendation notices durable and dismissible.

## Open Questions

- None blocking. Exact placement can be tuned during browser verification.

## Validation

- [x] `npm test`
- [x] `npm run build`
- [x] `npx biome lint src tests scripts`
- [x] Browser verification on desktop and mobile viewports
- [x] `npm run deploy:netlify`

## Next Step

Ready for user review or PR handoff.

## Brainstorm Handoff

Problem statement: When the player manually pins a target body, the automatic targeting system may later recommend a different body. The game should surface that recommendation as a small, less persistent notification without changing the player's manual target.

Goals:

- Show a compact bottom notification when manual targeting is active, the manual body differs from the automatic recommendation, and the recommendation changes after the user's manual selection.
- Let the user open the target change control from the notification.
- Let the user dismiss the notification without switching targets.
- Clear the notification after selecting a target or returning to automatic targeting.
- Let the notification reappear if the automatic recommendation changes again.
- Keep it usable on touch/mobile and accessible to keyboard and screen reader users.

Non-goals:

- Do not add target reveal tab styling for this state.
- Do not change automatic target selection behavior.
- Do not switch manual targets unless the user explicitly selects a target or returns to automatic targeting.

## Design Handoff

Implementation scope:

- Reuse existing assist target UI state from `gameQueries` to detect manual mode and recommendation changes.
- Add a small overlay-owned bottom notification with a button to open target controls and a dismiss button.
- Track dismissed recommendation identity locally in UI state so dismissal does not mutate gameplay state.
- Clear notification state when the active/manual target changes or automatic targeting resumes.
- Use shared glass HUD tokens and accessible button semantics.

Likely target files:

- `src/ui/overlayUI/createOverlayUi.ts`
- `src/ui/overlayUI/overlayUIStyles.css`
- `src/app/createAppComponents.ts`
- `src/ui/touchControls/createTouchControls.ts` if an existing target-control opener needs to be exposed
- Focused tests under `tests/` if there is a small existing runtime/UI seam
- `docs/tech-notes/2026-06-18-target-recommendation-notification.md`

Risks:

- Recommendation state updates every frame; avoid rebuilding DOM or repeatedly announcing the same recommendation.
- Bottom HUD placement can overlap durable notices or mobile touch controls; verify narrow mobile layout.
- Keyboard access requires real buttons and predictable focus behavior, not a passive div with click handlers.

Validation commands:

- `npm test`
- `npm run build`
- Browser verification for desktop and mobile viewport behavior
- `npm run deploy:netlify` because this non-main branch changes user-visible app behavior

Completion criteria:

- Manual target stays active after the notification appears or is dismissed.
- Clicking the notification opens the target selector/control.
- Selecting a target or returning to automatic targeting clears the notification.
- A later changed recommendation can show the notification again.

## Task Slices

- [x] Inspect current target control/opening APIs and choose the smallest hook for opening the selector.
- [x] Add overlay notification DOM/styles and presenter state.
- [x] Wire manual/recommended target changes to show/clear/dismiss behavior.
- [x] Validate with tests, build, and browser checks.
- [x] Deploy staging.

## Implementation Handoff

Changed files:

- `src/ui/createTargetRecommendationNotice.ts`: added the recommendation notice model and DOM presenter.
- `src/ui/overlayUI/createOverlayUi.ts`: added overlay refs for the recommendation notice.
- `src/ui/overlayUI/overlayUIStyles.css`: added compact desktop/mobile notice styling.
- `src/ui/touchControls/createTouchControls.ts`: added `openTargetControl()` and a committed target-state callback.
- `src/app/createAppComponents.ts`: wired the presenter to the existing target control and HUD.
- `src/presentation/hudPresentation.ts`: syncs the notice from the existing `AssistTargetUiState`.
- `tests/ui/targetRecommendationNotice.test.ts`: added focused model coverage.
- `docs/tech-notes/2026-06-18-target-recommendation-notification.md`: recorded implementation and validation.

Behavior implemented:

- The notice waits for an automatic recommendation change after manual targeting starts.
- Dismissing the notice hides only that recommendation and does not switch targets.
- Selecting a target or returning to automatic targeting acknowledges the current state and clears the notice.
- Clicking the notice opens the existing Target selector without changing the active target.
- Automatic targeting shows a transient, non-dismissible notice when the active trajectory target changes after the initial auto-target baseline.
- Mobile notice placement is bottom-aligned with the rest of the bottom HUD.

Deviations from design:

- Natural browser triggering of recommendation changes was not deterministic; state transitions are covered by unit tests, while browser verification used the real DOM/listeners with temporary visibility forcing for layout.

Blockers:

- None.

Known gaps:

- None.

## Cleanup Notes

Cleanup performed:

- Removed temporary browser screenshot artifacts.
- Kept the implementation as one small notice model/presenter plus minimal app wiring.
- Avoided a generic toast/notification queue and did not change runtime target-selection rules.
- Tightened mobile notice width and then bottom-aligned it with the rest of the bottom HUD per follow-up feedback.

Cleanup intentionally skipped:

- No shared abstraction for HUD notices; this is the first dismissible recommendation-specific notice.
- No target reveal-tab styling, per issue non-goal.

Stale artifacts/docs:

- Added `docs/tech-notes/2026-06-18-target-recommendation-notification.md`.

## Review Notes

CodeRabbit:

- `coderabbit --base main --agent`: failed before producing findings because the service rate limit was exceeded.
- Initial reported wait time: 8 minutes 37 seconds.
- Retry after follow-up deploy also failed before producing findings because the service rate limit was exceeded.
- Retry reported wait time: 12 minutes 10 seconds.
- Retry after transient auto-notice follow-up also failed before producing findings because the service rate limit was exceeded.
- Latest retry reported wait time: 2 minutes 18 seconds.
- No CodeRabbit findings were available to triage.

Ponytail review lens:

- Kept the solution as a small notice-specific model/presenter and minimal app wiring.
- Did not add a generic toast manager, notification queue, runtime target API expansion, or target-tab styling.
- The new touch-control API is limited to opening the existing Target panel and reporting committed target-state changes.

Self-review findings:

- Fixed the initial model bug where a baseline recommendation could show on the second frame after manual targeting started.
- Tightened mobile notice width and aligned it to the bottom HUD after follow-up feedback.
- Added automatic-target-change notifications while preserving return-to-auto as a baseline instead of an immediate alert.
- Changed automatic-target-change notifications to one-shot transient notices; manual recommendation notifications remain durable and dismissible.
- No remaining correctness issue found in the final diff.

Solution retrospect:

- Runtime target/recommendation resolution stayed centralized in `gameQueries`; the notice only consumes `AssistTargetUiState`.
- The state rules are unit-tested because natural recommendation changes are hard to trigger deterministically through browser automation.
- Browser verification used the real DOM/listeners for layout and click-to-open behavior, with temporary visibility forcing only for screenshot inspection.

Requirement coverage:

- Manual target remains active unless the user explicitly changes it.
- Dismissal does not switch targets.
- Selecting a target or returning to automatic targeting clears/acknowledges the notice.
- A changed recommendation after manual targeting can notify again.
- A changed active target while automatic targeting remains enabled can notify transiently.
- The notice has keyboard-accessible buttons and screen-reader labels.

Residual risk:

- CodeRabbit did not run because of rate limiting.
- Natural in-browser orbital recommendation changes were not deterministically reproduced; covered by focused model tests.

Validation results:

- `npm test -- targetRecommendationNotice`: passed, 7 tests.
- `npm test`: passed, 37 files and 223 tests after rebasing onto `origin/main`.
- `npm run build`: passed; Vite emitted the existing large-chunk warning.
- `npx biome lint src tests scripts`: passed.
- `git diff --check`: passed.
- Browser checks: passed via Chrome DevTools fallback for Free Roam desktop and mobile/touch emulation. Verified layout, accessible labels, click-to-open target control for durable manual recommendations, disabled/non-dismissible controls for transient automatic target notices, transient timeout behavior, unchanged runtime target after clicking the durable notice, and bottom-aligned mobile placement.

Deployment:

- `npm run deploy:netlify`: passed.
- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a3422e8aa88e2523f12a513--fanciful-bunny-d77b4b.netlify.app

GitHub issue status:

- Issue: https://github.com/chmurson/space-web-game/issues/2
- Comment posted: https://github.com/chmurson/space-web-game/issues/2#issuecomment-4743903136
- Follow-up comment posted: https://github.com/chmurson/space-web-game/issues/2#issuecomment-4744029937
- Transient auto-notice follow-up comment posted: https://github.com/chmurson/space-web-game/issues/2#issuecomment-4744267922
- Issue remains open pending PR/merge review.
