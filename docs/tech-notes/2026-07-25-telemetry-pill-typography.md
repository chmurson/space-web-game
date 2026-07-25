# Telemetry pill typography and elapsed-time padding

## What changed

Issue #308 splits the top time telemetry into separate elapsed-time and time-warp elements. Elapsed time now uses the target pill's existing secondary telemetry treatment, while time warp uses the existing primary `strong` treatment. Elapsed hours and minutes are now padded to at least two digits.

## Why

The combined time string gave both values the same visual weight. Separating them makes the live time-warp rate easier to scan while preserving the established telemetry hierarchy. Padded elapsed components keep the readout stable and readable for values such as `06h30m` and `06h05m`.

## Ownership boundaries and decisions

- `src/ui/components/HudTelemetrySurface.tsx` owns the split telemetry markup and references.
- `src/ui/overlayUI/createOverlayUi.ts` passes those references to presentation code.
- `src/presentation/hudPresentation.ts` updates each value independently.
- `src/ui/formatters.ts` owns the shared compact elapsed formatting, so the padding is consistent wherever that formatter is shown.
- `src/style.css` adds only the local layout wrapper; it reuses existing primary and secondary telemetry treatments rather than adding colors or tokens.

## Validation

- `npm test` — 667 Vitest assertions plus 20 automation-claim/workflow tests passed.
- `npm run build` — configuration validation, TypeScript, and production Vite build passed.
- `npm run test:gui` — 90 Playwright GUI tests passed.
- `npx playwright test --config playwright.config.ts tests/gui/rcsTimeWarpCap.spec.ts` — the focused telemetry interaction test passed and produced `tmp/playwright-results/rcsTimeWarpCap-caps-contro-24d92-iction-limited-warp-request-mobile-chromium/manual-rcs-x15s.png`; visual inspection confirmed the dim secondary elapsed value and bright primary time-warp value remain compact and aligned.

## Follow-up / known gaps

No follow-up is required. The shared elapsed formatter also affects the main-menu elapsed display, intentionally keeping compact elapsed values consistent.
