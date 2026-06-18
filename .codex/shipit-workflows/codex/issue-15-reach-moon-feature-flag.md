# Shipit State

Task: Issue #15 - Gate Reach the Moon mission behind a feature flag and update menus
Branch: codex/issue-15-reach-moon-feature-flag
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
- Tech note: `docs/tech-notes/2026-06-18-reach-moon-feature-flag.md`

## Decisions

- Issue URL: https://github.com/chmurson/space-web-game/issues/15
- Issue start comment: https://github.com/chmurson/space-web-game/issues/15#issuecomment-4744166380
- Issue progress comment: https://github.com/chmurson/space-web-game/issues/15#issuecomment-4744699568
- Started from `origin/main` in a clean worktree because the primary worktree had unrelated devtools changes.
- Issue #15 is assigned to the authenticated GitHub user as the in-progress marker; this repo has no current `in progress` label or project status for this issue.
- Apply repository guidance: Shipit from the start, Ponytail lens throughout, Game Studio UI/foundations guidance for menu and scenario-flow work.
- Keep this issue focused on a hidden first Reach the Moon entry point; do not add a broad mission router or implement fuel/objective/scoring/highscore storage from later child issues.
- Update AGENTS/Shipit guidance so future GitHub issue work is marked in progress before product-code changes.

## Open Questions

- None currently. The issue body and parent #14 provide a clear first-pass scope.

## Validation

- [x] Focused unit tests for feature flag/menu model behavior
- [x] npm test
- [x] npm run build
- [x] npx biome lint src tests scripts
- [x] git diff --check
- [x] Browser playtest for default and `?reachmoon=1` menu flows on desktop and mobile
- [x] coderabbit --base main --agent attempted; stalled in review and was stopped after several minutes
- [x] npm run deploy:netlify

## Next Step

Commit, push, open and merge PR, then deploy production.

## Brainstorm Handoff

Problem:
- Reach the Moon is a planned mission milestone, but unfinished mission work must remain hidden from normal production visitors.
- The app needs a first hidden navigation shell so later fuel, objective, HUD, scoring, and leaderboard work can be tested behind `?reachmoon=1`.

Goals:
- Add a URL feature flag such as `?reachmoon=1`.
- Keep production default navigation unchanged unless the flag is active.
- When flagged, make Tutorial and Reach the Moon the clearest main-menu actions.
- Add a Reach the Moon menu with Start, Highscores, and Back.
- Keep Free Roam available but visually secondary when the flag is active.
- Preserve existing Tutorial and Free Roam flows.

Non-goals:
- No fuel system.
- No mission objective tracking.
- No scoring implementation.
- No shared highscore storage.
- No broad mission-router abstraction unless the existing structure clearly demands it.

User-facing behavior:
- Visiting normally hides Reach the Moon.
- Visiting with `?reachmoon=1` exposes the Reach the Moon entry and its small scenario menu.
- Start enters a placeholder Reach the Moon playable path using existing Earth-Moon world behavior until later issues add mission mechanics.
- Highscores can be reached from the Reach the Moon menu without requiring backend storage in this issue.

Edge cases:
- Existing scenario query parameters should continue to work.
- Back should return to the main menu without starting gameplay.
- Hidden flagged UI must not appear on normal production entry.

## Design Handoff

Implementation scope:
- Parse `?reachmoon=1` into a small app feature flag in `createAppConfigContext`.
- Gate direct `?scenario=reach-moon` startup unless the feature flag is active; unflagged direct requests should fall back to the existing Earth-Moon scenario behavior.
- Add a `reach-moon` runtime scenario id that reuses the existing Earth-Moon world for now, with Reach the Moon metadata and scenario session id.
- Add a high-level `startReachMoon` action and runtime controller method that load `reach-moon`.
- Extend the existing compact `createMainMenu` component with a flagged Reach the Moon entry and a lightweight sub-menu containing Start, Highscores, and Back.
- Keep Highscores as a menu placeholder only; real storage, ranking, submission, and leaderboard pages remain issue #20.
- Keep styling scoped to existing main-menu surfaces and avoid new framework/router abstractions.

Target files:
- `src/app/createAppConfigContext.ts`
- `src/app/createAppComponents.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/highLevelActions/gameHighLevelActionDispatcher.ts`
- `src/runtime/highLevelActions/registerHighLevelActions.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/render/scenarioAssets.ts`
- `src/ui/createMainMenu.ts`
- `src/style.css`
- focused tests under `tests/app`, `tests/scenario`, and `tests/render`
- dated tech note under `docs/tech-notes`

Data/UI flow:
- URL query parsing produces `featureFlags.reachMoon`.
- App composition passes `featureFlags.reachMoon` into the main menu.
- Default menu remains free of Reach the Moon controls.
- Flagged menu exposes Tutorial and Reach the Moon as primary actions, with Free Roam still available as a secondary action.
- Selecting Reach the Moon opens the in-menu mission shell.
- Start dispatches `startReachMoon`; the scenario transition preloads the same Earth/Moon assets and enters gameplay.
- Highscores switches to an in-menu placeholder screen and does not call a backend.
- Back returns to the flagged main menu.

Risks:
- Accidentally exposing `reach-moon` through unflagged direct scenario URLs.
- Regressing existing Load Game, Tutorial, and Free Roam menu flows.
- Overbuilding a mission router before fuel/objective/scoring issues need it.
- Mobile menu text overflow if the new sub-menu labels are too long.

Test strategy:
- Unit-test feature flag parsing and unflagged direct `reach-moon` scenario fallback.
- Unit-test that `reach-moon` resolves to its own scenario metadata/session while reusing Earth-Moon assets.
- Extend scenario asset tests to include `reach-moon`.
- Browser-check default and flagged menu flows on desktop and mobile.

Completion criteria:
- Normal production entry does not show Reach the Moon.
- `?reachmoon=1` exposes Reach the Moon and the mission sub-menu.
- `?scenario=reach-moon` without the flag does not start the hidden mission.
- Existing Tutorial and Free Roam flows still start.

## Task Slices

- [x] Add app feature flag parsing and direct scenario gating.
- [x] Register the `reach-moon` runtime scenario id and asset manifest entry.
- [x] Wire high-level start action and runtime transition.
- [x] Extend main menu UI and styles for flagged mission entry, sub-menu, and highscore placeholder.
- [x] Add focused tests and tech note.
- [x] Run validation, browser playtest, Shipit review, and staging deploy.

## Implementation Progress

- Added `featureFlags.reachMoon` from `?reachmoon=1` and gated direct `?scenario=reach-moon` startup so unflagged URLs fall back to `earth-moon`.
- Added a `reach-moon` runtime scenario id that reuses the existing Earth-Moon world with Reach the Moon metadata.
- Added `reach-moon` to the scenario asset manifest.
- Wired `startReachMoon` through runtime actions and high-level action dispatch.
- Extended the existing main menu with a flagged Reach the Moon entry, Start/Highscores/Back mission sub-menu, and minimal shared-surface styling.
- Added focused tests for flag parsing, direct hidden-scenario gating, runtime scenario registration, asset manifest coverage, and runtime action launch.
- Added the required tech note.

## Implementation Handoff

Changed files:
- `AGENTS.md`
- `.codex/shipit.config.md`
- `.codex/shipit-workflows/codex/issue-15-reach-moon-feature-flag.md`
- `docs/tech-notes/2026-06-18-reach-moon-feature-flag.md`
- `src/app/createAppComponents.ts`
- `src/app/createAppConfigContext.ts`
- `src/render/scenarioAssets.ts`
- `src/runtime/createScenarioRuntimeController.ts`
- `src/runtime/highLevelActions/gameHighLevelActionDispatcher.ts`
- `src/runtime/highLevelActions/registerHighLevelActions.ts`
- `src/runtime/runtimeActions.ts`
- `src/scenario/scenarioRegistry.ts`
- `src/style.css`
- `src/ui/createMainMenu.ts`
- `tests/app/createAppConfigContext.test.ts`
- `tests/app/createInitialAppRuntimeState.test.ts`
- `tests/render/scenarioAssets.test.ts`
- `tests/runtime/runtimeActions.test.ts`
- `tests/scenario/runtimeScenario.test.ts`

Completed behavior:
- `?reachmoon=1` enables the hidden Reach the Moon menu path.
- Normal menu entry hides Reach the Moon.
- Direct `?scenario=reach-moon` without the flag falls back to `earth-moon`.
- Flagged direct `?scenario=reach-moon&reachmoon=1` starts the Reach the Moon scenario shell.
- The Reach the Moon sub-menu supports Start, Highscores, and Back.
- Start loads `reach-moon`, which currently reuses the Earth-Moon world and assets.

Deviations from design:
- Highscores is a local empty-state menu screen, not a route/page. This keeps issue #20 as the owner of storage-backed leaderboard pages.
- Browser verification used Chrome DevTools fallback because the in-app Browser surface was unavailable.

Known gaps:
- No real fuel, objective tracking, scoring, completion routing, or shared highscores; those remain in child issues #16 through #20.

## Cleanup Notes

Cleanup performed:
- Reverted accidental whole-file CSS formatting churn from `src/style.css` and kept only the scoped main-menu style additions.
- Reviewed the implementation for speculative abstractions and kept the first pass as direct config/menu/runtime wiring.

Cleanup intentionally skipped:
- No mission router or generic feature-flag framework; one hidden mission entry does not need it yet.
- No highscore route/backend placeholder beyond the local menu empty state; #20 owns the real leaderboard work.

## Review Notes

CodeRabbit status:
- `coderabbit --base main --agent` connected and reached the reviewing phase, then emitted only heartbeat/status messages for several minutes.
- The run was stopped manually after it stalled without producing findings. Treat this as no CodeRabbit findings available, not as a clean CodeRabbit pass.
- User approved merge and requested Shipit review. A second `coderabbit --base main --agent` attempt on 2026-06-18 failed immediately with a recoverable rate-limit error and reported a 30 second wait time.

Automated findings:
- None available because CodeRabbit did not finish.

Ponytail lens outcome:
- Kept the first pass deliberately small: direct URL flag, direct scenario id, direct menu sub-view.
- No mission router, general feature-flag framework, backend highscore stub, new dependency, or asset pipeline was added.
- Highscores remains a local empty-state menu so #20 can own the real leaderboard.

Self-review outcome:
- Verified normal menu entry hides Reach the Moon.
- Verified `?reachmoon=1` exposes Tutorial and Reach the Moon as primary actions while keeping Free Roam available.
- Verified direct `?scenario=reach-moon` falls back to `earth-moon` unless `?reachmoon=1` is present.
- Verified Start loads `reach-moon` and reset/restart can use that scenario id.
- Verified tests cover config gating, scenario registration, asset loading, and runtime launch.

Solution retrospect:
- The current shape is still the right first pass: use the existing menu and scenario transition seams.
- A broader mission router or leaderboard route would be premature before fuel/objective/scoring work lands.
- Browser verification covers the DOM menu and WebGL gameplay state; no screenshot diff automation was added.

Validation results:
- Focused Vitest command passed: 4 files, 30 tests.
- `npm test` passed: 37 files, 227 tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- `npx biome lint src tests scripts` passed.
- `git diff --check` passed.
- Browser smoke checks passed through Chrome DevTools fallback for default desktop menu, flagged desktop menu/sub-menu, Start gameplay, direct unflagged fallback, and mobile portrait menu/sub-menu.
- `npm run deploy:netlify` passed.
- Staging deploy: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy: https://6a343017eeb403876a1ccb23--fanciful-bunny-d77b4b.netlify.app
- Pre-merge rerun after user approval:
  - `npm test` passed: 37 files, 227 tests.
  - `npm run build` passed with the existing Vite large-chunk warning.
  - `npx biome lint src tests scripts` passed.
  - `git diff --check` passed.

Residual risk:
- CodeRabbit did not produce findings: the first run stalled in review and the user-requested pre-merge retry was rate-limited.
