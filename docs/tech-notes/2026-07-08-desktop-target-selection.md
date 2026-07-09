# Desktop Target Selection

## What Changed

- Added a desktop-only target selector icon button next to the target telemetry pill.
- Reused the existing target selector list/control inside a compact desktop popover.
- Added a desktop `T` shortcut that opens and closes the popover while preserving the existing target-cycle fallback when the desktop selector is unavailable.
- Kept the mobile edge-tab target selector unchanged.

## Why

Issue #210 asked for desktop feature parity without redesigning the HUD. The target pill remains a passive telemetry readout, and the new adjacent button owns the desktop interaction.

## Key Files

- `src/ui/components/HudTelemetrySurface.tsx` owns the target pill, adjacent desktop button, and popover host.
- `src/ui/createDesktopTargetSelector.ts` mounts the existing target selector control into the desktop popover and handles open/close behavior.
- `src/app/createAppComponents.ts` wires runtime target state into both mobile and desktop selectors.
- `src/input/bindKeyboardShortcuts.ts` lets desktop `T` toggle the selector before falling back to the existing target shortcut behavior.

## Decisions

- The telemetry pill is not clickable, matching the issue direction.
- The desktop button reuses the target status mark icon and moves that icon out of the pill on desktop only.
- The desktop selector follows the same scenario visibility gate as the mobile target control.

## Validation

- Focused Vitest coverage for keyboard shortcut routing and HUD target state sync.
- Focused Playwright GUI coverage for the desktop target button, `T` toggle, Escape close, and mobile-width hiding.
- `npm run build`.
- `npm test`.
- `npm run test:gui`.
- Screenshot inspected: `tmp/playwright-results/desktopTargetSelector-open-af22a-metry-button-and-T-shortcut-mobile-chromium/desktop-target-selector-open.png`.
- `git diff --check`.

## Follow-Ups

- None currently known.
