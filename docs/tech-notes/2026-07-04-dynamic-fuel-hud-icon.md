# Dynamic Fuel HUD Icon

## What Changed

- Made the live HUD fuel icon fill reflect the current normalized fuel tank percentage.
- Quantized the live icon fill to 5 percentage point steps while keeping the text label at the existing whole-percent precision.
- Extended Reach the Moon highscore fuel icons so completed-run summaries and leaderboard rows visually fill to the score's remaining fuel percentage.

## Why It Changed

Issue #182 asked for the live fuel icon to communicate remaining fuel visually. PR follow-up feedback also asked for the static Reach the Moon highscore fuel icon to reflect the remaining fuel value already shown as text.

## Key Files

- `src/ui/components/HudTelemetrySurface.tsx`: live HUD fuel SVG markup and ref ownership.
- `src/ui/components/MainMenuSurface.tsx`: Reach the Moon highscore fuel SVG markup for completed-run summaries and leaderboard rows.
- `src/ui/overlayUI/createOverlayUi.ts`: live HUD ref plumbing.
- `src/presentation/hudPresentation.ts`: per-frame fuel percentage quantization and SVG fill synchronization.
- `src/scenario/specific-scenarios/reachMoonScore.ts`: shared normalized remaining-fuel ratio for score formatting and highscore icon fill.
- `src/style.css`: live fuel-fill colors for available, low, and depleted states.
- `tests/presentation/hudPresentation.test.ts`: regression coverage for full, partial, low, and empty fuel icon fill geometry.
- `tests/scenario/specific-scenarios/reachMoonScore.test.ts`: regression coverage for normalized remaining-fuel ratio clamping.

## Decisions

- Kept the implementation in the existing imperative HUD presentation boundary because that already owns per-frame telemetry updates.
- Used a filled SVG rectangle for the live fuel level instead of a new icon abstraction or dependency.
- Reused the same normalized fuel-ratio math for highscore text and highscore icon fill, while keeping the live HUD's per-frame refs separate.

## Validation

- `npx biome check --write src/ui/components/HudTelemetrySurface.tsx src/ui/overlayUI/createOverlayUi.ts src/presentation/hudPresentation.ts src/style.css tests/presentation/hudPresentation.test.ts`
- `npx vitest run --config vite.config.ts tests/presentation/hudPresentation.test.ts`
- `npm run lint` passed with three pre-existing `!important` warnings in `src/style.css`.
- `npm run build` passed with the existing bundle-size warning.
- `npm run test:gui` passed, 36 Playwright checks.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`; the top HUD fuel pill remained readable and unobstructed with the filled live icon visible.

## Follow-Ups

- None.
