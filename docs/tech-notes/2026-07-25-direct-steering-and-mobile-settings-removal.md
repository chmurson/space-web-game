# Direct steering and mobile Settings removal

Date: 2026-07-25

Issue: [#305](https://github.com/chmurson/space-web-game/issues/305)

Supersedes: [#242](https://github.com/chmurson/space-web-game/issues/242)

## What changed

- Removed the disabled Settings item from the mobile command dock, leaving
  Flight, Info, Nav, and the disabled Ship placeholder.
- Removed the UI settings action from the mobile in-game controls. Desktop
  keeps its settings path for desktop camera preferences.
- Removed player-facing target-heading planning from mouse, touch, and pen
  input, together with its preview/confirmation overlay, runtime state,
  callbacks, time-warp lifecycle, and mobile drag-or-tap preference.
- Kept direct steering: mobile uses the Flight panel's RCS yaw control and
  desktop uses `A`/`D` or Left/Right Arrow, with `Shift` for precise turning.
- Changed the tutorial turning step to teach those direct controls and measure
  actual accumulated heading change. Mobile tutorial focus now opens Flight
  and highlights RCS.
- Removed the separate orbit-marker display preference. The combined Pe/Ap
  Info selection now solely controls whether available markers may appear,
  subject to the existing zoom and tutorial constraints.
- Legacy stored planner and orbit-marker keys are ignored when settings load.

## Why

The mobile Settings entry pointed to preferences that no longer match the
mobile control design. Target-heading planning also duplicated the direct RCS
and keyboard steering paths while adding a second gesture mode, transient
state, confirmation UI, and time-warp behavior.

Using one direct steering model makes playfield gestures predictable: dragging
the playfield pans the camera, while turning happens only through the explicit
RCS or keyboard controls. Pe/Ap selection similarly becomes the single visible
owner of orbit markers.

## Ownership and decisions

- `src/input/pointerCameraInput.ts` and
  `src/ui/touchControls/createTouchControls.ts` own camera gestures only; they
  no longer know about heading plans.
- `src/runtime/simulationStep.ts` retains internal target-heading rotation for
  scenario automation, including the tutorial's automatic prograde setup.
  This is not exposed as a player input mode.
- `src/presentation/spacecraftPresentation.ts` retains actual RCS turn
  feedback and removes future-heading presentation.
- `src/presentation/trajectoryPresentation.ts` derives marker visibility from
  the combined Pe/Ap Info pin and keeps tutorial/zoom suppression.
- `src/ui/touchControls/mobileCommandDock.tsx` owns the four-item mobile dock.
  The temporary old mobile controls menu remains until issue #244, but it no
  longer exposes UI settings.
- Persisted Target and Trajectory side fields remain temporarily because those
  controls still exist before their planned dock migration. No replacement
  preference or migration layer was added for the removed keys.

## Validation

- `npm test` passed: 69 Vitest files with 655 tests, 16 automation-claim
  tests, and 4 automation-workflow tests.
- `npm run build` passed, including config validation and TypeScript. Vite
  reported only its existing large-chunk advisory.
- `npm run test:gui` passed all 84 Playwright tests.
- `git diff --check` passed, and Biome formatting passed for the final changed
  presentation files.
- Regenerated screenshots were inspected at narrow mobile and desktop-settings
  states. The four-item dock fits without clipping, Flight and Nav remain
  usable, mobile Controls has no Settings action, desktop camera settings
  remain, actual-turn RCS feedback renders without a future-heading overlay,
  and playfield camera pan renders without a turn plan. Representative
  artifacts:
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-collapsed-320.png`
  - `tmp/playwright-results/mobileHudScreenshot-omits--2fbfc-the-mobile-in-game-controls-mobile-chromium/mobile-in-game-controls-without-settings.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-36847-d-thrust-controls-in-Flight-mobile-chromium/mobile-rcs-yaw-actual-turn-feedback.png`
  - `tmp/playwright-results/directSteeringInput-mobile-08f2e-ithout-creating-a-turn-plan-mobile-chromium/mobile-direct-steering-camera-pan.png`

## Follow-ups and known gaps

- Issue #244 owns removal of the obsolete mobile in-game Controls popover.
- Target and Trajectory keep their current edge-reveal and stored-side behavior
  until their existing mobile dock migration work lands.
- The existing Target edge tab can overlap that obsolete mobile Controls
  popover at narrow widths; this predates the change and disappears with the
  #244 migration.
