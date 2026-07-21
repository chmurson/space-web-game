# Info HUD and Pin Management

Issue: [#274](https://github.com/chmurson/space-web-game/issues/274)

Branch: `agent/issue-274-info-hud`

## What changed

- Added runtime-owned player Info pins for bodies, periapsis, and apoapsis,
  with explicit toggle and player-only Clear actions.
- Added exact scenario-owned pin declarations to every Reach the Moon and
  tutorial phase. Scenario pins are visible but cannot be removed by players.
- Added player-pin persistence to debug snapshot version 3. Versions 1 and 2
  migrate to an empty player-pin set, and invalid or unavailable body IDs are
  discarded during load.
- Added a desktop Info pill, anchored popover, and persistent compact rail.
- Replaced the mobile Mission placeholder with an enabled Info dock panel and
  a safe-area-aware persistent rail. Flight, Info, and Nav are mutually
  exclusive panels after syncing the branch with `main`.
- Added `I` to toggle the active Info surface and `Shift+I` to clear player
  pins, while preserving editable-control keyboard isolation.
- Added live physical surface-distance presentation for every scenario body
  and target-relative `Pe`/`Ap` trajectory markers.
- Added concise row-only context beneath each value: body rows say
  `to spacecraft`, while `Pe` and `Ap` name the active target. Pinned rail
  pills retain their compact label-and-value layout.

## Why

Players need a stable way to keep a small set of navigation distances visible
without turning the canvas into a label-management surface. The runtime pin
model lets scenarios surface mission-critical values while still allowing
players to choose additional telemetry on desktop and mobile.

## Ownership boundaries

- `src/runtime/infoPins.ts`, `src/runtime/appRuntimeState.ts`, and
  `src/runtime/runtimeActions.ts` own pin identity, player state, and actions.
- `src/scenario/scenarioDirectiveTypes.ts` and the Reach the Moon/tutorial
  scene routers own exact phase-scoped scenario pins.
- `src/debugScenarioSnapshot.ts`, `src/scenario/runtimeScenario.ts`, and the
  scenario transition/controller files own snapshot and scenario-load flow.
- `src/presentation/infoHudPresentation.ts` owns the display rows and physical
  surface-distance values.
- `src/ui/createInfoHud.tsx`, `src/ui/infoHud.css`, and the mobile command dock
  own accessible DOM controls, panel state, and persistent rails.
- `src/app/createAppComponents.ts` and `src/presentation/hudPresentation.ts`
  compose and refresh the surfaces from the live runtime and prediction state.

Issue [#277](https://github.com/chmurson/space-web-game/issues/277) continues
to own canvas labels, canvas hit testing, and world-space presentation. This
change does not add canvas interaction or presentation behavior.

## Decisions

- Body pins use stable body IDs. `Pe` and `Ap` use target-relative apsis pin
  kinds because their values follow the active assist target.
- Scenario and player ownership remain separate even when both contain the
  same pin. Scenario ownership takes precedence in the UI and prevents
  toggling until that scenario declaration is no longer active.
- Normal scenario changes do not persist player pins. Debug snapshot save/load
  is the only persistence path requested by this issue.
- Body distances subtract body radius from spacecraft-to-center distance.
  `Pe` and `Ap` use trajectory-marker altitude only when the prediction target
  matches the current active target; stale values render as `—`.
- The desktop rail is hidden while its popover is open to prevent overlapping
  duplicate telemetry, then becomes persistent again when the popover closes.
- Secondary distance context belongs to panel rows, not the shared pinned rail,
  so the always-visible pills remain compact on desktop and mobile.
- Shared glass tokens and the existing tap-safe button helper are reused; no
  generic telemetry registry or separate UI state store was introduced.

## Validation

- `npm test` passed: 65 Vitest files / 587 tests, 16 automation-claim tests,
  and 3 automation-workflow tests.
- `npm run build` passed, including config validation, TypeScript, and Vite's
  release build. The existing large-chunk advisory remained.
- `npm run test:gui` passed all 77 Playwright checks after updating two older
  Flight-only selectors for the dock's second panel. The existing horizontal
  Time Warp fling timing case failed once during the preceding run and passed
  both its isolated retry and the complete rerun.
- Focused final-state Info coverage passed all 3 desktop/mobile checks for pin
  flows, shortcuts, one-open panel behavior, accessibility state, scenario
  ownership, safe-area rail placement, and screenshot capture.
- Visually inspected the generated desktop and mobile screenshots. The desktop
  popover is fully visible without rail overlap, and the mobile panel/rail fit
  above the safe-area-aware dock without covering touch controls:
  - `tmp/playwright-results/infoHud-desktop-Info-popov-2d1f4--leaves-the-rail-persistent-mobile-chromium/desktop-info-popover-pinned.png`
  - `tmp/playwright-results/infoHud-mobile-Info-panel--8252c-d-keeps-pins-above-the-dock-mobile-chromium/mobile-info-panel-pinned.png`
- A direct in-app browser smoke could not start because no browser backend was
  available to this worker. The equivalent real-browser flows and screenshots
  passed through Playwright Chromium.

## Follow-ups and known gaps

- Canvas presentation and hit testing remain with #277.
- No issue #274 acceptance item is intentionally deferred.
