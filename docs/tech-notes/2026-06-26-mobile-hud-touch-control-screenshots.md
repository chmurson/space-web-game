# Mobile HUD Touch Control Screenshots

## What Changed

- Extended `tests/gui/mobileHudScreenshot.spec.ts` with a shared helper that
  reaches the playable Reach the Moon mobile HUD with the mission brief reduced
  to its replay pill.
- Added mobile GUI screenshots for the in-game time warp reveal, target body
  selector side panel, and thrust reveal control.
- Updated `docs/gui-screenshot-tests.md` to name the in-game control coverage.

## Why

Issue #40 adds coverage for HUD control states that DOM/unit tests do not show
well. The goal is screenshot evidence for the mobile control surfaces while
continuing to suppress the noisy WebGL world layer.

## Key Files

- `tests/gui/mobileHudScreenshot.spec.ts` owns the Playwright mobile Chromium
  GUI paths and screenshot attachments.
- `docs/gui-screenshot-tests.md` explains how to run the harness and what UI
  states it currently covers.

## Decisions

- Reused the #39/#41 screenshot harness instead of creating a second GUI test
  pattern.
- Drove the states through existing accessible reveal buttons, avoiding
  test-only product hooks.
- Captured stable open-panel states instead of swipe-drag internals, which
  keeps the paths deterministic while still covering real control transitions.

## Validation

- `npm run test:gui` passed: 7 mobile Chromium screenshot tests.
- `npx biome lint tests/gui/mobileHudScreenshot.spec.ts` passed.
- `npm test -- --run` passed: 46 files, 304 tests.
- `npm run build` passed with the existing Vite chunk-size warning.
- `git diff --check` passed.
- `coderabbit --base main --agent` completed with 0 findings.
- Visually inspected the new artifacts:
  - `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-dc18f--touch-control-after-reveal-mobile-chromium/mobile-thrust-control.png`

## Follow-Ups

- Add committed visual baselines later if the project standardizes a stable
  browser/OS rendering environment.
