# Orbit Point Display Settings

Issue: https://github.com/chmurson/space-web-game/issues/138
Branch: `codex/issue-138-orbit-point-display-settings`
Shipit state: `.codex/shipit-workflows/codex/issue-138-orbit-point-display-settings.md`

## What Changed

- Added persisted orbit point display settings for closest/farthest marker dots, labels, altitude, center distance, and point name.
- Added an `Orbit point display` row to the existing UI settings dialog plus a compact sub-dialog with switch controls.
- Disabled dependent orbit point switches when marker dots or labels are off, so unavailable label-field options cannot be toggled.
- Grouped point name, altitude, and center distance under `Marker label contents`, with point name first, to make it clearer that those options only affect marker labels.
- Applied those settings in trajectory event marker presentation so Pe/Ap marker dots and label fields can be hidden independently.
- Updated GUI screenshot coverage for both the main UI settings dialog row and the orbit point display sub-dialog.

## Why

Pe/Ap orbit point markers were always visible and their labels always included center distance plus altitude. Issue #138 asked for player control over marker visibility and label contents so the trajectory view can be quieter when only some orbit point values matter.

## Key Files

- `src/userSettingsStorage.ts` owns the persisted `orbitPointDisplay` defaults and older-setting fallback.
- `src/ui/createUiSettingsDialog.ts` and `src/ui/components/UiSettingsDialogSurface.tsx` own the settings dialog row, sub-dialog pane, focus behavior, and change callbacks.
- `src/app/createAppComponents.ts` keeps the current orbit display settings in app component state and persists updates.
- `src/presentation/trajectoryPresentation.ts` owns marker visibility and label text/ARIA composition.

## Decisions

- Kept the sub-dialog inside the existing UI settings dialog root instead of adding a generic dialog framework.
- Kept trajectory prediction unchanged; settings only affect presentation.
- Default center/focus distance is off as requested, so default Pe/Ap labels now omit center distance while keeping markers, labels, altitude, and point name visible.
- Labels hide when every label field is disabled, while marker dots can remain visible.
- Dependent switches keep their saved values while disabled; re-enabling the parent setting restores those choices.
- A small local group heading was enough for the label fields; no generic settings-section abstraction was added.

## Validation

- `npx vitest run --config vite.config.ts tests/userSettingsStorage.test.ts tests/presentation/trajectoryPresentation.test.ts`
- `npm test`
- `npm run build`
- `npm run test:gui`
- `coderabbit --base main --agent`: completed with 0 findings
- Visually inspected:
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-ui-settings-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-orbit-point-display-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-orbit-point-display-labels-disabled-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-orbit-point-display-markers-disabled-dialog.png`
- Deployed to staging:
  - Shared URL: https://fanciful-bunny-d77b4b.netlify.app
  - Latest unique URL: https://6a43d868f3ad7a1da74f3b2e--fanciful-bunny-d77b4b.netlify.app

## Follow-Ups

- None currently.
