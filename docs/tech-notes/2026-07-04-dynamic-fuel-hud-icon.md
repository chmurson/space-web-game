# Dynamic Fuel HUD Icon

## What Changed

- Made the live HUD fuel icon fill reflect the current normalized fuel tank percentage.
- Quantized the live icon fill to 5 percentage point steps while keeping the text label at the existing whole-percent precision.
- Preserved static/non-live fuel icons, including Reach the Moon highscore icons, by keeping the dynamic fill ref and filled rectangle only in the live HUD telemetry surface.

## Why It Changed

Issue #182 asked for the live fuel icon to communicate remaining fuel visually, matching the existing split where the live time icon is dynamic while non-live time icons stay static.

## Key Files

- `src/ui/components/HudTelemetrySurface.tsx`: live HUD fuel SVG markup and ref ownership.
- `src/ui/overlayUI/createOverlayUi.ts`: live HUD ref plumbing.
- `src/presentation/hudPresentation.ts`: per-frame fuel percentage quantization and SVG fill synchronization.
- `src/style.css`: live fuel-fill colors for available, low, and depleted states.
- `tests/presentation/hudPresentation.test.ts`: regression coverage for full, partial, low, and empty fuel icon fill geometry.

## Decisions

- Kept the implementation in the existing imperative HUD presentation boundary because that already owns per-frame telemetry updates.
- Used a filled SVG rectangle for the live fuel level instead of a new icon abstraction or dependency.
- Preserved existing static fuel icon markup for highscores and other non-live displays.

## Validation

- `npx biome check --write src/ui/components/HudTelemetrySurface.tsx src/ui/overlayUI/createOverlayUi.ts src/presentation/hudPresentation.ts src/style.css tests/presentation/hudPresentation.test.ts`
- `npx vitest run --config vite.config.ts tests/presentation/hudPresentation.test.ts`
- `npm run lint` passed with three pre-existing `!important` warnings in `src/style.css`.
- `npm run build` passed with the existing bundle-size warning.
- `npm run test:gui` passed, 36 Playwright checks.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`; the top HUD fuel pill remained readable and unobstructed with the filled live icon visible.

## Follow-Ups

- None.
