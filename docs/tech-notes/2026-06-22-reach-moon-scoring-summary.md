# Reach the Moon Scoring Summary

Issue: https://github.com/chmurson/space-web-game/issues/19
Branch: `codex/issue-19-reach-moon-scoring`
Shipit state: `.codex/shipit-workflows/codex/issue-19-reach-moon-scoring.md`

## What Changed

- Added a centralized Reach the Moon score calculation.
- Stored the completed mission score in the Reach the Moon scenario state.
- Updated the mission-complete prompt to show time used, time penalty, fuel left, fuel bonus, base score, and final score.
- Added a Highscores prompt action that returns the player to the menu background and opens the existing Reach the Moon Highscores panel.

## Why

Reach the Moon already had finite fuel, objective tracking, HUD fuel feedback, and mission prompts. The mission still needed a closure step that turns a completed run into an understandable score and gives the player an immediate path toward highscores before shared leaderboard storage lands in #20.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScore.ts` owns the scoring formula and summary formatting.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` captures score data at completion and resolves the score summary prompt.
- `src/scenario/scenarioPrompts.ts` and `src/scenario/scenarioPromptTypes.ts` own the new built-in Highscores prompt action.
- `src/runtime/highLevelActions/registerHighLevelActions.ts` and `src/ui/createMainMenu.ts` own the route into the existing Highscores menu panel.
- `tests/scenario/specific-scenarios/reachMoonScore.test.ts`, `tests/scenario/specific-scenarios/reachMoonScenario.test.ts`, `tests/scenario/scenarioPrompts.test.ts`, and `tests/runtime/highLevelActions/registerHighLevelActions.test.ts` cover the scoring and routing behavior.

## Decisions

- Used the simplest scoring model from the issue options: base score minus time penalty plus remaining-fuel bonus.
- Kept formula constants centralized instead of adding a broader mission scoring framework.
- Stored score data in scenario state at completion so prompt replay is deterministic and does not recalculate against later runtime changes.
- Clamped the remaining fuel ratio to mission capacity before calculating the fuel bonus, so malformed snapshots cannot award more fuel than the mission allows.
- Tuned the first score curve after manual play feedback: the initial one-point-per-minute and one-point-per-kg curve made a 2.5 day run with 8% fuel left score about 999k, which was too flat. The first tuning pass used a 4,000 point penalty per elapsed hour and up to 200,000 fuel bonus points by remaining fuel percent, making that example score about 776k before the later scale reduction.
- Scaled the tuned score units down by 1,000 after follow-up feedback. The curve is unchanged: base score is 1,000, max fuel bonus is 200, time penalty is 4 per elapsed hour, and the 2.5 day / 8% fuel example now scores about 776.
- Reused the existing scenario prompt surface for the score summary instead of adding a new completion dialog.
- Reused the existing Highscores menu panel. Shared record storage, ranking periods, and leaderboard pages remain owned by #20.

## Validation

- `npm ci` completed in the #19 worktree. It reported existing audit findings: 1 low, 2 moderate, and 2 high vulnerabilities.
- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/scenarioPrompts.test.ts tests/runtime/highLevelActions/registerHighLevelActions.test.ts`
- `npx tsc --noEmit`
- `npx biome check src/app/createAppComponents.ts src/runtime/highLevelActions/gameHighLevelActionDispatcher.ts src/runtime/highLevelActions/registerHighLevelActions.ts src/scenario/scenarioPromptTypes.ts src/scenario/scenarioPrompts.ts src/scenario/specific-scenarios/reachMoonScenario.ts src/scenario/specific-scenarios/reachMoonScore.ts src/ui/createMainMenu.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/runtime/highLevelActions/registerHighLevelActions.test.ts`
- `git diff --check`
- `npm test` passed after initial implementation: 44 files, 282 tests.
- After score tuning, `npm test` passed: 44 files, 283 tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- Browser playtest with the in-app browser:
  - Desktop flagged menu showed Tutorial and Reach the Moon primary actions.
  - Desktop Reach the Moon submenu opened the existing Highscores panel.
  - Desktop Start opened the real mission-start prompt with finite-fuel HUD visible.
  - Mobile portrait flagged menu and Highscores panel were reachable.
  - Mobile Highscores panel measured within the 390 x 844 viewport.
  - Browser console warnings/errors: none.
- Screenshot capture was attempted for desktop, mobile clipped panel, and visible-browser state, but each attempt timed out in `Page.captureScreenshot`; DOM snapshots and panel bounds were used for browser evidence.
- `npm run deploy:netlify` deployed staging:
  - Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a39578aa27dac35abbd3e97--fanciful-bunny-d77b4b.netlify.app
- After score tuning, `npm run deploy:netlify` deployed staging:
  - Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a3967c0a08042a505d9d0ec--fanciful-bunny-d77b4b.netlify.app
- After score scale reduction, focused scoring tests, Biome, TypeScript, `git diff --check`, `npm test`, and `npm run build` passed. The build kept the existing Vite large-chunk warning.
- After score scale reduction, `npm run deploy:netlify` deployed staging:
  - Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a3a286ec90b69e2bd8ecfbd--fanciful-bunny-d77b4b.netlify.app
- `coderabbit --base main --agent` timed out/stopped after repeated heartbeat-only `reviewing` output and produced no findings.

## Follow-Ups

- #20 still owns shared highscore storage, Today/Weekly/All-time leaderboards, and any score submission flow.
