# Reach the Moon Highscore Contract

Issue: https://github.com/chmurson/space-web-game/issues/113
Branch: `codex/issue-113-highscore-contract`
Shipit state: `.codex/shipit-workflows/codex/issue-113-highscore-contract.md`

## What Changed

- Added shared Reach the Moon highscore types for submitted score input, stored records, ranked records, period rollups, and list/submit responses.
- Added dependency-free validation helpers for score submissions, player names, period parsing, fallback pilot names, score recomputation, and leaderboard ranking.
- Exposed the Reach the Moon fuel capacity and mission scoring helper from the scoring module so future server code can recompute scores without duplicating constants.
- Updated the Reach the Moon scenario to use the exported fuel-capacity constant.

## Why

Issue #113 is the first dependency-free slice of the highscore sequence under #20. It establishes the shared contract and validation rules before storage, API routes, receipts, runtime submission flow, or leaderboard UI are added.

## Key Files

- `src/scenario/specific-scenarios/reachMoonHighscores.ts` owns the shared highscore contract, validation, fallback names, score recomputation helper, and ranking helper.
- `src/scenario/specific-scenarios/reachMoonScore.ts` owns mission score constants, the general score formula, and the fixed Reach the Moon mission score helper.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` consumes the exported fuel-capacity constant.
- `tests/scenario/specific-scenarios/reachMoonHighscores.test.ts` covers valid records, invalid input, player name bounds, period parsing, ranking tie-breaks, rollups, and generated names.

## Decisions

- Kept the helper local to Reach the Moon scenario code instead of creating a broader highscore framework before storage/API work exists.
- Let missing or blank player names receive a generated two-word pilot name, while explicitly provided nonblank names still must trim to 2-32 characters.
- Recompute `score.totalScore` from fuel ratio and elapsed seconds in `createReachMoonHighscoreRecord`; any client-provided `totalScore` field is ignored.
- Used strict period parsing for `daily`, `weekly`, and `all-time`; callers can decide whether to default invalid or missing query values.
- Ranked records by higher total score, lower mission elapsed seconds, then earlier `submittedAt`, with no extra persistence or UI behavior in this issue.

## Validation

- `npm ci` completed in the task worktree after the first focused test run found missing dependencies. It reported existing audit findings: 1 low, 2 moderate, and 2 high vulnerabilities.
- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts` passed: 3 files, 19 tests.
- `npx biome check src/scenario/specific-scenarios/reachMoonHighscores.ts src/scenario/specific-scenarios/reachMoonScore.ts src/scenario/specific-scenarios/reachMoonScenario.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts` passed after applying safe import/format fixes.
- `git diff --check` passed.
- `npm test` passed: 48 Vitest files, 327 Vitest tests, and 16 automation-claim tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- `coderabbit --base main --agent` completed with 0 findings.
- `npm run deploy:netlify` deployed the non-main branch to the shared staging site:
  - Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a416698f396f889fd578220--fanciful-bunny-d77b4b.netlify.app
  - Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a416698f396f889fd578220

## Follow-Ups

- #20 and its later child issues still own highscore storage, API/Netlify functions, submission flow, receipts, UI, and integration validation.
