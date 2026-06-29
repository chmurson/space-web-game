# Reach the Moon Leaderboard UI

Date: 2026-06-29
Branch: `codex/issue-117-leaderboard-ui`
Issue: [#117](https://github.com/chmurson/space-web-game/issues/117)

## What Changed

- Replaced the placeholder Reach the Moon Highscores menu panel with a readable leaderboard surface.
- Added Today, Weekly, and All-time filters backed by `GET /api/reach-moon/highscores?period=...`.
- Added ranked rows with pilot name, score, elapsed time, fuel left, and submitted date/time.
- Added completion-opened autosubmit UI with generated fallback pilot name, editable retry name, success, failure, loading, empty, and retry states.
- Added GUI coverage for the mobile leaderboard screenshot and autosubmit retry behavior.

## Why

The highscore backend and completed-run payload plumbing already existed, but players still saw a placeholder panel. This change makes the menu surface usable for the Reach the Moon leaderboard slice and lets completed mission runs submit without adding a route system or changing the gameplay loop.

## Key Files

- `src/ui/createMainMenu.ts` owns leaderboard loading, submit state, autosubmit, retry, stale-request guards, and API error display.
- `src/ui/components/MainMenuSurface.tsx` owns the Preact rendering for filters, rows, generated-name input, and submit/load states.
- `src/style.css` owns the responsive glass-menu leaderboard layout.
- `src/scenario/specific-scenarios/reachMoonHighscores.ts` keeps the shared API response types aligned with the Netlify function's `rollups` response.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the new mobile visual state and completion-opened autosubmit retry behavior.

## Decisions

- Kept the implementation inside the existing main-menu surface and glue instead of adding a separate route or leaderboard subsystem.
- Used the existing two-word fallback name generator for the default submit name shown in the input.
- Submitted completed runs once on `showReachMoonHighscores(pendingRun)`, then let retry reuse the same receipt and current input value.
- Invalidated in-flight leaderboard loads after submit success so an older GET response cannot overwrite the fresher POST rollup.
- Used shared glass variables and compact row styling from the current menu visual system.

## Validation

- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "highscores|autosubmits"` passed: 2 tests.
- `npm run build` passed with the existing Vite chunk-size warning.
- `npm test` passed: 55 Vitest files / 367 tests, plus 16 automation-claim tests.
- `npm run test:gui` passed: 27 Playwright tests.
- `git diff --check` passed.
- `npm run deploy:netlify` passed and deployed to shared staging:
  - Staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a423e432acaab0432a6f4d5--fanciful-bunny-d77b4b.netlify.app`
- `coderabbit --base main --agent` completed with 12 findings:
  - Fixed the changed-file findings for active-period submit rank, clipped filter focus, mobile header accessibility, GUI mock period validation, and this validation section.
  - Skipped unchanged prerequisite/backend hardening findings as out of scope for this UI issue: receipt payload binding, highscore storage repair/cache hardening, receipt validation error mapping, run-receipt timeout normalization, Netlify storage mock shape, and recovered highscore input/score pairing.
- Visually inspected `tmp/playwright-results/mobileHudScreenshot-captur-58df7-Moon-highscores-leaderboard-mobile-chromium/mobile-reach-moon-highscores.png`; the panel fit the mobile viewport, filters and rows were readable, and the long pilot name ellipsized without overlap.

## Follow-Ups

- Backend highscore hardening findings from CodeRabbit remain outside this UI slice and should be handled by a separate backend follow-up.
