# Remove Bottom Active Thrust Pill

## What Changed

- Removed the bottom `.burn-active-notice` HUD pill from the bottom notice surface.
- Removed the `burnActiveNotice` overlay ref and the HUD presentation sync that toggled it during active thrust.
- Kept active thrust feedback on the top Speed telemetry pill through `telemetry-pill-thrusting` and `telemetry-speed-icon-thrusting`.
- Updated HUD and GUI coverage to assert the bottom Burn notice is absent while non-thrust bottom notices remain wired.

## Why

PR #231 made the top Speed telemetry pill communicate active thrust clearly. Keeping the bottom Burn active pill duplicated that state and added a redundant bottom HUD notice.

## Key Files

- `src/ui/overlayUI/createBottomHudNoticesSurface.tsx`: owns bottom notice DOM refs and no longer creates the Burn active notice.
- `src/ui/overlayUI/createOverlayUi.ts`: exposes the remaining bottom notice refs.
- `src/presentation/hudPresentation.ts`: keeps Speed telemetry active-thrust styling without syncing a bottom thrust notice.
- `src/ui/overlayUI/overlayUIStyles.css`: removes styles used only by the deleted Burn active notice.
- `tests/presentation/hudPresentation.test.ts`, `tests/gui/bottomHudNotices.spec.ts`, and `tests/gui/mobileHudScreenshot.spec.ts`: cover the updated HUD contract.

## Decisions

- Did not alter Main Thrust mechanics, mobile Burn edge reveal, fuel-depleted notices, transient camera notices, target recommendation notices, scenario prompt pills, or replay/status pills.
- Tutorial/onboarding copy already points active-thrust guidance at the Burn control and top `speed-pill`; no copy update was needed.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/hudPresentation.test.ts`
- `npx playwright test --config playwright.config.ts tests/gui/bottomHudNotices.spec.ts`
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "captures mobile active thrust without a bottom burn notice pill"`
- `npm run build`
- `npm run test:gui`
- `npm test`
- `npx biome check src/presentation/hudPresentation.ts src/ui/overlayUI/createBottomHudNoticesSurface.tsx src/ui/overlayUI/createOverlayUi.ts src/ui/overlayUI/overlayUIStyles.css tests/presentation/hudPresentation.test.ts tests/gui/bottomHudNotices.spec.ts tests/gui/mobileHudScreenshot.spec.ts`

Screenshot inspected:

- `tmp/playwright-results/mobileHudScreenshot-captur-07cba-t-a-bottom-burn-notice-pill-mobile-chromium/mobile-active-thrust-speed-pill.png`

## Follow-Ups

- None.
