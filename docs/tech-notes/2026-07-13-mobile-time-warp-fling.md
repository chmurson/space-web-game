# Mobile Time Warp Fling

## Summary

The temporary horizontal `Time Warp control 2` now carries a fast recent drag into one through six additional Time Warp steps, based on release velocity. The post-release roll lasts roughly 280–630ms based on distance, so gentle releases move a short way while strong swipes travel farther without racing through the ladder. Slow drags, tiny motion, a pause before release, constraints, cancellation, and reduced-motion mode keep the existing settle behavior.

## Ownership and decisions

- `src/ui/touchControls/stepSelectorControl/createStepSelectorControl.ts` owns the short recent-motion sample, fling gate, velocity-to-distance mapping, constrained extra commits, and distance-aware settle duration.
- `src/ui/touchControls/stepSelectorControl/stepSelectorControl.css` applies the per-fling duration to the existing horizontal ease-out transition; ordinary horizontal settling keeps its 180ms duration.
- `src/ui/touchControls/createTimeWarpControl.ts` opts in only the temporary horizontal prototype. The original vertical selector and trajectory selector do not use momentum.
- The issue's one/two-step values were initial tuning. After human testing found that effect hard to distinguish, the maintainer first [requested up to four/six-step momentum](https://github.com/chmurson/space-web-game/pull/252#issuecomment-4956344819), then [asked for a slower, velocity-scaled fling](https://github.com/chmurson/space-web-game/pull/252#issuecomment-4980190452). The final mapping starts at one extra step at 450px/s, adds a step for each additional 150px/s, and caps at six steps from 1,200px/s upward.
- Existing preview and commit callbacks remain the authority for min/max and scenario caps. The fling loops for at most six attempts and stops at the first blocked step.

## Validation

- Focused unit tests cover all six velocity bands plus the travel, pause, and maximum-step gates.
- The Time Warp prototype GUI test covers gentle, medium, strong, paused, tiny, and constrained releases, including the 280–630ms rolling window. The full GUI suite covers mouse/touch routing, cancellation, constraints, and the resting, dragging, rolling, and settled screenshots.
- TypeScript build validates the shipped bundle.

## Follow-up

Remove this behavior with the temporary control if the mobile Time Warp prototype is retired.
