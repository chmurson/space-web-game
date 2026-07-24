# Canvas navigation info and pin interactions

Date: 2026-07-22
Issue: [#277](https://github.com/chmurson/space-web-game/issues/277)
Dependency: [#274](https://github.com/chmurson/space-web-game/issues/274)

## What changed

- Canvas body labels and `Pe`/`Ap` labels are real button targets that toggle the existing Info pin state from #274.
- Direct canvas hits on visible bodies and activation of the DOM apsis markers use the same pin action. A successful stationary primary body hit is consumed before maneuver planning; empty-canvas taps, drags, pans, and touch planning keep their existing behavior.
- An unselected active target follows the ordinary small-body, name-only label rule. Selecting it shows a stable name plus physical spacecraft-to-surface distance and enables the emphasized target offscreen treatment; unselected targets use the ordinary hollow arrow.
- Selected offscreen bodies show name plus physical spacecraft-to-surface distance. Other bodies use unlabeled hollow arrows, while the spacecraft uses the highest-priority solid named indicator without a numeric distance.
- Periapsis and apoapsis use one cyan DOM inverted-house marker each with `Pe`/`Ap` inside. The duplicate Three.js marker shape is removed. Both remain hidden until the combined Info row is selected, then expose their separate altitude tooltips while the marker faces stay numeric-free.
- Info no longer renders separate desktop or mobile pin rails. It groups Pe and Ap into one atomic selectable row, reuses Target body glyphs, and orders entries as target, selected, then nearest to the target body.
- The desktop Info popover ignores outside clicks and closes only through its own toggle, the `I` shortcut, or Escape.
- Orbit-point settings and persisted overrides now expose only marker visibility. Legacy label and distance preferences are ignored during migration.

## Why

The previous playfield repeated several camera-relative and orbit values that already belong in Info. This change makes the moving canvas easier to scan and turns its remaining navigation cues into direct entry points for the centralized pin model, without creating a second ownership or persistence path.

## Ownership and key files

- `src/input/canvasInfoPinInput.ts` owns body picking and DOM label activation. It delegates to `runtimeActions.toggleUserInfoPin` and does not own pin state.
- `src/input/pointerCameraInput.ts` owns the tap-consumption boundary that protects empty-canvas camera and maneuver gestures.
- `src/presentation/bodyPresentation.ts` and its scoped helpers own selection-gated body labels and offscreen hierarchy.
- `src/presentation/trajectoryPresentation.ts` owns the compact apsis marker/label presentation and reads the combined Info pin state.
- `src/presentation/infoHudPresentation.ts` owns Info grouping and target-relative row ordering; `src/ui/createInfoHud.tsx` owns the single desktop/mobile selection surface.
- `src/presentation/bodyDistanceContext.ts` owns the shared physical body-surface distance calculation used by both Info and canvas presentation.
- `src/userSettingsStorage.ts` and `src/ui/components/UiSettingsDialogSurface.tsx` own marker-only settings storage and controls.

The centralized pin declarations, scenario-owned immutability, player persistence, and Clear behavior remain owned by the #274 runtime modules. The rail presentation introduced there is intentionally removed by the owner-review follow-up.

## Decisions

- Body pin identity remains stable across target changes. `Pe` and `Ap` continue to follow the active target-relative prediction.
- Target-specific distance disclosure remains selection-driven; while unselected, the target falls back to the ordinary name-only body-label rule.
- Pe and Ap remain compatible with the existing runtime pin schema, but the user action treats them as one atomic selection and partial legacy state renders as both selected.
- Body entry ordering uses target-body surface separation while displayed body values remain spacecraft-to-body surface distance.
- The DOM marker is the sole visible apsis hit target, avoiding a duplicate Three.js shape and redundant canvas hit-test path.
- Scenario-owned pins still consume matching canvas activation even when the centralized toggle declines mutation. This avoids leaking a meaningful object tap into maneuver planning.
- No new settings, pin state, dependencies, or exported testing-only APIs were introduced.

## Validation

- `npm run build`: passed, including config validation, TypeScript, and release Vite build.
- Focused second-follow-up Vitest coverage: 4 files and 53 tests passed for atomic Pe/Ap selection, Info grouping, body-only canvas picking, and trajectory marker disclosure.
- Product Vitest suite: 65 files and 634 tests passed.
- Automation claim suite: 16 tests passed.
- `npm test`: product and claim suites passed; one unrelated workflow-prompt assertion remains because the branch and `origin/main` use equivalent automation-reaction wording instead of the test's exact sentence.
- Focused Playwright coverage passed for combined Pe/Ap selection, target generic-label fallback, selected-only orbit markers, and direct marker activation.
- `npm run test:gui -- --retries=1`: all 85 Playwright tests passed without needing a retry on the final run. This includes desktop/mobile navigation interaction, camera and maneuver gesture regressions, selected-target recentering, marker-only settings, and screenshot coverage.
- Targeted Biome check passed with only three unchanged `!important` warnings in `src/style.css`; `git diff --check` passed.

## Visual inspection

- Desktop single-surface Info: `tmp/playwright-results/infoHud-desktop-Info-keeps-85b4d-s-in-one-persistent-popover-mobile-chromium/desktop-info-popover-pinned.png`
- Mobile single-surface Info: `tmp/playwright-results/infoHud-mobile-Info-panel--00394-ion-inside-the-dock-surface-mobile-chromium/mobile-info-panel-selected.png`
- Mobile selected target and apsis tooltip: `tmp/playwright-results/canvasNavigationInfo-gates-dc655--tooltips-on-Info-selection-mobile-chromium/mobile-canvas-navigation-active-target.png`
- Desktop selected offscreen hierarchy: `tmp/playwright-results/canvasNavigationInfo-conne-3e200-hysical-offscreen-distances-mobile-chromium/desktop-canvas-navigation-selected-offscreen.png`
- Mobile selected-target framing above Nav: `tmp/playwright-results/mobileCommandDock-recenter-73104-e-current-playable-viewport-mobile-chromium/mobile-command-dock-locked-target-390.png`

The first four captures were inspected at original resolution for this follow-up. Desktop and mobile Info showed no separate rail, one combined Pe/Ap row, reused body glyphs, and the target-first ordering. The selected Earth tooltip included physical distance, the selected Pe tooltip appeared beside its smaller cyan, distance-free inverted-house marker, and the desktop offscreen capture preserved the selected-target, selected-body, and spacecraft hierarchy without crowding the playfield.

## Follow-ups and known gaps

- The existing release bundle-size warning remains unchanged.
- The unrelated workflow-prompt exact-wording assertion described above remains outside this UI-focused PR follow-up.
