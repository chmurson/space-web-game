# Canvas navigation info and pin interactions

Date: 2026-07-22
Issue: [#277](https://github.com/chmurson/space-web-game/issues/277)
Dependency: [#274](https://github.com/chmurson/space-web-game/issues/274)

## What changed

- Canvas body labels and `Pe`/`Ap` labels are real button targets that toggle the existing Info pin state from #274.
- Direct canvas hits on visible bodies and apsis marker glyphs use the same pin action. A successful stationary primary hit is consumed before maneuver planning; empty-canvas taps, drags, pans, and touch planning keep their existing behavior.
- The active target is intentionally tooltip-free while unselected. Selecting it shows a stable name plus physical spacecraft-to-surface distance and enables the emphasized target offscreen treatment; unselected targets use the ordinary hollow arrow.
- Selected offscreen bodies show name plus physical spacecraft-to-surface distance. Other bodies use unlabeled hollow arrows, while the spacecraft uses the highest-priority solid named indicator without a numeric distance.
- Periapsis and apoapsis use cyan and amber inverted-house markers with `Pe`/`Ap` inside. Selecting either Info point reveals its separate altitude tooltip; the marker face stays numeric-free.
- Info no longer renders separate desktop or mobile pin rails. It groups Pe and Ap into one independently selectable row, reuses Target body glyphs, and orders entries as target, selected, then nearest to the target body.
- The desktop Info popover ignores outside clicks and closes only through its own toggle, the `I` shortcut, or Escape.
- Orbit-point settings and persisted overrides now expose only marker visibility. Legacy label and distance preferences are ignored during migration.

## Why

The previous playfield repeated several camera-relative and orbit values that already belong in Info. This change makes the moving canvas easier to scan and turns its remaining navigation cues into direct entry points for the centralized pin model, without creating a second ownership or persistence path.

## Ownership and key files

- `src/input/canvasInfoPinInput.ts` owns body/marker picking and DOM label activation. It delegates to `runtimeActions.toggleUserInfoPin` and does not own pin state.
- `src/input/pointerCameraInput.ts` owns the tap-consumption boundary that protects empty-canvas camera and maneuver gestures.
- `src/presentation/bodyPresentation.ts` and its scoped helpers own selection-gated body labels and offscreen hierarchy.
- `src/presentation/trajectoryPresentation.ts` owns the compact apsis marker/label presentation and reads the combined Info pin state.
- `src/presentation/infoHudPresentation.ts` owns Info grouping and target-relative row ordering; `src/ui/createInfoHud.tsx` owns the single desktop/mobile selection surface.
- `src/presentation/bodyDistanceContext.ts` owns the shared physical body-surface distance calculation used by both Info and canvas presentation.
- `src/userSettingsStorage.ts` and `src/ui/components/UiSettingsDialogSurface.tsx` own marker-only settings storage and controls.

The centralized pin declarations, scenario-owned immutability, player persistence, and Clear behavior remain owned by the #274 runtime modules. The rail presentation introduced there is intentionally removed by the owner-review follow-up.

## Decisions

- Body pin identity remains stable across target changes. `Pe` and `Ap` continue to follow the active target-relative prediction.
- Removing the target reveal timer is deliberate: selection is now the sole disclosure rule for the target world tooltip.
- Pe and Ap remain separate runtime selections even though Info presents them in one row, so either tooltip can be disclosed independently.
- Body entry ordering uses target-body surface separation while displayed body values remain spacecraft-to-body surface distance.
- Marker hit testing runs before body raycasting so a small apsis glyph near a body remains independently actionable.
- Scenario-owned pins still consume matching canvas activation even when the centralized toggle declines mutation. This avoids leaking a meaningful object tap into maneuver planning.
- No new settings, pin state, dependencies, or exported testing-only APIs were introduced.

## Validation

- `npm run build`: passed, including config validation, TypeScript, and release Vite build.
- Focused owner-follow-up Vitest coverage: 5 files and 44 tests passed for Info ordering/grouping, body labels, offscreen hierarchy, and trajectory marker selection.
- Product Vitest suite: 65 files and 634 tests passed.
- Automation claim suite: 16 tests passed.
- Focused Playwright owner-follow-up coverage: 6 tests passed for desktop/mobile Info, target/offscreen behavior, and selection-gated apsis tooltips; the updated selected-target recenter case also passed independently.
- `npm run test:gui -- --retries=1`: all 84 Playwright tests passed without needing a retry on the final run. This includes desktop/mobile navigation interaction, camera and maneuver gesture regressions, selected-target recentering, marker-only settings, and screenshot coverage.
- Targeted Biome check passed with only three unchanged `!important` warnings in `src/style.css`; `git diff --check` passed.

## Visual inspection

- Desktop single-surface Info: `tmp/playwright-results/infoHud-desktop-Info-keeps-85b4d-s-in-one-persistent-popover-mobile-chromium/desktop-info-popover-pinned.png`
- Mobile single-surface Info: `tmp/playwright-results/infoHud-mobile-Info-panel--00394-ion-inside-the-dock-surface-mobile-chromium/mobile-info-panel-selected.png`
- Mobile selected target and apsis tooltip: `tmp/playwright-results/canvasNavigationInfo-gates-dc655--tooltips-on-Info-selection-mobile-chromium/mobile-canvas-navigation-active-target.png`
- Desktop selected offscreen hierarchy: `tmp/playwright-results/canvasNavigationInfo-conne-3e200-hysical-offscreen-distances-mobile-chromium/desktop-canvas-navigation-selected-offscreen.png`
- Mobile selected-target framing above Nav: `tmp/playwright-results/mobileCommandDock-recenter-73104-e-current-playable-viewport-mobile-chromium/mobile-command-dock-locked-target-390.png`

All five captures were inspected at original resolution. Desktop and mobile Info showed no separate rail, one combined Pe/Ap row, reused body glyphs, and the target-first ordering. The selected Earth tooltip included physical distance, the selected Pe tooltip appeared beside its distance-free inverted-house marker, and the desktop offscreen capture preserved the selected-target, selected-body, and spacecraft hierarchy without crowding the playfield.

## Follow-ups and known gaps

- The existing release bundle-size warning remains unchanged.
