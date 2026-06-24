# Mobile HUD GUI Screenshot Harness

## What Changed

- Added Playwright Test as the browser GUI test runner.
- Added `npm run test:gui` for the focused mobile screenshot path.
- Added one mobile Chromium test at `390x844` that boots the Reach the Moon main
  menu and captures a screenshot with the WebGL canvas and world overlays hidden
  by test-only CSS.
- Added `docs/gui-screenshot-tests.md` with the run command and extension notes.

## Why

Issue #39 needs a small committed GUI screenshot path before the Preact UI
migration. The goal is confidence in the browser-rendered UI layer, not broad
visual regression coverage.

## Key Files

- `playwright.config.ts` owns the mobile project, Vite web server startup, and
  ignored Playwright output directory.
- `tests/gui/mobileHudScreenshot.spec.ts` owns the first screenshot path.
- `package.json` exposes the one-command runner.

## Decisions

- Use Playwright Test because the repo had no existing browser screenshot
  runner.
- Generate an artifact instead of committing a visual baseline for the first
  slice. Playwright's own docs note host rendering differences for screenshot
  baselines, and this issue explicitly allows a clear screenshot artifact.
- Cover the default main menu with `?reachmoon=1` because it is deterministic on
  boot and avoids gameplay or scenario prompt timing.
- Hide `canvas` and simulation-tied world overlays only from the test page,
  leaving production behavior unchanged.

## Validation

- `npm run test:gui` passed and generated a visually checked mobile main-menu
  screenshot under `tmp/playwright-results/`.
- `npm test -- --run` passed: 44 files, 284 tests.
- `npm run build` passed with the existing Vite chunk-size warning.
- `git diff --check` passed.

## Follow-Ups

- Add visual baselines once the migration has a stable browser/OS environment.
- Add playable HUD, touch controls, prompts, and menu variants as separate
  focused paths.
