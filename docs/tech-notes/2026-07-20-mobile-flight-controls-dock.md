# Mobile Flight Controls in the Bottom Dock

Issue: [#238](https://github.com/chmurson/space-web-game/issues/238)

Shipit state: `.codex/shipit-workflows/agent/issue-238-mobile-flight-controls.md`

## What changed

- Replaced the Flight panel placeholder with the existing analog RCS yaw and
  Main Thrust controls.
- Removed the RCS and Burn edge-reveal tabs while retaining the Time Warp,
  Target, and Trajectory reveals.
- Preserved RCS recentering and thrust press, drag, latch, and cancel behavior,
  and now forcibly clears both controls when Flight closes, becomes
  unavailable, interaction is disabled, or the browser loses focus.
- Routed scenario availability through Flight. The dock disables Flight when
  both manual controls are unavailable.
- Moved tutorial burn focus to the Flight panel and Main Thrust highlight.
- Added the dock bar and open panel to offscreen-indicator collision avoidance.
- Removed the Burn-side setting from runtime configuration and settings UI
  while retaining its legacy storage field without migration.

## Why

The mobile command dock established in issue #264 is now the owner of manual
flight input. Keeping RCS yaw and Main Thrust together gives players one stable
entry point without replacing the existing input models or changing desktop
controls, scenario rules, or tutorial progression.

## Ownership boundaries

- `src/ui/touchControls/mobileCommandDock.tsx` owns Flight panel state,
  availability, tutorial focus, and stable mount points for both controls.
- `src/ui/touchControls/createTouchControls.ts` wires the existing controls to
  those mount points, filters dock touches from playfield gestures, and clears
  flight input at lifecycle boundaries.
- `src/ui/touchControls/rcsYawControl.tsx` and
  `src/ui/touchControls/thrustControl.tsx` retain the analog interaction
  behavior and expose explicit availability/reset handling.
- `src/presentation/hudPresentation.ts` and app composition translate scenario
  control availability into Flight availability.
- Scenario prompt and tutorial files own the anchor and copy changes needed to
  focus the docked Main Thrust control.
- `src/presentation/bodyPresentation/updateOffscreenIndicators.ts` keeps
  indicators clear of the dock and open Flight panel.

## Decisions

- Reused the existing RCS and thrust controls and interaction model; no second
  flight-input implementation or panel-specific control API was introduced.
- Kept the five-item shell selected in issue #264. Disabled future items still
  do not mount empty panels or routes.
- Shipped one responsive two-column Flight layout. It fit the accepted
  320 px, 390 px, and 430 px portrait widths, so no runtime positioning
  variants were needed.
- Kept mobile Flight input availability coupled to the existing scenario
  manual-thrust flag because it already owns both manual yaw and thrust access.
- Retained the legacy `touchBurnControlSide` storage field so existing settings
  data needs no migration; the game no longer presents or consumes it.
- Kept fine-pointer desktop rendering and keyboard input unchanged.

## Validation

- Targeted Biome checks passed for all changed TypeScript, TSX, and CSS files.
- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build. The existing large-chunk advisory remained.
- `npm test` passed: 63 Vitest files / 572 tests, 16 automation-claim tests,
  and 3 automation-workflow tests.
- `npm run test:gui` passed all 73 Playwright checks, including focused Flight
  panel input, reset, tutorial, safe-area, playfield-isolation, and desktop
  regression coverage.
- A direct in-app browser smoke could not start because this worker exposed no
  browser backend. The focused Playwright cases exercised the equivalent mobile
  taps, drags, cancellation, close resets, and playfield isolation instead.
- Visually inspected the generated 320 px, 390 px, and 430 px portrait
  screenshots. The dock and Flight controls fit without overlap; active RCS,
  active Main Thrust, and tutorial focus remain legible:
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-open-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-glass-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-glass-open-safe-area-430.png`
  - `tmp/playwright-results/mobileCommandDock-captures-24c37-d-Main-Thrust-inside-Flight-mobile-chromium/mobile-command-dock-rcs-active-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-24c37-d-Main-Thrust-inside-Flight-mobile-chromium/mobile-command-dock-main-thrust-active-390.png`

## Follow-ups and known gaps

- Nav, Mission, Ship, and Settings remain disabled until their owning issues
  provide complete panels. They are not part of issue #238.
- No issue #238 acceptance item remains intentionally deferred.
- Direct manual browser verification remains an environment limitation; the
  automated mobile interaction and screenshot coverage passed.
