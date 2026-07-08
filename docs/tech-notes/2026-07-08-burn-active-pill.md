# Burn Active HUD Pill

## What Changed

The HUD now shows a compact amber bottom notice while the spacecraft is actively burning. The notice uses the same rocket-with-flame SVG markup as the top speed telemetry pill, and the existing top telemetry thrusting state remains unchanged.

## Why

Issue #203 asked for burn state to be visible outside the top telemetry strip. The bottom durable notice area already owns compact HUD status pills, so the new burn indication belongs there instead of creating another overlay layer.

## Key Files

- `src/ui/components/HudTelemetrySurface.tsx`: shared rocket-with-flame icon markup.
- `src/ui/overlayUI/createBottomHudNoticesSurface.tsx`: durable burn notice DOM and refs.
- `src/presentation/hudPresentation.ts`: active-thrust state toggles the burn notice and existing top telemetry classes.
- `src/ui/overlayUI/overlayUIStyles.css`: amber/orange compact notice treatment.
- `tests/presentation/hudPresentation.test.ts`: active, stopped, depleted-fuel, and crashed-state coverage.
- `tests/gui/bottomHudNotices.spec.ts` and `tests/gui/mobileHudScreenshot.spec.ts`: DOM contract and mobile screenshot coverage.

## Decisions

- Active burn reuses the existing thrust definition: not crashed, `controls.main > 0`, and fuel remaining.
- The notice is a durable bottom HUD pill with `role="status"` and `aria-live="polite"`, hidden with the same `hidden`, `data-visible`, and `aria-hidden` contract as the fuel-depleted notice.
- The rocket icon was extracted as a small shared Preact component instead of duplicating SVG paths in the bottom notice.
- The amber treatment stays local to the burn notice and uses the existing glass surface style rather than a new palette or notification system.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/hudPresentation.test.ts`
- `npm run build`
- `npx biome check src/ui/components/HudTelemetrySurface.tsx src/ui/overlayUI/createBottomHudNoticesSurface.tsx src/ui/overlayUI/createOverlayUi.ts src/presentation/hudPresentation.ts src/ui/overlayUI/overlayUIStyles.css tests/gui/bottomHudNotices.spec.ts tests/presentation/hudPresentation.test.ts tests/gui/mobileHudScreenshot.spec.ts docs/tech-notes/2026-07-08-burn-active-pill.md`
- `git diff --check`
- `npm run test:gui`
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-bdb58-ile-active-burn-notice-pill-mobile-chromium/mobile-burn-active-notice.png`; the burn pill was compact, amber, centered above bottom controls, and did not overlap side touch tabs.

`coderabbit --base main --agent` was attempted during Shipit review, but it did not complete after remaining in the analysis phase for several minutes, so the run was interrupted and manual self-review plus the Ponytail review pass were completed locally.

## Follow-Ups

- None currently.
