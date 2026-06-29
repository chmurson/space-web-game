# Reach the Moon Highscore Flow

Issue: https://github.com/chmurson/space-web-game/issues/116
Branch: `codex/issue-116-highscore-flow`
Shipit state: `.codex/shipit-workflows/codex/issue-116-highscore-flow.md`

## What Changed

- Added a small `reach-moon-run-receipt` Netlify Function that issues signed Reach the Moon run receipts through `POST /api/reach-moon/run-receipt`.
- Added a browser receipt requester for runtime high-level actions.
- Stored the completed Reach the Moon highscore submit input next to the completed score summary when the mission finishes.
- Captured the completed-run payload before switching to the menu-background scenario, then passed the payload plus receipt result into the Reach the Moon highscore panel.
- Kept normal menu-opened highscores clear of pending-run submit state.

## Why

The mission-complete Highscores action moves the app back to the menu-background scenario before opening the menu panel. Without capturing the completed run first, the runtime loses the mission state that later highscore submission needs.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScenario.ts` owns completed-run score/input creation and extraction.
- `src/runtime/highLevelActions/registerHighLevelActions.ts` owns receipt request lifecycle and transition-time payload capture.
- `src/runtime/highLevelActions/reachMoonRunReceiptRequest.ts` owns the browser API request boundary for run receipts.
- `netlify/functions/reach-moon-run-receipt.ts` owns server-side receipt issuing.
- `src/ui/createMainMenu.ts` and `src/ui/components/MainMenuSurface.tsx` own the optional pending-run highscore panel state.
- `tests/runtime/highLevelActions/registerHighLevelActions.test.ts`, `tests/scenario/specific-scenarios/reachMoonScenario.test.ts`, and `tests/netlify/reachMoonRunReceiptFunction.test.ts` cover the focused behavior.

## Decisions

- Kept receipt state in the high-level action registration closure instead of adding it to simulation or renderer state.
- Requested the receipt when Reach the Moon starts and on Reach the Moon restarts. Receipt request failure is captured as pending-run failure state instead of blocking the game loop.
- Awaited the already-started receipt request before the completion-opened menu transition so the highscore panel has a complete pending-run payload after the background swap.
- Kept the existing top-level `score` field in completed scenario state for prompt/debug compatibility while adding the API-ready `highscore.input`.
- Did not build the full submit UI; later highscore UI/autosubmit work can consume the pending-run payload.

## Validation

- `npx vitest run --config vite.config.ts tests/runtime/highLevelActions/registerHighLevelActions.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/netlify/reachMoonRunReceiptFunction.test.ts` passed: 3 files, 14 tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- `npm test` passed: 54 Vitest files, 363 tests, plus 16 automation claim tests.
- `npm run test:gui` passed: 25 Playwright tests.
- GUI screenshots inspected:
  - `tmp/playwright-results/mobileHudScreenshot-captur-d9652-ch-the-Moon-menu-transition-mobile-chromium/mobile-reach-moon-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`
- `coderabbit --base main --agent` first pass produced 9 findings. Valid in-scope findings were fixed for completed-run payload hardening, receipt request timeout coverage, and the older run-receipts tech note. Known/out-of-scope backend highscore storage and receipt/value-binding findings were skipped because they predate and exceed this issue.
- `coderabbit --base main --agent` rerun completed with 0 findings.
- `git diff --check` passed.
- `npm run deploy:netlify` deployed to the shared staging site:
  - Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a42298af589c1a6db987589--fanciful-bunny-d77b4b.netlify.app
  - Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a42298af589c1a6db987589

## Follow-Ups

- Later leaderboard UI/autosubmit work should consume `ReachMoonHighscorePendingRun` and decide how to submit or retry when `runReceipt` is missing.
