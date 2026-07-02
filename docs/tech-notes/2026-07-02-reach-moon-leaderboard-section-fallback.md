# Reach the Moon Leaderboard Section Fallback

Branch: `codex/issue-153-load-moon-leaderboard-sections`
Issue: [#153](https://github.com/chmurson/space-web-game/issues/153)
Shipit state: `.codex/shipit-workflows/codex/issue-153-load-moon-leaderboard-sections.md`

## What Changed

- The Reach the Moon highscore menu now loads `GET /api/reach-moon/highscores` without a `period` query so the backend can return all leaderboard sections in one response.
- The menu selects the visible board from daily, then weekly, then all-time entries, and falls back to the requested period only when every returned section is empty.
- The empty state now uses a global "No Reach the Moon runs yet." message when no returned section has records, while manual empty period views can still say that specific period has no runs.

## Why

The previous menu loaded only the daily section when opening highscores. If daily had no entries, players saw an empty-state message even when weekly or all-time records existed. The backend already supports all sections in one request, so the UI can avoid serial period fetches and show the best available leaderboard immediately.

## Key Files

- `src/ui/createMainMenu.ts` owns the highscore fetch lifecycle, cached rollups, active period, submit refresh, retry, and menu rendering state.
- `src/ui/components/MainMenuSurface.tsx` owns the highscore board display and empty-state copy.
- `src/scenario/specific-scenarios/reachMoonHighscores.ts` owns shared highscore period ordering and fallback selection.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the visible menu integration and no-query request behavior.
- `tests/scenario/specific-scenarios/reachMoonHighscores.test.ts` covers fallback ordering.

## Decisions

- Kept the existing period filters and cached rollup model instead of adding a separate leaderboard adapter.
- Used the current `all-time` period as the app's broadest section.
- Preserved manual empty-period messaging when another cached section has records; the global empty state is reserved for all returned sections being empty.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts` passed: 1 file, 10 tests.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts --grep "highscore|Highscores"` passed: 8 tests.
- `npm test` passed: 57 Vitest files, 420 tests, plus 16 automation-claim node tests.
- `npm run test:gui` passed after final test updates: 35 Playwright tests.
- `npm run build` passed; Vite emitted the existing large-chunk warning.
- `git diff --check` passed.
- `coderabbit --base main --agent` completed with 3 findings. The in-scope highscore table accessibility coverage finding was addressed with table, row, and columnheader role assertions. The two top-menu dropdown CSS findings were verified as outside this leaderboard branch's scope and left for separate work.
- GUI screenshots inspected:
  - `tmp/playwright-results/mobileHudScreenshot-falls--7865f-om-the-all-section-response-mobile-chromium/mobile-reach-moon-highscores-weekly-fallback.png`
  - `tmp/playwright-results/mobileHudScreenshot-switch-6bc32-cached-all-section-response-mobile-chromium/mobile-reach-moon-highscores-cached-weekly.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-58df7-Moon-highscores-leaderboard-mobile-chromium/mobile-reach-moon-highscores.png`

## Follow-Ups

- CodeRabbit's top-menu dropdown CSS findings are unrelated to issue #153 and may be handled separately if desired.
