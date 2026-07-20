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
- Replaced the visually heavy nested Flight card with a label-free `floating`
  treatment by default, plus `fade` and `glass` review variants selected with
  the `mobileFlightPanel` URL flag.
- Removed the docked RCS outer card, header, and close button so only its direct
  slider track and thumb remain. Flight still closes from the dock item.
- Restored real touch hit-testing for docked Main Thrust at the dock boundary.
  Its existing visuals, gesture model, and runtime callbacks remain unchanged.

## Why

The mobile command dock established in issue #264 is now the owner of manual
flight input. Keeping RCS yaw and Main Thrust together gives players one stable
entry point without replacing the existing input models or changing desktop
controls, scenario rules, or tutorial progression.

## Ownership boundaries

- `src/ui/touchControls/mobileCommandDock.tsx` owns Flight panel state,
  treatment, availability, tutorial focus, and stable mount points for both
  controls.
- `src/app/createAppConfigContext.ts` parses the review-only panel treatment and
  defaults invalid or absent values to the shipped `floating` treatment.
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
- Kept one responsive two-column control layout while exposing three concrete
  surface treatments: `floating` ships by default, `fade` explores a
  dock-connected gradient, and `glass` remains a comparison baseline. This is
  an enumerated review flag rather than a generic panel or layout registry.
- Kept lightweight panel hit areas on the controls themselves so transparent
  space remains part of the playable surface.
- Fixed Main Thrust at the dock integration boundary. The reusable thrust root
  intentionally disables pointer hit-testing when used as a free-floating
  overlay; the dock now re-enables it for the docked instance.
- Kept mobile Flight input availability coupled to the existing scenario
  manual-thrust flag because it already owns both manual yaw and thrust access.
- Retained the legacy `touchBurnControlSide` storage field so existing settings
  data needs no migration; the game no longer presents or consumes it.
- Kept fine-pointer desktop rendering and keyboard input unchanged.

## Validation

- Targeted Biome checks passed for all changed TypeScript and TSX files. The
  dock CSS retains the operator-first multiline `calc()` formatting required by
  the PR's existing style review, and `git diff --check` passed.
- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build. The existing large-chunk advisory remained.
- `npm test` passed: 63 Vitest files / 573 tests, 16 automation-claim tests,
  and 3 automation-workflow tests.
- `npm run test:gui` passed all 73 Playwright checks, including focused Flight
  panel input, reset, tutorial, safe-area, playfield-isolation, and desktop
  regression coverage.
- A direct in-app browser smoke could not start because this worker exposed no
  browser backend. A Chromium DevTools Protocol touch drag now exercises real
  browser hit-testing for docked Main Thrust rather than dispatching directly to
  the control node; the focused Playwright cases also cover taps, cancellation,
  close resets, and playfield isolation.
- Visually inspected the generated 320 px, 390 px, and 430 px portrait
  screenshots. Floating, fade, and glass treatments fit without overlap; active
  RCS and Main Thrust remain legible:
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-floating-open-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-floating-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-floating-open-safe-area-430.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-fade-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-glass-comparison-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-01ddc-d-Main-Thrust-inside-Flight-mobile-chromium/mobile-command-dock-rcs-active-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-01ddc-d-Main-Thrust-inside-Flight-mobile-chromium/mobile-command-dock-main-thrust-active-390.png`

## Follow-ups and known gaps

- Nav, Mission, Ship, and Settings remain disabled until their owning issues
  provide complete panels. They are not part of issue #238.
- No issue #238 acceptance item remains intentionally deferred.
- Tutorial behavior and copy were deliberately left unchanged during the
  lightweight surface iteration.
- Direct manual browser verification remains an environment limitation; the
  automated mobile interaction and screenshot coverage passed.
