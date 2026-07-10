# Time Warp Tape

## What Changed

- Replaced the active mobile Time Warp selector with a horizontal tape control in the existing edge-reveal dock.
- Kept the tape driven by the central configured Time Warp ladder, including the smoother `x1s` through `x15h` sequence that landed on main after the initial tape branch.
- Added focused unit and browser coverage for drag direction, snap threshold, and mouse drag behavior.

## Why

Issue #224 asked for Time Warp to behave like a simulation-time instrument instead of a vertical step selector. The tape keeps a fixed center reader while values move underneath it: drag left increases time rate, drag right decreases time rate, and release snaps to the nearest valid configured value.

## Key Files

- `config/base.yml`: owns the configured Time Warp value list used by runtime state.
- `src/ui/touchControls/createTimeWarpControl.ts`: selects the Time Warp tape as the active configured mobile control.
- `src/ui/touchControls/timeWarpTapeControl/`: owns Time Warp-specific tape rendering, drag mapping, and styling.
- `src/ui/touchControls/stepSelectorControl/stepSelectorControlTypes.ts`: keeps the shared gesture session compatible with a horizontal step anchor.
- `tests/ui/touchControls/timeWarpTapeControl.test.ts` and `tests/gui/timeWarpTapeControl.spec.ts`: cover the tape interaction.
- `tests/gui/mobileHudScreenshot.spec.ts`: keeps the existing mobile Time Warp screenshot artifact pointed at the revealed tape state.

## Decisions

- Kept runtime `timeWarpIndex` as the single source of truth instead of adding a mobile-only mapping layer.
- Left Main Thrust, RCS/steering, target selection, and trajectory controls on their existing components.
- Reused the existing `TimeWarpControlOptions` preview/commit callbacks so scenario max warp, control caps, blocked states, and min/max bounds continue to flow through the runtime policy.
- Added mouse drag directly in the tape component for desktop testing while mobile touch still uses the existing touch-control gesture coordinator.

## Validation

- Focused Vitest passed for tape math, existing selector presenter behavior, and Time Warp feedback policy.
- Full unit/script test suite passed.
- Focused Playwright passed for mouse drag left/right behavior and mobile touch drag through the edge-reveal coordinator.
- Full GUI suite passed and the `mobile-time-warp-control.png` screenshot was inspected.
- Release build passed; Vite reported the existing large-chunk warning.
- CodeRabbit review completed; two nested-ternary findings in this branch were fixed, and unrelated desktop HUD scale findings were left out of scope.

## Follow-Ups

- None currently known.
