# Preact Main Menu Migration

Issue: https://github.com/chmurson/space-web-game/issues/24
Branch: `codex/issue-24-preact-ui-migration`
Shipit state: `.codex/shipit-workflows/codex/issue-24-preact-ui-migration.md`

## What Changed

- Added Preact and the Preact Vite preset so the app can render TSX UI
  components.
- Migrated the main menu surface to a typed Preact component.
- Kept the existing `createMainMenu` factory API for app/runtime callers:
  `setVisible`, `showReachMoonHighscores`, and `syncState`.

## Why

Issue #24 is the umbrella for moving hand-built DOM UI toward typed components.
The main menu is the first low-risk complete surface because it is not updated
from the render loop and is already covered by the mobile GUI screenshot
harness.

## Key Files

- `src/ui/components/MainMenuSurface.tsx` owns the Preact-rendered menu markup,
  data attributes, button classes, disabled Load Game state, and menu actions.
- `src/ui/createMainMenu.ts` owns the legacy adapter boundary used by app and
  runtime code.
- `src/style.css` owns the shared `.menu-actions` button-stack styling used by
  menu surfaces.
- `src/ui/createCrashMenu.ts` uses `.menu-actions` and `.crash-menu-actions`
  so crash recovery buttons no longer depend on a main-menu-owned class.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the migrated menu path through
  browser-visible behavior.
- `vite.config.ts` and `tsconfig.json` own the Preact/TSX build setup.

## Decisions

- Keep Preact out of the high-frequency simulation presentation path. The first
  adapter re-renders only when menu visibility, menu view, or Load Game
  availability changes.
- Keep Three.js/WebGL, body labels, offscreen indicators, spacecraft callouts,
  trajectory overlays, and telemetry mutation on their existing renderer-driven
  paths until later focused slices prove a safer boundary.
- Preserve `main-menu-*` class names and `data-main-menu-*` attributes on the
  Preact surface so CSS and GUI tests continue to target the same surface.
- Move shared menu button-stack styling behind a neutral `menu-actions` class
  so crash menu markup no longer depends on a main-menu-owned action container.
- Keep #40's touch-control/side-panel screenshot coverage as a follow-up; it
  does not block migrating this low-risk menu surface.

## Validation

- `npm run build` passed on the latest `origin/main` base, with the existing
  Vite chunk-size warning.
- `npm test -- --run` passed: 46 files, 304 tests.
- `npm run test:gui` passed: 4 mobile Chromium screenshot tests.
- Mobile screenshot artifacts were visually inspected and matched the expected
  main menu, Reach the Moon submenu, tutorial coach prompt, and replay pill
  states. The GUI test also asserts the disabled Load Game state and the Reach
  the Moon submenu Back path:
  - `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-d9652-ch-the-Moon-menu-transition-mobile-chromium/mobile-reach-moon-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-8c0aa-Moon-replay-pill-transition-mobile-chromium/mobile-reach-moon-replay-pill.png`
- Desktop and mobile Playwright smoke screenshots passed against
  `http://127.0.0.1:5173/?reachmoon=1`, including keyboard activation on
  desktop and tap activation on mobile:
  - `.codex/shipit-workflows/codex/issue-24-preact-ui-migration/desktop-reach-moon-menu.png`
  - `.codex/shipit-workflows/codex/issue-24-preact-ui-migration/mobile-reach-moon-menu-browser-smoke.png`
- `npx biome check package.json package-lock.json tsconfig.json vite.config.ts src/ui/createMainMenu.ts src/ui/components/MainMenuSurface.tsx docs/tech-notes/2026-06-25-preact-main-menu-migration.md`
  passed.
- `npx biome check tests/gui/mobileHudScreenshot.spec.ts src/ui/createMainMenu.ts src/ui/components/MainMenuSurface.tsx docs/tech-notes/2026-06-25-preact-main-menu-migration.md`
  passed after review hardening.
- A full `npx biome check src/style.css` was not accepted because the existing
  stylesheet has broad formatter drift and existing `!important` lint warnings;
  the review kept full stylesheet normalization out of scope.
- `git diff --check` passed.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- `coderabbit --base main --agent` was attempted twice, but CodeRabbit returned
  rate-limit errors and produced no findings. The second attempt reported an
  indicated wait time of about 24 minutes.
- Boundary cleanup on 2026-06-26 moved crash menu markup off
  `main-menu-actions` and onto a `crash-menu-actions` container while preserving
  shared button-stack styling through `menu-actions`.
- Boundary cleanup validation passed:
  - `npm run test:gui`: 4 mobile Chromium screenshot tests.
  - Visual inspection of the main menu, Reach the Moon submenu, tutorial coach
    prompt, and replay pill PNGs.
  - `npx biome check src/ui/createCrashMenu.ts src/ui/components/MainMenuSurface.tsx docs/tech-notes/2026-06-25-preact-main-menu-migration.md`.
  - `npx biome check --formatter-enabled=false src/style.css`, with existing
    `!important` warnings only.
  - `git diff --check`.
  - `npm run build`, with the existing Vite chunk-size warning.
- The latest CodeRabbit retry after boundary cleanup hit a recoverable
  rate-limit error and produced no findings.
- Latest staging deploy:
  `https://6a3dad17b798917702842613--space-web-game-woven-moth.netlify.app`.

## Follow-Ups

- Migrate another low-frequency menu surface after the first slice passes
  review, likely crash menu or top menu.
- Revisit touch-control and side-panel screenshot coverage in #40 before moving
  more mobile-specific controls.
