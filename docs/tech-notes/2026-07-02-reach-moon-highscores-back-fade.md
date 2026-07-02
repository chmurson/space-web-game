# Reach the Moon Highscores Back and Loading Fade

Issue: https://github.com/chmurson/space-web-game/issues/150
Branch: `codex/issue-150-reach-moon-highscores-back-fade`

## What Changed

- Back from Reach the Moon highscores now returns to the Reach the Moon submenu instead of always jumping to the top-level main menu.
- Direct completed-run highscore opens use the same Reach the Moon submenu as their back target.
- Leaderboard period switches keep the currently visible rollup mounted while the new period loads.
- Loading rows get a gray/faded visual state and `aria-busy` table state until fresh data replaces them.

## Why

Highscores are part of the Reach the Moon menu flow, so Back should behave like a one-step menu navigation action. Period switching also needs to preserve the table layout while data is pending; unmounting rows made the panel jump and made loading feel broken.

## Key Files

- `src/ui/createMainMenu.ts` owns active menu view state, highscore back target state, and the fallback rollup used during period loads.
- `src/ui/components/MainMenuSurface.tsx` owns semantic highscore table rendering and loading-row class/ARIA state.
- `src/style.css` owns the row fade/gray visual treatment and reduced-motion handling.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the back navigation and stable row-loading behavior.

## Decisions

- Kept the fix inside the existing main-menu/highscore adapter instead of adding a broader menu history abstraction.
- Used the last visible rollup only while the active period request is pending. If the request fails and the active period has no data, the normal error state still owns the panel.
- Attached a screenshot from the pending-period state because the fade behavior is visual and DOM assertions alone are not enough.

## Validation

- `npx biome check --write src/ui/createMainMenu.ts src/ui/components/MainMenuSurface.tsx src/style.css tests/gui/mobileHudScreenshot.spec.ts` passed; it still reports three existing `!important` warnings in unrelated CSS rules.
- `coderabbit --base main --agent` passed with zero findings after addressing its CSS table/caption and formatter-wrap comments.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "Reach the Moon highscores|highscore rows"` passed, 3 tests.
- `npx tsc --noEmit` passed.
- `npm run build` passed; Vite emitted the existing large chunk warning.
- `npm run test:gui` passed, 32 tests.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-58df7-Moon-highscores-leaderboard-mobile-chromium/mobile-reach-moon-highscores.png`: highscore panel remained centered, readable, and unclipped.
- Inspected `tmp/playwright-results/mobileHudScreenshot-keeps--4aeb9-ded-while-switching-periods-mobile-chromium/mobile-reach-moon-highscores-loading-fade.png`: Weekly was active, the existing row stayed in place, and the row was visibly gray/faded during loading.

## Follow-Ups

None currently.
