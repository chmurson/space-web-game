# Hide Mobile Spacecraft Settings On Desktop

## What Changed

- Desktop UI settings now hide mobile-only spacecraft control settings when touch controls are not active.
- The spacecraft controls summary now includes only visible/applicable mobile settings.
- Mobile/touch mode still shows the control-side settings and the maneuver start setting.
- The maneuver setting label changed from `Start turning by drag` to `Starts by drag or tap`.

## Why

Issue #229 reported that desktop mode exposed settings for mobile/touch controls that cannot affect the desktop control surface. Hiding those rows keeps the settings dialog scoped to controls that are currently relevant while preserving saved mobile values internally.

## Key Files

- `src/ui/components/UiSettingsDialogSurface.tsx` owns spacecraft settings row filtering and summary text.
- `src/ui/createUiSettingsDialog.ts` detects whether touch controls are active with the same coarse-pointer media query used by CSS.
- `src/presentation/hudPresentation.ts` reports per-touch-control availability from the existing HUD visibility decisions.
- `src/app/createAppComponents.ts` wires that availability into the UI settings dialog.
- `tests/gui/mobileHudScreenshot.spec.ts` covers adapter behavior, saved hidden values, and mobile settings visibility.
- `tests/gui/desktopNotifications.spec.ts` covers the desktop settings UI state and screenshot.

## Decisions

- Filter only the settings UI surface. Saved touch side and maneuver values are not reset when hidden.
- Reuse the HUD's existing per-control visibility decisions instead of duplicating scenario hidden-UI rules in the dialog.
- Sync the settings dialog only when per-control visibility actually changes.
- Keep the spacecraft settings category visible on desktop with a compact `Keyboard and mouse active` status row.

## Validation

- `npx biome check src/ui/components/UiSettingsDialogSurface.tsx src/ui/createUiSettingsDialog.ts src/presentation/hudPresentation.ts src/app/createAppComponents.ts tests/gui/mobileHudScreenshot.spec.ts tests/gui/desktopNotifications.spec.ts`
- `npx playwright test tests/gui/mobileHudScreenshot.spec.ts tests/gui/desktopNotifications.spec.ts --project=mobile-chromium -g "UI settings|desktop-only|mobile-only spacecraft"`
- `npm run build`
- `npm run test:gui`
- Inspected screenshots:
  - `tmp/playwright-results/desktopNotifications-hides-0121c-ings-in-desktop-UI-settings-mobile-chromium/desktop-spacecraft-controls-settings-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-spacecraft-controls-settings-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-ui-settings-dialog.png`

## Follow-Ups

- None.
