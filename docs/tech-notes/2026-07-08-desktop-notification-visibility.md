# Desktop Notification Visibility

## What Changed

- Runtime transient bottom notices now set `hidden` after their fade-out settles.
- A newer runtime notice cancels any pending final hide from the previous notice before it becomes visible.
- Added focused presenter coverage for the transient notice lifecycle.
- Added a desktop GUI screenshot test that triggers the camera-mode notice and asserts its box is inside the viewport.

## Why

Issue #209 reported desktop notifications not being visible. The runtime transient notice path hid notices by changing `data-visible` and `aria-hidden`, but unlike the camera notice presenter it never set `hidden` after the fade. That left expired invisible notices in the bottom HUD grid, which could reserve layout space and interfere with later notice placement. Fully hiding the expired notice keeps the bottom notification area in the expected desktop position without changing mobile sizing rules.

## Key Files

- `src/presentation/hudPresentation.ts`: owns runtime transient notice presentation and hide timing.
- `tests/presentation/hudPresentation.test.ts`: covers the fade-out and final `hidden` lifecycle, including a newer notice canceling the pending hide.
- `tests/gui/desktopNotifications.spec.ts`: verifies a desktop Chromium context renders the transient notice inside the viewport and captures a screenshot artifact.

## Decisions

- Reused the existing bottom HUD notice surface and timing pattern instead of adding a new notification system.
- Kept CSS and mobile breakpoint rules unchanged.
- Used a desktop-context Playwright test in the existing GUI suite because the current project only had a mobile browser project by default.

## Validation

- `npx biome check --write src/presentation/hudPresentation.ts tests/presentation/hudPresentation.test.ts tests/gui/desktopNotifications.spec.ts`
- `npx vitest run --config vite.config.ts tests/presentation/hudPresentation.test.ts`
- `npx playwright test tests/gui/desktopNotifications.spec.ts --project=mobile-chromium`
- `npm run test:gui`
- `npm run build`
- `npm test`
- `git diff --check`

Screenshot artifact inspected:

- `tmp/playwright-results/desktopNotifications-shows-cef3c-t-bottom-notices-on-desktop-mobile-chromium/desktop-camera-mode-notice.png`

## Follow-Ups

- None.
