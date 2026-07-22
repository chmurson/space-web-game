# Canvas navigation info and pin interactions

Date: 2026-07-22
Issue: [#277](https://github.com/chmurson/space-web-game/issues/277)
Dependency: [#274](https://github.com/chmurson/space-web-game/issues/274)

## What changed

- Canvas body labels and `Pe`/`Ap` labels are real button targets that toggle the existing Info pin state from #274.
- Direct canvas hits on visible bodies and apsis marker glyphs use the same pin action. A successful stationary primary hit is consumed before maneuver planning; empty-canvas taps, drags, pans, and touch planning keep their existing behavior.
- The active target shows name plus physical spacecraft-to-surface distance for three seconds after a target change, then distance only. Its accessible name remains complete.
- Offscreen active or pinned bodies show name plus physical spacecraft-to-surface distance. Other bodies use unlabeled hollow arrows, while the spacecraft uses the highest-priority solid named indicator without a numeric distance.
- Periapsis and apoapsis use distinct cyan and amber glyphs with only short `Pe`/`Ap` world labels. Their numeric target-surface altitudes remain in Info.
- Orbit-point settings and persisted overrides now expose only marker visibility. Legacy label and distance preferences are ignored during migration.

## Why

The previous playfield repeated several camera-relative and orbit values that already belong in Info. This change makes the moving canvas easier to scan and turns its remaining navigation cues into direct entry points for the centralized pin model, without creating a second ownership or persistence path.

## Ownership and key files

- `src/input/canvasInfoPinInput.ts` owns body/marker picking and DOM label activation. It delegates to `runtimeActions.toggleUserInfoPin` and does not own pin state.
- `src/input/pointerCameraInput.ts` owns the tap-consumption boundary that protects empty-canvas camera and maneuver gestures.
- `src/presentation/bodyPresentation.ts` and its scoped helpers own target-label timing, visible body labels, and offscreen hierarchy.
- `src/presentation/trajectoryPresentation.ts` owns the compact apsis marker/label presentation and reads the combined Info pin state.
- `src/presentation/bodyDistanceContext.ts` owns the shared physical body-surface distance calculation used by both Info and canvas presentation.
- `src/userSettingsStorage.ts` and `src/ui/components/UiSettingsDialogSurface.tsx` own marker-only settings storage and controls.

The centralized pin declarations, scenario-owned immutability, player persistence, Clear behavior, and Info rail remain owned by the #274 runtime and UI modules.

## Decisions

- Body pin identity remains stable across target changes. `Pe` and `Ap` continue to follow the active target-relative prediction.
- The three-second reveal resets only when the active target identity changes, not on ordinary presentation updates.
- Marker hit testing runs before body raycasting so a small apsis glyph near a body remains independently actionable.
- Scenario-owned pins still consume matching canvas activation even when the centralized toggle declines mutation. This avoids leaking a meaningful object tap into maneuver planning.
- No new settings, pin state, dependencies, or exported testing-only APIs were introduced.

## Validation

- `npm run build`: passed, including config validation, TypeScript, and release Vite build.
- Focused Vitest coverage: 8 files and 59 tests passed for picking, pointer ownership, target timing, distance calculation, trajectory labels, settings migration, and initial runtime state.
- Product Vitest suite: 66 files and 635 tests passed.
- Automation claim suite: 16 tests passed.
- `npm test` still exits in the unchanged automation workflow prompt test because `origin/main` lacks the asserted rocket-policy sentence; 2 of its 3 tests pass. No `scripts/` or `docs/automation-prompts/` files changed in this work.
- Focused Playwright navigation coverage: 2 tests passed on desktop and mobile.
- `npm run test:gui -- --retries=1`: all 84 Playwright tests passed without needing a retry. This includes desktop/mobile navigation interaction, camera and maneuver gesture regressions, target recentering, marker-only settings, and screenshot coverage.
- Targeted Biome check passed with only three unchanged `!important` warnings in `src/style.css`; `git diff --check` passed.

## Visual inspection

- Desktop offscreen hierarchy: `tmp/playwright-results/canvasNavigationInfo-conne-3e200-hysical-offscreen-distances-mobile-chromium/desktop-canvas-navigation-offscreen-pins.png`
- Mobile target and apsis labels: `tmp/playwright-results/canvasNavigationInfo-keeps-70864-numeric-Pe-Ap-canvas-labels-mobile-chromium/mobile-canvas-navigation-active-target.png`
- Mobile marker-only settings: `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-orbit-point-display-dialog.png`

All three captures were inspected at original resolution. Desktop showed active Earth and pinned Moon physical distances plus the prioritized spacecraft label. Mobile showed the full active-target label, compact `Pe`, a pinned rail, and an unlabeled hollow offscreen body arrow without crowding the playable center. The settings capture showed one enabled marker-visibility switch and no legacy label-content controls.

## Follow-ups and known gaps

- The in-app Browser control backend was unavailable in this run, so interaction and visual verification used the repository's Playwright setup and inspected screenshot artifacts instead.
- The existing release bundle-size warning remains unchanged.
