# Mobile GUI Prompt, Pill, and Menu Screenshots

## What Changed

- Extended `tests/gui/mobileHudScreenshot.spec.ts` with shared local helpers for
  mobile screenshot setup, canvas/world-overlay suppression, and screenshot
  attachment.
- Added mobile screenshots for the Reach the Moon submenu, tutorial coach
  prompt, and Reach the Moon mission replay pill.
- Kept screenshots artifact-based instead of adding committed baselines.

## Why

Issue #41 expands the first mobile screenshot harness from #39 to cover UI
surfaces that are likely to regress during the Preact migration. The added
paths cover menu, coach prompt, and bottom pill states through real UI
transitions while keeping the WebGL canvas hidden for HUD-focused output.

## Key Files

- `tests/gui/mobileHudScreenshot.spec.ts` owns the Playwright mobile Chromium
  GUI paths and screenshot attachments.
- `playwright.config.ts` continues to own the `390x844` mobile project and Vite
  test server.

## Decisions

- Reused the existing #39 screenshot CSS and runner instead of adding a new
  fixture layer.
- Drove states through real button taps: main menu to Reach the Moon submenu,
  tutorial intro to coach prompt, and Reach the Moon prompt dismissal to replay
  pill.
- Kept assertions functional and minimal: visible headings/buttons, prompt mode
  metadata, replay pill visibility, and hidden canvas/world overlays.

## Validation

- `npm run test:gui` passed: 4 mobile Chromium screenshot tests.
- `npm test` passed: 44 files, 284 tests.
- `npm run build` passed with the existing Vite chunk-size warning.
- `git diff --check` passed.
- `coderabbit --base main --agent` completed with 0 findings.
- `npm run deploy:netlify` deployed to
  `https://space-web-game-woven-moth.netlify.app`.

## Follow-Ups

- Add committed visual baselines later if the project standardizes a stable
  browser/OS rendering environment.
