# Reach the Moon Feature Flag

## What Changed

- Added `?reachmoon=1` as the hidden feature flag for the Reach the Moon mission shell.
- Added a gated `reach-moon` runtime scenario id that reuses the existing Earth-Moon world.
- Added a flagged main-menu path with Tutorial and Reach the Moon as primary actions.
- Added the Reach the Moon sub-menu with Start, Highscores, and Back.

## Why

Issue #15 needs a hidden entry point before the rest of the Reach the Moon mission work lands. The mission can now be tested without exposing unfinished production navigation to normal visitors.

## Key Files

- `src/app/createAppConfigContext.ts` owns URL flag parsing and direct scenario gating.
- `src/scenario/scenarioRegistry.ts` registers the temporary `reach-moon` scenario shell.
- `src/runtime/createScenarioRuntimeController.ts`, `src/runtime/runtimeActions.ts`, and `src/runtime/highLevelActions/registerHighLevelActions.ts` own the launch path.
- `src/ui/createMainMenu.ts` and `src/style.css` own the flagged menu UI.

## Decisions

- `?scenario=reach-moon` without `?reachmoon=1` falls back to `earth-moon`.
- The first `reach-moon` scenario reuses Earth-Moon physics and assets; fuel, objectives, scoring, and leaderboard storage remain in child issues #16 through #20.
- Highscores is a menu placeholder for now because shared storage belongs to #20.
- No mission router was added; one mission entry does not need it yet.

## Validation

- `npx vitest run --config vite.config.ts tests/app/createAppConfigContext.test.ts tests/scenario/runtimeScenario.test.ts tests/render/scenarioAssets.test.ts tests/runtime/runtimeActions.test.ts`
- `npm test`
- `npm run build`
- `npx biome lint src tests scripts`
- `git diff --check`
- Browser smoke check with Chrome DevTools fallback:
  - default desktop menu hides Reach the Moon;
  - `?reachmoon=1` shows the flagged menu and Reach the Moon sub-menu;
  - Highscores and Back work in the sub-menu;
  - Start enters gameplay with `scenarioId: reach-moon`;
  - unflagged `?scenario=reach-moon` falls back to `earth-moon`;
  - mobile portrait menu and sub-menu fit without clipping or overlap.
- `coderabbit --base main --agent` was attempted, but stalled in the reviewing phase and was stopped after several minutes without findings output.
- `npm run deploy:netlify`
  - Shared staging: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy: https://6a343017eeb403876a1ccb23--fanciful-bunny-d77b4b.netlify.app

## Follow-Ups

- #16 adds mission fuel behavior.
- #17 adds objective tracking.
- #18 adds mission HUD and prompts.
- #19 adds scoring and completion routing.
- #20 adds shared highscores.
