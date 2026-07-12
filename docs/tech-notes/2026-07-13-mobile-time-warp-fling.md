# Mobile Time Warp Fling

## Summary

The temporary horizontal `Time Warp control 2` now carries a fast recent drag briefly into one or two additional Time Warp steps before settling. Slow drags, tiny motion, a pause before release, constraints, cancellation, and reduced-motion mode keep the existing settle behavior.

## Ownership and decisions

- `src/ui/touchControls/stepSelectorControl/createStepSelectorControl.ts` owns the short recent-motion sample, fling gate, constrained extra commits, and the 220ms horizontal settle.
- `src/ui/touchControls/createTimeWarpControl.ts` opts in only the temporary horizontal prototype. The original vertical selector and trajectory selector do not use momentum.
- Existing preview and commit callbacks remain the authority for min/max and scenario caps. The fling loops for at most two attempts and stops at the first blocked step.

## Validation

- Focused unit tests cover the velocity, travel, pause, and one/two-step gates.
- The Time Warp prototype GUI test and the full GUI suite cover mouse/touch routing, cancellation, constraints, and the resting, dragging, rolling, and settled screenshots.
- TypeScript build validates the shipped bundle.

## Follow-up

Remove this behavior with the temporary control if the mobile Time Warp prototype is retired.
