# Active Speed Pill Thrust Style

## What Changed

The top Speed telemetry pill now uses the amber active border and background that originally matched the former bottom Burn active HUD pill while thrust is active. Issue #233 later removed that bottom pill, so the Speed pill is now the active-thrust HUD indicator.

## Why

Issue #227 asked for the active Speed pill to visually match the then-current bottom active thrust pill more closely. The Speed pill already received an active thrust class, but its active surface stayed slate and had no visible amber border.

## Key Files

- `src/style.css`: owns the active `.telemetry-pill-velocity.telemetry-pill-thrusting` visual state.
- `src/ui/overlayUI/overlayUIStyles.css`: formerly owned the bottom `.burn-active-notice` reference style; issue #233 removed that notice.
- `src/presentation/hudPresentation.ts`: already toggles the Speed pill thrusting state from simulation thrust/fuel/crash state.

## Decisions

- Kept the fix CSS-only because the runtime already applies `telemetry-pill-thrusting` exactly when active thrust should be visible.
- Matched only the active Speed pill border and background. Inactive Speed pill styling, copy, layout, and thrust input behavior remain unchanged.
- Kept the existing Speed pill active shadow/glow as requested because it already closely matched the burn notice.
- Reduced active padding by one pixel on each side when the active border appears so the pill's outer size does not grow from the added border.

## Validation

- `npx biome check src/style.css tests/gui/mobileHudScreenshot.spec.ts` passed with three pre-existing `src/style.css` `!important` warnings outside this change.
- `npx vitest run --config vite.config.ts tests/presentation/hudPresentation.test.ts`
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "captures the mobile active burn notice pill"`
- `npm run test:gui`
- `npm run build` passed with the existing Vite large-chunk warning.
- `git diff --check`
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-bdb58-ile-active-burn-notice-pill-mobile-chromium/mobile-burn-active-notice.png`; at the time, the active Speed pill matched the bottom Burn active pill's amber border/background, and unrelated HUD pills kept their inactive styling. Issue #233 later removed the bottom Burn active pill.
- `coderabbit --base main --agent` completed with zero findings.

## Follow-Ups

- None currently.
