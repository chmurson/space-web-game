# Hold-to-Plan Turn Targeting

## What Changed

Ship turn targeting now uses a held pointer or touch press to plan a target, updates that plan while dragging, and commits the turn on release. Double-click and double-tap no longer commit turn targets. Follow-up review tightened planning to require the spacecraft to be visible in the viewport, removed touch-release haptic feedback for turn commits, and keeps the already committed turn target visible as a separate dotted line while planning a new target.

## Why

Issue #196 reported that double-click and double-tap were too imprecise for delicate orbit maneuvers, especially on touch devices. The existing turn visuals were good, so the change keeps those visuals and only changes the input lifecycle.

## Key Files

- `src/input/pointerCameraInput.ts`: desktop canvas hold-to-plan pointer lifecycle.
- `src/ui/touchControls/createTouchControls.ts`: mobile touch hold-to-plan lifecycle.
- `src/runtime/appRuntimeState.ts` and `src/runtime/runtimeActions.ts`: planned heading state separate from committed simulation heading.
- `src/runtime/frameLoop.ts`: planned heading is fed to the existing spacecraft targeting visuals.
- `src/presentation/spacecraftPresentation.ts`: spacecraft viewport visibility and the separate committed-target line during active planning.

## Decisions

- Planned target headings live in UI runtime state so simulation does not start turning during a hold.
- Release commits through the same committed target-heading state used by the previous turn animation.
- Existing target dot, target line, and turn arc are reused for active planning; one additional SVG line shows the committed target only when it would otherwise be hidden by a new active plan.
- Quick taps/clicks clear the pending plan and do not start a turn.
- Spacecraft presentation is the source of truth for viewport visibility, so desktop and touch input share the same planning gate.

## Validation

- `npm run build`
- `npm test -- --run`
- `npm run test:gui`
- Browser screenshot inspection of the generated GUI artifact.

## Follow-Ups

- None currently.
