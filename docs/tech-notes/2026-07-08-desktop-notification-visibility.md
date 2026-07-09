# Desktop Notification Visibility

## What Changed

- Runtime transient bottom notices now set `hidden` after their fade-out settles.
- A newer runtime notice cancels any pending final hide from the previous notice before it becomes visible.
- Desktop drag-unlock now shows the same camera unlock notice as mobile when it switches from a locked follow mode to free roam.
- Added focused presenter coverage for the transient notice lifecycle.
- Added desktop GUI screenshot tests that trigger the camera-mode notice and the drag-unlock notice, then assert each box is inside the viewport.

## Why

Issue #209 reported desktop notifications not being visible. The runtime transient notice path hid notices by changing `data-visible` and `aria-hidden`, but unlike the camera notice presenter it never set `hidden` after the fade. That left expired invisible notices in the bottom HUD grid, which could reserve layout space and interfere with later notice placement. Fully hiding the expired notice keeps the bottom notification area in the expected desktop position without changing mobile sizing rules.

PR review follow-up found one remaining desktop gap: the mobile touch-control swipe path showed the camera unlock notice after switching to free roam, but the desktop pointer-drag unlock path only changed the camera mode. The desktop pointer unlock branch now calls the same camera unlock notice presenter after a successful non-touch transition to `unlocked`; the mobile touch path is unchanged.

## Key Files

- `src/presentation/hudPresentation.ts`: owns runtime transient notice presentation and hide timing.
- `src/app/createAppComponents.ts`: wires successful desktop drag-unlock transitions to the existing camera unlock notice presenter.
- `src/input/pointerCameraInput.ts`: owns the desktop drag-unlock threshold branch and skips the new notice hook for touch pointer events.
- `tests/presentation/hudPresentation.test.ts`: covers the fade-out and final `hidden` lifecycle, including a newer notice canceling the pending hide.
- `tests/gui/desktopNotifications.spec.ts`: verifies a desktop Chromium context renders camera notices inside the viewport and captures screenshot artifacts.

## Decisions

- Reused the existing bottom HUD notice surface and timing pattern instead of adding a new notification system.
- Kept the new hook on the existing pointer-input unlock branch so desktop drag behavior changes without duplicating the mobile touch-control notice path.
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
- `tmp/playwright-results/desktopNotifications-shows-5a7b1--drag-unlocks-follow-camera-mobile-chromium/desktop-camera-drag-unlock-notice.png`

## Follow-Ups

- None.
